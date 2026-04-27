import { existsSync, mkdtempSync, writeFileSync } from "node:fs";
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

const REGISTRY_GITHUB_PACKAGES = "https://npm.pkg.github.com";

/**
 * Resolve a preset name to a base template + optional overlay.
 *
 * - `default` (or unspecified) → bundled `template/` next to the CLI's dist.
 * - `lastspace` → fetched from `@lastspace/preset` on GitHub Packages, gated by
 *   `FOUNDRY_UI_TOKEN`. The manifest's `extends: "default"` resolves the base
 *   bundled template; `files/` becomes the overlay.
 *
 * Dev escape hatch: `FOUNDRY_UI_PRESET_LASTSPACE_PATH` (filesystem path) skips
 * the GitHub Packages fetch and uses the local preset directory instead. Used
 * by the lastspace-meta dev workflow + integration tests.
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
    return await fetchGitHubPackagesPreset({
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

interface GitHubPackagesFetchOptions {
  name: string;
  scope: string;
  packageName: string;
}

async function fetchGitHubPackagesPreset(opts: GitHubPackagesFetchOptions): Promise<ResolvedPreset> {
  const token = process.env.FOUNDRY_UI_TOKEN;
  if (!token) {
    throw new Error(
      `Preset '${opts.name}' is fetched from GitHub Packages and requires FOUNDRY_UI_TOKEN. ` +
        "Set FOUNDRY_UI_TOKEN to a fine-grained PAT with read:packages scope on the publishing repo, then re-run.",
    );
  }

  const fullName = `${opts.scope}/${opts.packageName}`;
  const metaUrl = `${REGISTRY_GITHUB_PACKAGES}/${fullName}`;

  const metaRes = await fetch(metaUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.npm.install-v1+json",
    },
  });
  if (!metaRes.ok) {
    throw new Error(
      `GitHub Packages metadata fetch failed for ${fullName}: ${metaRes.status} ${metaRes.statusText}. ` +
        "Verify FOUNDRY_UI_TOKEN has read:packages on the publishing repo and that the preset is published.",
    );
  }
  const meta = (await metaRes.json()) as {
    "dist-tags"?: { latest?: string };
    versions?: Record<string, { dist?: { tarball?: string } }>;
  };
  const latest = meta["dist-tags"]?.latest;
  const tarballUrl = latest ? meta.versions?.[latest]?.dist?.tarball : undefined;
  if (!latest || !tarballUrl) {
    throw new Error(
      `No latest version or tarball URL for ${fullName} on ${REGISTRY_GITHUB_PACKAGES}.`,
    );
  }

  const tarballRes = await fetch(tarballUrl, { headers: { Authorization: `Bearer ${token}` } });
  if (!tarballRes.ok) {
    throw new Error(
      `Failed to download preset tarball ${tarballUrl}: ${tarballRes.status} ${tarballRes.statusText}.`,
    );
  }
  const tarballBuf = Buffer.from(await tarballRes.arrayBuffer());

  // npm tarballs extract into a top-level `package/` directory.
  const tmpRoot = mkdtempSync(join(tmpdir(), `foundry-preset-${opts.name}-`));
  const tarballPath = join(tmpRoot, "package.tgz");
  writeFileSync(tarballPath, tarballBuf);

  // Use the system `tar` binary — present on macOS, Linux, and Windows 10+
  // (Microsoft ships tar.exe in System32 since 2018). Avoids adding a runtime
  // tar dep for one extraction call.
  const extract = spawnSync("tar", ["-xzf", tarballPath, "-C", tmpRoot], {
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (extract.status !== 0) {
    throw new Error(
      `tar extraction failed for preset '${opts.name}' (exit ${extract.status}): ${extract.stderr?.toString() ?? "unknown error"}.`,
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
  const overlayName = manifest.filesDir ?? "files";
  const overlayDir = join(presetRoot, overlayName);
  if (!existsSync(overlayDir)) {
    throw new Error(
      `Preset '${name}' declares filesDir='${overlayName}' but the directory is missing in the package.`,
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
