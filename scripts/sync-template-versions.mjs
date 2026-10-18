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
//
// Rewriting a pin does not by itself release the CLI, and the pins only reach
// users in a released create-lykomi-app: a scaffold always uses the pins
// its CLI version shipped with. So when this script moves a pin, it also gives
// the CLI a patch release in the same Version Packages PR — unless a changeset
// already bumped it. Leaving that to a hand-written changeset failed twice
// (web-voice 0.1.1 while the CLI still pinned 0.1.0; foundry 0.33.0 while
// `npx create-foundry-ui-app` still scaffolded 0.32.4).

import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { CLI_ROOT, foundryWorkspaceVersions, scaffoldPinSources } from "./scaffold-pins.mjs";

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
const versions = foundryWorkspaceVersions();
let changed = false;
const moved = [];

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
    moved.push(...changes);
    writeFileSync(file, `${JSON.stringify(json, null, 2)}\n`);
    console.log(`updated ${label} (${file}):`);
    for (const change of changes) console.log(`  ${change}`);
  }
}

if (!changed) {
  console.log("scaffold pins already in sync");
} else {
  releaseCli(moved);
}

/**
 * Give create-lykomi-app a patch release carrying the moved pins, unless
 * a changeset already bumped it in this version run. "Already bumped" is
 * measured against the committed package.json: `changeset version` edits the
 * working tree, so a version that differs from HEAD was bumped by this run.
 */
function releaseCli(pinChanges) {
  const packageFile = join(CLI_ROOT, "package.json");
  const pkg = readJson(packageFile);
  const committed = JSON.parse(
    execFileSync("git", ["show", `HEAD:${packageFile}`], { encoding: "utf8" }),
  ).version;
  if (pkg.version !== committed) {
    console.log(`${pkg.name} already bumped to ${pkg.version} by a changeset`);
    return;
  }
  const [major, minor, patch] = pkg.version.split(".").map(Number);
  pkg.version = `${major}.${minor}.${patch + 1}`;
  writeFileSync(packageFile, `${JSON.stringify(pkg, null, 2)}\n`);

  const changelogFile = join(CLI_ROOT, "CHANGELOG.md");
  const changelog = readFileSync(changelogFile, "utf8");
  const heading = `# ${pkg.name}\n\n`;
  const pins = [...new Set(pinChanges)].map((change) => `  - ${change}`).join("\n");
  const entry =
    `## ${pkg.version}\n\n### Patch Changes\n\n` +
    `- Release the starter with the updated Foundry package pins:\n\n${pins}\n\n`;
  writeFileSync(
    changelogFile,
    changelog.startsWith(heading)
      ? heading + entry + changelog.slice(heading.length)
      : heading + entry + changelog,
  );
  console.log(`released ${pkg.name} ${pkg.version} with the new pins`);
}
