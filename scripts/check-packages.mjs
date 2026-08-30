import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";

import { resolvePnpmCommand } from "./lib/local-packs.mjs";
import { foundryWorkspaceVersions, scaffoldPinSources } from "./scaffold-pins.mjs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const packages = [
  {
    dir: "packages/agent",
    runtime: true,
  },
  {
    dir: "packages/web-primitives",
    runtime: true,
  },
  {
    dir: "packages/web-ui",
    runtime: true,
  },
  {
    dir: "packages/web-graph",
    runtime: true,
  },
  {
    dir: "packages/web-shell",
    runtime: true,
  },
  {
    dir: "packages/web-voice",
    runtime: true,
  },
  {
    dir: "packages/create-foundry-ui-app",
    runtime: false,
  },
];

const dependencyFields = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
];

let failed = false;

function fail(message) {
  failed = true;
  console.error(`ERROR: ${message}`);
}

function readPackageJson(dir) {
  return JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
}

const pnpmCommand = resolvePnpmCommand();

function assertNoWorkspaceRanges(dir, pkg, source) {
  for (const field of dependencyFields) {
    const deps = pkg[field] ?? {};
    for (const [name, range] of Object.entries(deps)) {
      if (typeof range === "string" && range.startsWith("workspace:")) {
        fail(`${dir} ${source} ${field}.${name} uses non-publishable range ${range}`);
      }
    }
  }
}

function packToTemp(dir) {
  const packDir = join(tmpdir(), "foundry-ui-pack-check");
  execFileSync("mkdir", ["-p", packDir]);
  const raw = execFileSync(
    pnpmCommand.command,
    [...pnpmCommand.prefixArgs, "pack", "--json", "--pack-destination", packDir],
    {
      cwd: dir,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed) ? parsed[0] : parsed;
}

function tarballPath(dir, packed) {
  if (packed.path) return packed.path;
  if (packed.filename?.startsWith("/")) return packed.filename;
  return join(packed.dest ?? join(tmpdir(), "foundry-ui-pack-check"), packed.filename);
}

function listTarballFiles(tarball) {
  const raw = execFileSync("tar", ["-tf", tarball], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return raw
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((file) => file.replace(/^package\//, ""));
}

function readPackageJsonFromTarball(tarballPath) {
  const raw = execFileSync("tar", ["-xOf", tarballPath, "package/package.json"], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return JSON.parse(raw);
}

function packWithPackageJson(dir) {
  const packed = packToTemp(dir);
  const tarball = tarballPath(dir, packed);
  const packedPackageJson = readPackageJsonFromTarball(tarball);
  return {
    pack: {
      files: listTarballFiles(tarball),
      size: statSync(tarball).size,
    },
    packedPackageJson,
  };
}

function assertPackContents(dir, pack, { runtime }) {
  const files = pack.files;
  const has = (path) => files.includes(path);

  if (!has("package.json")) fail(`${dir} tarball is missing package.json`);
  if (!has("LICENSE")) fail(`${dir} tarball is missing LICENSE`);

  if (runtime) {
    if (!has("README.md")) fail(`${dir} runtime tarball is missing README.md`);
    if (!has("dist/index.js")) fail(`${dir} runtime tarball is missing dist/index.js`);
    if (!has("dist/index.d.ts")) fail(`${dir} runtime tarball is missing dist/index.d.ts`);
  }

  for (const file of files) {
    if (runtime && file.startsWith("src/")) {
      fail(`${dir} runtime tarball includes source file ${file}; publish built dist instead`);
    }
    if (file.includes("__tests__") || /\.test\.[cm]?[jt]sx?$/.test(file)) {
      fail(`${dir} tarball includes test file ${file}`);
    }
    if (runtime && (file === "AGENTS.md" || file === "CLAUDE.md" || file === "vitest.config.ts")) {
      fail(`${dir} runtime tarball includes internal file ${file}`);
    }
  }
}

function assertDeclarationExtensions(dir) {
  const distDir = join(dir, "dist");
  const bad = [];

  function visit(currentDir) {
    for (const entry of readdirSync(currentDir)) {
      const path = join(currentDir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        visit(path);
        continue;
      }
      if (!path.endsWith(".d.ts")) continue;
      const content = readFileSync(path, "utf8");
      if (/(from\s+["'][^"']+\.(ts|tsx)["']|import\(["'][^"']+\.(ts|tsx)["']\))/.test(content)) {
        bad.push(path);
      }
    }
  }

  visit(distDir);
  for (const path of bad) {
    fail(`${dir} declaration references unpublished TS source extension: ${path}`);
  }
}

// The scaffold template and preset manifests are not workspace members (the
// template ships its own pnpm-workspace.yaml), so Changesets never bumps their
// foundry pins — check they match the current workspace versions so new users
// don't scaffold pre-1.0 minors behind (pre-1.0 minors are breaking).
// `pnpm changeset:version` runs scripts/sync-template-versions.mjs to keep
// these in step; this guard is the backstop if that is ever bypassed.
function assertScaffoldPinsCurrent() {
  const versions = foundryWorkspaceVersions();

  for (const { file, fields, label } of scaffoldPinSources({ existsSync, readdirSync })) {
    const json = JSON.parse(readFileSync(file, "utf8"));
    for (const field of fields) {
      const container = field.includes(".")
        ? field.split(".").reduce((node, key) => node?.[key], json)
        : json[field];
      for (const [name, range] of Object.entries(container ?? {})) {
        const current = versions[name];
        if (current && range !== current) {
          fail(
            `${label} pins ${name}@${range} but the workspace publishes ${current}; run \`pnpm sync:template-versions\` (${file})`,
          );
        }
      }
    }
  }
}

for (const entry of packages) {
  const pkg = readPackageJson(entry.dir);
  const { pack, packedPackageJson } = packWithPackageJson(entry.dir);
  assertNoWorkspaceRanges(entry.dir, packedPackageJson, "packed package.json");
  assertPackContents(entry.dir, pack, entry);
  if (entry.runtime) assertDeclarationExtensions(entry.dir);
  console.log(
    `${pkg.name}: ${pack.files.length} files, ${(pack.size / 1024).toFixed(1)} KiB packed`,
  );
}

assertScaffoldPinsCurrent();

if (failed) {
  process.exit(1);
}
