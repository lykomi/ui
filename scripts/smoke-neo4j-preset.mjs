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

import { checkStarterChunks } from "./lib/check-starter-chunks.mjs";

import {
  applyLocalPacks,
  assertNoAssistantUiPins,
  packWorkspace,
  resolvePnpmCommand,
} from "./lib/local-packs.mjs";

const root = resolve(import.meta.dirname, "..");
const workDir = mkdtempSync(join(tmpdir(), "lykomi-ui-neo4j-"));
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
if (!tarballs.has("@lykomi/web-graph")) {
  throw new Error("web-graph was not packed — the preset would install it from npm.");
}

step("Scaffolding --preset neo4j");
run("node", [
  "packages/create-lykomi-app/dist/index.mjs",
  appDir,
  "--preset",
  "neo4j",
  "--no-install",
]);

assertNoAssistantUiPins(join(appDir, "pnpm-workspace.yaml"), { existsSync });

// The preset pins web-graph EXACTLY, and `sync-template-versions.mjs`
// rewrites that pin on every release. If the two ever disagree the scaffold
// installs a version the workspace is not building — so check the manifest
// names the workspace version before the packs paper over it.
const workspaceGraphVersion = JSON.parse(
  readFileSync(join(root, "packages/web-graph/package.json"), "utf8"),
).version;
const scaffoldGraphPin = JSON.parse(readFileSync(join(appDir, "package.json"), "utf8"))
  .dependencies["@lykomi/web-graph"];
if (scaffoldGraphPin !== workspaceGraphVersion) {
  throw new Error(
    `The neo4j preset pins @lykomi/web-graph ${scaffoldGraphPin}, but the ` +
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

checkStarterChunks(join(appDir, "dist"));

const assetsDir = join(appDir, "dist", "assets");
const assets = readdirSync(assetsDir);
const readAll = (ext) =>
  assets
    .filter((f) => f.endsWith(ext))
    .map((f) => readFileSync(join(assetsDir, f), "utf8"))
    .join("\n");

step("Checking the bundle");

if (!assets.some((file) => file.startsWith("lykomi-workbench-"))) {
  throw new Error(
    "The workbench preview was folded into the initial vendor bundle instead of its lazy chunk.",
  );
}

// `react-force-graph-2d`, `react-kapsule` and `web-graph` all contain
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
//
// Checking for `--graph-1` does NOT test that: the palette is declared in
// `styles.css`, so importing the stylesheet is enough and the token survives
// with the `@source` line deleted. Measured — removing it drops 1743 bytes and
// exactly 23 utility classes while `--graph-1` stays put.
//
// So this checks utilities that ONLY exist because Tailwind scanned the
// package's `dist`. Any one is enough to prove scanning happened; several are
// listed so that refactoring one away in the package does not turn CI red for
// the wrong reason. If scanning stops, all of them go at once.
const css = readAll(".css");
const scannedOnlyUtilities = [
  "divide-border\\/60", // the inspector's property table
  "decoration-dotted",
  "underline-offset-2",
  "max-h-64",
];
if (!scannedOnlyUtilities.some((utility) => css.includes(utility))) {
  throw new Error(
    "None of the graph chrome's utility classes are in the built CSS, so Tailwind did not " +
      "scan the package. src/index.css needs its @source directive for " +
      "@lykomi/web-graph/dist — without it the graph builds and renders unstyled.",
  );
}
if (!css.includes("--graph-1")) {
  throw new Error("The --graph-1 palette is missing — web-graph/styles.css is not imported.");
}

// The cards and the client tools are registered by two different calls, and
// have to be checked separately.
//
// `foundry.graph` and `graph_show` both come from `registerGraphClientTools()`
// alone, so asserting only those would stay green with the whole `toolUIs`
// fragment deleted — and then every SERVER graph tool renders as a generic
// result and nothing folds it into the panel. The server tool names appear
// only where `makeGraphToolUI` binds them, so they are what pins the cards.
const js = readAll(".js");
for (const marker of ["foundry.graph", "graph_show"]) {
  if (!js.includes(marker)) {
    throw new Error(
      `"${marker}" is absent from the bundle — registerGraphClientTools() is not wired in.`,
    );
  }
}
// `graph_schema` and `graph_expand_node` appear NOWHERE in
// @lykomi/web-graph's dist, so in this bundle they can only come
// from the scaffold's own `makeGraphToolUI` bindings. `graph_read_cypher` is
// deliberately not in this list: the package carries it in a JSDoc example, and
// a comment that survives bundling would make the check vacuous.
// All five bindings, not a sample: removing the vector-search or write card
// leaves the other names present and the smoke green, while a configured
// deployment's vector/write results become generic cards that never reach
// the panel. Each of these appears nowhere in the package's dist, so in this
// bundle they can only have come from the scaffold's own bindings.
for (const toolName of [
  "graph_schema",
  "graph_expand_node",
  "graph_vector_search",
  "graph_write_cypher",
]) {
  if (!js.includes(toolName)) {
    throw new Error(
      `"${toolName}" is absent from the bundle — its makeGraphToolUI card is not registered, ` +
        `so that tool's results would render as a generic card and never reach the panel.`,
    );
  }
}

console.log(`\n✓ neo4j preset scaffolds, installs, builds and bundles correctly (${appDir})`);
