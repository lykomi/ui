// Shared definition of "where does a scaffolded app's @iloveagents/foundry-*
// pins come from" — used by both the sync step (`pnpm changeset:version`) and
// the guard (`pnpm pack:check`) so the two can never disagree about scope.
//
// Sources:
//   1. The base template's package.json (every scaffold starts from it).
//   2. Each preset manifest's optional `extraDependencies` — presets that
//      `extends: "default"` inherit the base pins, but a preset MAY add its
//      own, and those would otherwise drift unnoticed.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const RUNTIME_PACKAGE_DIRS = [
  "packages/agent",
  "packages/web-primitives",
  "packages/web-ui",
  "packages/web-graph",
  "packages/web-shell",
  // The template pins this like any other runtime package. Voice is opt-in
  // at RUNTIME (`VITE_VOICE_PROXY_URL`), not at scaffold time, so the pin is
  // always present and always has to stay in step with what is published.
  "packages/web-voice",
];

const CLI_ROOT = "packages/create-foundry-ui-app";
export const TEMPLATE_PACKAGE_JSON = join(CLI_ROOT, "template/package.json");
const PRESETS_DIR = join(CLI_ROOT, "presets");

/** Package name → version, for the published runtime packages. */
export function foundryWorkspaceVersions() {
  return Object.fromEntries(
    RUNTIME_PACKAGE_DIRS.map((dir) => {
      const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      return [pkg.name, pkg.version];
    }),
  );
}

/**
 * Every file that pins `@iloveagents/foundry-*` for generated apps.
 * `fields` are paths into the JSON ("dependencies", or a dotted path for
 * preset manifests).
 */
export function scaffoldPinSources({ existsSync, readdirSync }) {
  const sources = [
    {
      file: TEMPLATE_PACKAGE_JSON,
      fields: ["dependencies", "devDependencies", "peerDependencies"],
      label: "scaffold template",
    },
  ];

  if (existsSync(PRESETS_DIR)) {
    for (const entry of readdirSync(PRESETS_DIR, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const manifest = join(PRESETS_DIR, entry.name, "manifest.json");
      if (!existsSync(manifest)) continue;
      sources.push({
        file: manifest,
        fields: [
          "extraDependencies",
          "extraDependencies.dependencies",
          "extraDependencies.devDependencies",
        ],
        label: `preset "${entry.name}"`,
      });
    }
  }

  return sources;
}
