import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export interface PresetEnvVar {
  name: string;
  description: string;
  required: boolean;
  secret: boolean;
}

export interface PresetManifest {
  name: string;
  version: string;
  description?: string;
  extends?: string;
  filesDir?: string;
  extraDependencies?: Record<string, string>;
  extraDevDependencies?: Record<string, string>;
  envVars?: PresetEnvVar[];
  postInstall?: { scripts?: Array<{ command: string; description: string }> };
}

export interface ResolvedPreset {
  name: string;
  templateDir: string;
  overlayDir?: string;
  extraDependencies?: Record<string, string>;
  extraDevDependencies?: Record<string, string>;
  envVars?: PresetEnvVar[];
  postInstall?: PresetManifest["postInstall"];
}

const REGISTRY_NPMJS = "https://registry.npmjs.org";

/**
 * Resolve a preset name to a base template + optional overlay.
 *
 * - `default` (or unspecified) → bundled `template/` next to the CLI's dist.
 * - `lastspace` → fetched from `@lastspace/preset` on **npmjs (public, no
 *   auth)**. The manifest's `extends: "default"` resolves the base bundled
 *   template; `files/` becomes the overlay. The preset itself contains zero
 *   proprietary code; the actual customer-PAT auth boundary is `pnpm install`
 *   of `@lastspace/spaces-web-ui` (gated separately).
 *
 * Dev escape hatch: `FOUNDRY_UI_PRESET_LASTSPACE_PATH` (filesystem path) skips
 * the registry fetch and uses the local preset directory instead. Used by the
 * lastspace-meta dev workflow + integration tests.
 */
export async function resolvePreset(name: string): Promise<ResolvedPreset> {
  if (name === "default") {
    return { name, templateDir: bundledTemplateDir() };
  }
  if (name === "lastspace") {
    const localOverride = process.env.FOUNDRY_UI_PRESET_LASTSPACE_PATH;
    if (localOverride) {
      return await loadLocalManifestPreset({ name, presetRoot: resolve(localOverride) });
    }
    return await fetchNpmRegistryPreset({
      name,
      scope: "@lastspace",
      packageName: "preset",
    });
  }
  throw new Error(`Unknown preset: ${name}`);
}

/**
 * Locate the bundled template directory.
 *
 * Resolution rules:
 * - Built CLI (dist/index.js): `<pkg-root>/template/` (one level up from dist).
 * - Source mode (src/index.ts via tsx, used in tests): `<pkg-root>/template/`
 *   (two levels up from src).
 *
 * Either way, `<pkg-root>/template/` is the answer. We walk up from the file
 * URL until we find it.
 */
function bundledTemplateDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "template");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate bundled template/ relative to ${here}. ` +
      "Did you build the CLI? Run `pnpm build` in packages/create-foundry-ui-app.",
  );
}

interface LocalPresetOptions {
  name: string;
  presetRoot: string;
}

async function loadLocalManifestPreset(opts: LocalPresetOptions): Promise<ResolvedPreset> {
  const manifestPath = join(opts.presetRoot, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(
      `Local preset path ${opts.presetRoot} has no manifest.json — set FOUNDRY_UI_PRESET_LASTSPACE_PATH to the package root.`,
    );
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as PresetManifest;
  return buildResolvedPreset(opts.name, opts.presetRoot, manifest);
}

interface NpmRegistryFetchOptions {
  name: string;
  scope: string;
  packageName: string;
}

async function fetchNpmRegistryPreset(opts: NpmRegistryFetchOptions): Promise<ResolvedPreset> {
  const fullName = `${opts.scope}/${opts.packageName}`;
  const metaUrl = `${REGISTRY_NPMJS}/${encodeURIComponent(fullName)}`;

  const metaRes = await fetch(metaUrl, {
    headers: { Accept: "application/vnd.npm.install-v1+json" },
  });
  if (!metaRes.ok) {
    throw new Error(
      `npm registry metadata fetch failed for ${fullName}: ${metaRes.status} ${metaRes.statusText}. ` +
        "Verify the preset is published to npmjs and your network can reach registry.npmjs.org.",
    );
  }
  const meta = (await metaRes.json()) as {
    "dist-tags"?: { latest?: string };
    versions?: Record<string, { dist?: { tarball?: string } }>;
  };
  const latest = meta["dist-tags"]?.latest;
  const tarballUrl = latest ? meta.versions?.[latest]?.dist?.tarball : undefined;
  if (!latest || !tarballUrl) {
    throw new Error(`No latest version or tarball URL for ${fullName} on ${REGISTRY_NPMJS}.`);
  }

  const tarballRes = await fetch(tarballUrl);
  if (!tarballRes.ok) {
    throw new Error(
      `Failed to download preset tarball ${tarballUrl}: ${tarballRes.status} ${tarballRes.statusText}.`,
    );
  }
  const tarballBuf = Buffer.from(await tarballRes.arrayBuffer());

  // npm tarballs extract into a top-level `package/` directory.
  const tmpRoot = mkdtempSync(join(tmpdir(), `foundry-preset-${opts.name}-`));
  // Clean up the tmp dir at process exit. The CLI reads from it during the
  // copy/overlay step, then exits — so a single exit-time rmSync suffices and
  // avoids needing the caller to thread a cleanup() callback.
  process.on("exit", () => {
    try {
      rmSync(tmpRoot, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; OS will reclaim tmpdir eventually.
    }
  });
  const tarballPath = join(tmpRoot, "package.tgz");
  writeFileSync(tarballPath, tarballBuf);

  // Use the system `tar` binary — present on macOS, Linux, and Windows 10+
  // (Microsoft ships tar.exe in System32 since 2018). Avoids adding a runtime
  // tar dep for one extraction call.
  const extract = spawnSync("tar", ["-xzf", tarballPath, "-C", tmpRoot], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (extract.error) {
    throw new Error(
      `Failed to spawn 'tar' for preset '${opts.name}': ${extract.error.message}. ` +
        "On Windows 10+ tar.exe ships in System32; on macOS/Linux it's part of the base system. " +
        "Verify your PATH includes a working tar binary.",
    );
  }
  if (extract.status !== 0) {
    throw new Error(
      `tar extraction failed for preset '${opts.name}' (exit ${extract.status}): ${extract.stderr?.toString().trim() || "no stderr output"}.`,
    );
  }

  const presetRoot = join(tmpRoot, "package");
  if (!existsSync(presetRoot)) {
    throw new Error(`Extracted preset has no package/ root in ${tmpRoot}.`);
  }
  const manifestPath = join(presetRoot, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Preset ${fullName}@${latest} has no manifest.json at the package root.`);
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as PresetManifest;
  return buildResolvedPreset(opts.name, presetRoot, manifest);
}

function buildResolvedPreset(
  name: string,
  presetRoot: string,
  manifest: PresetManifest,
): ResolvedPreset {
  if (manifest.extends && manifest.extends !== "default") {
    throw new Error(
      `Preset '${name}' extends '${manifest.extends}', but only 'default' is supported.`,
    );
  }
  // `filesDir` defaults to "files" when omitted from the manifest — matches
  // the convention `@lastspace/preset` ships with. Whichever name resolves
  // (default or explicit) must point to an existing directory in the package.
  const overlayName = manifest.filesDir ?? "files";
  const isDefault = manifest.filesDir === undefined;
  const overlayDir = join(presetRoot, overlayName);
  if (!existsSync(overlayDir)) {
    throw new Error(
      isDefault
        ? `Preset '${name}' has no '${overlayName}/' directory at the package root (default filesDir).`
        : `Preset '${name}' declares filesDir='${overlayName}' but the directory is missing in the package.`,
    );
  }

  return {
    name,
    templateDir: bundledTemplateDir(),
    overlayDir,
    extraDependencies: manifest.extraDependencies,
    extraDevDependencies: manifest.extraDevDependencies,
    envVars: manifest.envVars,
    postInstall: manifest.postInstall,
  };
}
