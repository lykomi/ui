/**
 * Pack the workspace and point a generated app at the tarballs.
 *
 * Shared by every starter smoke, because they all need the same thing and for
 * the same reason: a scaffold pins PUBLISHED versions, and a smoke that
 * installed those would test the last release rather than the working tree.
 * Packing locally is what makes the check about the change in hand.
 *
 * `pnpm pack`, never `npm pack` — the sibling `@iloveagents/foundry-*` deps
 * carry `workspace:^`, and only pnpm rewrites that into a real range. A tarball
 * built by npm installs nowhere.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

/**
 * How to invoke pnpm here.
 *
 * `PNPM_EXECUTABLE` first: an environment can supply pnpm explicitly without
 * putting a `pnpm` binary on PATH, and then a bare `pnpm` is an ENOENT. Shared
 * rather than copied — the second copy of this had already lost that branch.
 */
export function resolvePnpmCommand() {
  if (process.env.PNPM_EXECUTABLE) {
    return { command: process.env.PNPM_EXECUTABLE, prefixArgs: [] };
  }
  if (process.env.COREPACK_ROOT) {
    const corepackPnpm = join(process.env.COREPACK_ROOT, "dist", "pnpm.js");
    if (existsSync(corepackPnpm)) {
      return { command: process.execPath, prefixArgs: [corepackPnpm] };
    }
  }
  return { command: "pnpm", prefixArgs: [] };
}

/** Every runtime package a generated app can depend on. */
export const WORKSPACE_PACKAGES = [
  "packages/agent",
  "packages/web-primitives",
  "packages/web-ui",
  "packages/web-graph",
  "packages/web-shell",
  "packages/web-voice",
];

const firstJson = (value) => (Array.isArray(value) ? value[0] : value);

/**
 * Pack each package into `packDir`.
 *
 * @returns {Map<string, string>} package name -> `file:` specifier
 */
export function packWorkspace({ root, packDir, packages = WORKSPACE_PACKAGES, pnpm }) {
  mkdirSync(packDir, { recursive: true });
  const tarballs = new Map();
  for (const pkgDir of packages) {
    const output = execFileSync(
      pnpm.command,
      [...pnpm.prefixArgs, "pack", "--json", "--pack-destination", packDir],
      {
        cwd: join(root, pkgDir),
        env: process.env,
        encoding: "utf8",
        stdio: ["ignore", "pipe", "inherit"],
      },
    );
    const pack = firstJson(JSON.parse(output));
    const file = pack.filename.startsWith("/") ? pack.filename : join(packDir, pack.filename);
    tarballs.set(pack.name, `file:${file}`);
  }
  return tarballs;
}

/**
 * Rewrite a generated app's manifest to install the packed tarballs.
 *
 * Both `pnpm.overrides` and the top-level `overrides` are written: the first is
 * what pnpm reads, the second keeps the file honest for anyone else looking at
 * it. Every tarball goes into both, unconditionally — that is what makes the
 * install airtight, and there is no case for a dependency rewrite to catch.
 *
 * The `dependencies` rewrite is a separate job: it stops the manifest LYING.
 * Without it the generated app declares `"0.2.0"` while pnpm quietly installs
 * a `file:` tarball, so anyone reading the app — or any tool that reads the
 * manifest rather than the lockfile — is told the wrong thing. It is
 * deliberately conditional: it retitles what the app already declares and does
 * not add dependencies the preset never asked for.
 */
export function applyLocalPacks(appDir, tarballs) {
  const manifestPath = join(appDir, "package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const generated = manifest.overrides ?? {};
  for (const [name, specifier] of tarballs) {
    if (manifest.dependencies?.[name]) manifest.dependencies[name] = specifier;
  }
  manifest.pnpm = {
    ...(manifest.pnpm ?? {}),
    overrides: {
      ...generated,
      ...(manifest.pnpm?.overrides ?? {}),
      ...Object.fromEntries(tarballs),
    },
  };
  manifest.overrides = { ...generated, ...Object.fromEntries(tarballs) };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return manifest;
}

/**
 * Refuse a scaffold that pins an `@assistant-ui` transitive.
 *
 * The generated app's own overrides live in `pnpm-workspace.yaml`, and adding a
 * `pnpm.overrides` block to package.json makes pnpm read that instead —
 * silently dropping them. So a smoke cannot SEE a bad pin after
 * `applyLocalPacks`, which is exactly how a pinned `@assistant-ui/store`
 * shipped in every scaffold while the smoke stayed green. Check before
 * neutralising.
 */
export function assertNoAssistantUiPins(
  yamlPath,
  { readFileSync: read = readFileSync, existsSync } = {},
) {
  if (existsSync && !existsSync(yamlPath)) return;
  const yaml = read(yamlPath, "utf8");
  for (const pinned of ["@assistant-ui/store", "@assistant-ui/core", "@assistant-ui/tap"]) {
    if (new RegExp(`^\\s+"?${pinned.replace("/", "\\/")}"?\\s*:`, "m").test(yaml)) {
      throw new Error(
        `The scaffold's pnpm-workspace.yaml pins ${pinned}. Pinning a transitive of ` +
          `@assistant-ui/react freezes one node of a graph that keeps moving, and the ` +
          `generated app stops building. Remove it from the template.`,
      );
    }
  }
}
