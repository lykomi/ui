// Sync the scaffold template's @iloveagents/foundry-* pins to the versions the
// workspace publishes.
//
// The template is deliberately NOT a workspace member (it ships its own
// pnpm-workspace.yaml so generated apps install cleanly), which means
// `changeset version` cannot bump its dependency pins. Without this step the
// template silently falls a release behind on every publish and new users
// scaffold stale — breaking pre-1.0, where minors are allowed to break.
//
// Wired into `pnpm changeset:version` so the Version Packages PR carries the
// template bump; `pnpm pack:check` fails the build if the two ever diverge.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { foundryWorkspaceVersions, scaffoldPinSources } from "./scaffold-pins.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const versions = foundryWorkspaceVersions();
let changed = false;

for (const { file, fields, label } of scaffoldPinSources({ existsSync, readdirSync })) {
  const json = readJson(file);
  const changes = [];

  for (const field of fields) {
    // Presets nest their pins under manifest.extraDependencies.<field>.
    const container = field.includes(".")
      ? field.split(".").reduce((node, key) => node?.[key], json)
      : json[field];
    for (const [name, range] of Object.entries(container ?? {})) {
      const current = versions[name];
      if (current && range !== current) {
        container[name] = current;
        changes.push(`${name}: ${range} → ${current}`);
      }
    }
  }

  if (changes.length > 0) {
    changed = true;
    writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`updated ${label} (${file}):`);
    for (const change of changes) console.log(`  ${change}`);
  }
}

if (!changed) console.log("scaffold pins already in sync");
