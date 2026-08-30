/**
 * Build the `neo4j` starter from the working tree and check what it produced.
 *
 * The default-preset smoke covers the shared template; this covers the graph
 * preset, which until now had no automated coverage at all — every claim about
 * it was verified by hand, once, and nothing re-checked it on the next change.
 *
 * What is asserted here is deliberately narrow: things that break SILENTLY.
 * A wrong chunk order still builds. A missing Tailwind `@source` still builds.
 * A preset pin naming a version that does not exist still builds, until an
 * install. None of it fails loudly, and all of it reaches the user.
 *
 * The agent's behaviour is not tested here — that is the preset's own pytest
 * suite, which runs against a real database. This is about the bundle.
 */

import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readdirSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

import { applyLocalPacks, assertNoAssistantUiPins, packWorkspace } from "./lib/local-packs.mjs";

const root = resolve(import.meta.dirname, "..");
const workDir = mkdtempSync(join(tmpdir(), "foundry-ui-neo4j-"));
const packDir = join(workDir, "packs");

// `--out <dir>` puts the scaffold somewhere the caller chose, so CI can run the
// preset's own pytest suite against the SAME app this built rather than
// scaffolding and installing a second one.
const outIndex = process.argv.indexOf("--out");
if (
  outIndex !== -1 &&
  (!process.argv[outIndex + 1] || process.argv[outIndex + 1].startsWith("-"))
) {
  console.error("Usage: node scripts/smoke-neo4j-preset.mjs [--out <dir>]");
  process.exit(1);
}
const appDir = outIndex === -1 ? join(workDir, "app") : resolve(process.argv[outIndex + 1]);

function resolvePnpmCommand() {
  if (process.env.COREPACK_ROOT) {
    const corepackPnpm = join(process.env.COREPACK_ROOT, "dist", "pnpm.js");
    if (existsSync(corepackPnpm)) {
      return { command: process.execPath, prefixArgs: [corepackPnpm] };
    }
  }
  return { command: "pnpm", prefixArgs: [] };
}
const pnpm = resolvePnpmCommand();

const run = (command, args, options = {}) =>
  execFileSync(command, args, {
    cwd: options.cwd ?? root,
    env: process.env,
    stdio: "inherit",
    timeout: options.timeoutMs,
  });

const step = (message) => console.log(`\n▸ ${message}`);

step("Packing the workspace");
const tarballs = packWorkspace({ root, packDir, pnpm });
if (!tarballs.has("@iloveagents/foundry-web-graph")) {
  throw new Error("foundry-web-graph was not packed — the preset would install it from npm.");
}

step("Scaffolding --preset neo4j");
run("node", [
  "packages/create-foundry-ui-app/dist/index.mjs",
  appDir,
  "--preset",
  "neo4j",
  "--no-install",
]);

assertNoAssistantUiPins(join(appDir, "pnpm-workspace.yaml"), { existsSync });

// The preset pins foundry-web-graph EXACTLY, and `sync-template-versions.mjs`
// rewrites that pin on every release. If the two ever disagree the scaffold
// installs a version the workspace is not building — so check the manifest
// names the workspace version before the packs paper over it.
const workspaceGraphVersion = JSON.parse(
  readFileSync(join(root, "packages/web-graph/package.json"), "utf8"),
).version;
const scaffoldGraphPin = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"))
  .dependencies["@iloveagents/foundry-web-graph"];
if (scaffoldGraphPin !== workspaceGraphVersion) {
  throw new Error(
    `The neo4j preset pins @iloveagents/foundry-web-graph ${scaffoldGraphPin}, but the ` +
      `workspace builds ${workspaceGraphVersion}. Run \`pnpm sync:template-versions\`.`,
  );
}

applyLocalPacks(appDir, tarballs);

step("Installing from the packed workspace");
run(pnpm.command, [...pnpm.prefixArgs, "install", "--frozen-lockfile=false"], {
  cwd: appDir,
  timeoutMs: 6 * 60_000,
});

step("Typechecking and building the generated app");
run(pnpm.command, [...pnpm.prefixArgs, "build"], { cwd: appDir, timeoutMs: 5 * 60_000 });

const assetsDir = join(appDir, "dist", "assets");
const assets = readdirSync(assetsDir);
const readAll = (ext) =>
  assets
    .filter((f) => f.endsWith(ext))
    .map((f) => readFileSync(join(assetsDir, f), "utf8"))
    .join("\n");

step("Checking the bundle");

// `react-force-graph-2d`, `react-kapsule` and `foundry-web-graph` all contain
// "react", so the vendor-graph rule in vite.config.ts has to come BEFORE the
// react rule. Get that wrong and the whole force engine lands in vendor-react:
// still builds, still runs, and every visitor downloads d3 to read a chat.
const graphChunks = assets.filter((f) => f.includes("vendor-graph"));
if (graphChunks.length === 0) {
  throw new Error(
    "No vendor-graph chunk. The manualChunks rule in vite.config.ts is not matching — " +
      "check that the vendor-graph case comes before the react one.",
  );
}

// `wrapperElementType` is react-kapsule's — the React wrapper around the force
// engine, and the exact code that changes chunk when the rules are misordered.
// Checking for a chunk NAME is not enough and was the first thing tried: the
// engine's non-React dependencies (d3-force, float-tooltip) match the graph
// rule on their own, so `vendor-graph-engine` still exists while everything
// with "react" in its path has moved into `vendor-react`. Verified by
// building both ways: this marker sits in exactly one chunk, and which one
// flips.
const holdsWrapper = (file) =>
  readFileSync(join(assetsDir, file), "utf8").includes("wrapperElementType");
const reactChunks = assets.filter((f) => f.includes("vendor-react"));
if (reactChunks.some(holdsWrapper)) {
  throw new Error(
    "The React force-graph wrapper is in vendor-react. The manualChunks rules in " +
      "vite.config.ts are out of order — the vendor-graph case must come before the " +
      '`id.includes("react")` one, or every visitor downloads the force engine to read a chat.',
  );
}
if (!graphChunks.some(holdsWrapper)) {
  throw new Error(
    "The React force-graph wrapper is in neither vendor-graph nor vendor-react. The " +
      "chunking has changed shape — re-check vite.config.ts against this assertion.",
  );
}

// Tailwind v4 cannot infer classes from package output without an explicit
// `@source`. Without it the graph chrome renders unstyled — a build that
// succeeds and a UI that is visibly broken.
const css = readAll(".css");
if (!css.includes("--graph-1")) {
  throw new Error(
    "The graph palette is missing from the built CSS. src/index.css needs its " +
      "@source directive for @iloveagents/foundry-web-graph/dist.",
  );
}

// The card, the panel renderer and the client tools only exist if the module
// registered them. A scaffold that builds but registers nothing renders every
// graph result as a plain tool card.
const js = readAll(".js");
for (const marker of ["foundry.graph", "graph_show"]) {
  if (!js.includes(marker)) {
    throw new Error(
      `"${marker}" is absent from the bundle — src/tools/graph-module.tsx is not wired in.`,
    );
  }
}

console.log(`\n✓ neo4j preset scaffolds, installs, builds and bundles correctly (${appDir})`);
