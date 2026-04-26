/**
 * Open-core packaging guards (epic #90).
 *
 * Four data-driven guards that scaffold the rules from issue #92:
 *
 *  1. Customer-isolation — core paths must not import from `solutions/`.
 *  2. Open-core import-direction graph — `@lastspace/agent` cannot import
 *     other `@lastspace/*` packages; `web-ui` may import `web-primitives`
 *     and `agent`; etc.
 *     Activates per-package as packages are created (graceful no-op when a
 *     target package doesn't exist yet).
 *  3. File-count ceiling on `apps/web/src/` and `apps/web-api/src/`.
 *     Warning mode pre-extraction (logs counter, doesn't fail). Flip
 *     `hardFail: true` once #98 lands.
 *  4. Version-pin parity — shared deps in `pnpm-workspace.yaml` overrides
 *     stay in sync across workspace `package.json` files.
 *
 * Add new packages/rules to the config blocks at the top of this file as
 * the open-core extraction progresses (#94/#95/#96/#98/#99).
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname!, "../../../..");

// ----------------------------------------------------------------------------
// Configs — edit these as the extraction progresses.
// ----------------------------------------------------------------------------

/** Paths that must not import customer-specific code from `solutions/`. */
const CUSTOMER_ISOLATED_TS = ["apps/web/src", "packages"];
const CUSTOMER_ISOLATED_PY = ["apps/web-api", "apps/spaces"];

/**
 * Open-core package import graph. For each package, list which `@lastspace/*`
 * packages it MAY import. Empty array = none.
 *
 * Packages that do not yet exist on disk are skipped at runtime by
 * `findPackageDir`, so future packages can be wired in here ahead of their
 * extraction PR (#95 `@lastspace/agent`, #98 `@lastspace/web-shell`,
 * #99 `@lastspace/spaces-web-ui`).
 */
const OPEN_CORE_GRAPH: Record<string, string[]> = {
  "@lastspace/agent": [],
  "@lastspace/web-primitives": [],
  "@lastspace/web-ui": ["@lastspace/web-primitives", "@lastspace/agent"],
  "@lastspace/web-shell": ["@lastspace/web-primitives", "@lastspace/web-ui", "@lastspace/agent"],
  "@lastspace/spaces-web-ui": [
    "@lastspace/web-primitives",
    "@lastspace/web-ui",
    "@lastspace/web-shell",
    "@lastspace/agent",
  ],
};

/**
 * Banned bare-package imports inside `packages/agent/src/`.
 *
 * `@lastspace/agent` is the cross-runtime transport — pure TS, zero React,
 * zero `@assistant-ui/*`. The MSAL subpath (`packages/agent/src/msal/`) may
 * pull in `@azure/msal-browser` (dynamic import keeps it optional). Bare
 * `"zustand"` is banned everywhere — must use `"zustand/vanilla"`.
 */
const AGENT_BANNED_IMPORTS = [
  { specifier: "react", scope: "all" as const },
  { specifier: "react-dom", scope: "all" as const },
  { specifier: "react/jsx-runtime", scope: "all" as const },
  { specifierPrefix: "@assistant-ui/", scope: "all" as const },
  { specifier: "@azure/msal-react", scope: "all" as const },
  // bare "zustand" is the React entry — agent must use "zustand/vanilla".
  { specifierExact: "zustand", scope: "all" as const },
  // msal-browser is allowed only under src/msal/.
  { specifier: "@azure/msal-browser", scope: "non-msal" as const },
];

/** File-count ceilings on host-shell directories.
 *
 *  `apps/web/src` is hard-capped at 30 — the customer-app surface is
 *  the bootstrap, customer pages, customer Jobs UI, and CSS. The
 *  Spaces UI lives in `@lastspace/spaces-web-ui`. Growth past 30
 *  indicates leakage from the Spaces module back into the customer app.
 *
 *  `packages/web-shell/src` is hard-capped at 15 — the shell is a thin
 *  composition layer; growth indicates leakage.
 */
const FILE_COUNT_CEILINGS = [
  { path: "apps/web/src", ceiling: 30, hardFail: true },
  { path: "apps/web-api/src", ceiling: 20, hardFail: false },
  { path: "packages/web-shell/src", ceiling: 15, hardFail: true },
];

/**
 * Shared deps where all consumers must agree on the major version.
 * Rooted in `pnpm-workspace.yaml` overrides — once a customer's package.json
 * declares an incompatible major, pnpm overrides hide the drift at install
 * time, but the public package metadata is wrong.
 */
const SHARED_DEPS_REQUIRED_MAJOR = [
  { name: "react-router", expectedMajor: "7" },
  { name: "@assistant-ui/react", expectedMajor: "0" },
  { name: "@ag-ui/client", expectedMajor: "0" },
  { name: "@ag-ui/core", expectedMajor: "0" },
];

// ----------------------------------------------------------------------------
// Helpers
// ----------------------------------------------------------------------------

function findFiles(dir: string, exts: string[], skip: Set<string>): string[] {
  if (!existsSync(dir)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (skip.has(entry)) continue;
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) out.push(...findFiles(full, exts, skip));
    else if (exts.some((e) => full.endsWith(e))) out.push(full);
  }
  return out;
}

function findPackageDir(name: string): string | null {
  const pkgDir = join(ROOT, "packages");
  if (!existsSync(pkgDir)) return null;
  for (const entry of readdirSync(pkgDir)) {
    const candidate = join(pkgDir, entry);
    const pkgJsonPath = join(candidate, "package.json");
    if (existsSync(pkgJsonPath)) {
      try {
        const json = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
        if (json.name === name) return candidate;
      } catch {
        /* ignore malformed */
      }
    }
  }
  return null;
}

function importsOf(content: string): string[] {
  const out: string[] = [];
  // ES imports + dynamic imports + re-exports
  const re = /(?:import|export|require)\s*[^"';]*?["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) out.push(m[1]);
  return out;
}

// ----------------------------------------------------------------------------
// Tests
// ----------------------------------------------------------------------------

describe("open-core guards", () => {
  // 1. Customer-isolation
  describe("customer isolation: core paths cannot import from solutions/", () => {
    for (const tsPath of CUSTOMER_ISOLATED_TS) {
      it(`TS in ${tsPath} has no solutions/* imports`, () => {
        const dir = join(ROOT, tsPath);
        if (!existsSync(dir)) return; // path doesn't exist — skip
        const files = findFiles(
          dir,
          [".ts", ".tsx"],
          new Set(["node_modules", "dist", "__tests__", "tests"]),
        );
        const violations: string[] = [];
        for (const file of files) {
          const content = readFileSync(file, "utf-8");
          for (const imp of importsOf(content)) {
            if (
              imp.startsWith("solutions/") ||
              imp.includes("/solutions/") ||
              imp.startsWith("@lastspace/solutions") // reserved future namespace
            ) {
              violations.push(`${relative(ROOT, file)} -> ${imp}`);
              break;
            }
          }
        }
        expect(violations, `Customer-specific imports leaked into ${tsPath}`).toEqual([]);
      });
    }

    for (const pyPath of CUSTOMER_ISOLATED_PY) {
      it(`Python in ${pyPath} has no solutions imports`, () => {
        const dir = join(ROOT, pyPath);
        if (!existsSync(dir)) return;
        const files = findFiles(
          dir,
          [".py"],
          new Set(["node_modules", ".venv", "__pycache__", "tests"]),
        );
        const violations: string[] = [];
        // Match `import solutions.foo` or `from solutions.foo import x`.
        const re = /^\s*(?:from\s+solutions(?:\.|\s)|import\s+solutions(?:\.|\s|$))/m;
        for (const file of files) {
          const content = readFileSync(file, "utf-8");
          if (re.test(content)) violations.push(relative(ROOT, file));
        }
        expect(violations, `Customer-specific imports leaked into ${pyPath}`).toEqual([]);
      });
    }
  });

  // 2a. Agent package: no React / no assistant-ui / no bare zustand
  describe("@lastspace/agent banned-import guard", () => {
    const agentRoot = findPackageDir("@lastspace/agent");

    if (!agentRoot) {
      it.skip("agent package not yet extracted", () => undefined);
    } else {
      const files = findFiles(
        join(agentRoot, "src"),
        [".ts", ".tsx"],
        new Set(["node_modules", "dist", "__tests__"]),
      );

      function isUnderMsal(filePath: string): boolean {
        const rel = relative(agentRoot!, filePath);
        return rel.startsWith(`src/msal/`) || rel.startsWith(`src${"/"}msal${"/"}`);
      }

      for (const rule of AGENT_BANNED_IMPORTS) {
        const label =
          (rule as { specifier?: string }).specifier ??
          (rule as { specifierPrefix?: string }).specifierPrefix ??
          (rule as { specifierExact?: string }).specifierExact!;

        it(`no source file imports "${label}" (scope: ${rule.scope})`, () => {
          const violations: string[] = [];
          for (const file of files) {
            if (rule.scope === "non-msal" && isUnderMsal(file)) continue;
            const content = readFileSync(file, "utf-8");
            for (const imp of importsOf(content)) {
              const matches =
                ("specifierExact" in rule && imp === rule.specifierExact) ||
                ("specifier" in rule && imp === rule.specifier) ||
                ("specifierPrefix" in rule &&
                  rule.specifierPrefix !== undefined &&
                  imp.startsWith(rule.specifierPrefix));
              if (matches) violations.push(`${relative(ROOT, file)} -> ${imp}`);
            }
          }
          expect(
            violations,
            `${label} import leaked into packages/agent/src/${
              rule.scope === "non-msal" ? " (outside msal/)" : ""
            }`,
          ).toEqual([]);
        });
      }
    }
  });

  // 2b. Open-core import graph
  describe("open-core package import graph", () => {
    for (const [pkg, allowed] of Object.entries(OPEN_CORE_GRAPH)) {
      it(`${pkg} only imports from [${allowed.join(", ") || "none"}]`, () => {
        const dir = findPackageDir(pkg);
        if (!dir) return; // package not yet extracted — skip
        const files = findFiles(
          join(dir, "src"),
          [".ts", ".tsx"],
          new Set(["node_modules", "dist", "__tests__"]),
        );
        const violations: string[] = [];
        for (const file of files) {
          const content = readFileSync(file, "utf-8");
          for (const imp of importsOf(content)) {
            if (!imp.startsWith("@lastspace/")) continue;
            // Self-imports allowed (subpath exports etc).
            if (imp === pkg || imp.startsWith(`${pkg}/`)) continue;
            // Strip subpath off the imported package.
            const importedPkg = imp.split("/").slice(0, 2).join("/");
            if (!allowed.includes(importedPkg)) {
              violations.push(`${relative(ROOT, file)} -> ${imp}`);
            }
          }
        }
        expect(
          violations,
          `${pkg} imported a forbidden @lastspace/* package`,
        ).toEqual([]);
      });
    }
  });

  // 3. File-count ceiling (warning + optional hard-fail)
  describe("file-count ceilings on host directories", () => {
    for (const { path, ceiling, hardFail } of FILE_COUNT_CEILINGS) {
      it(`${path} ${hardFail ? "must" : "should"} stay ≤ ${ceiling} files`, () => {
        const dir = join(ROOT, path);
        if (!existsSync(dir)) return;
        const files = findFiles(
          dir,
          [".ts", ".tsx", ".py"],
          new Set(["node_modules", ".venv", "__pycache__", "dist", "__tests__"]),
        );
        if (hardFail) {
          expect(
            files.length,
            `${path} has ${files.length} files; ceiling is ${ceiling}. Move features into packages.`,
          ).toBeLessThanOrEqual(ceiling);
        } else {
          // Warning-mode: log if over ceiling but don't fail. Flip to hardFail
          // once host-shell extraction (#98) lands.
          if (files.length > ceiling) {
            // eslint-disable-next-line no-console
            console.warn(
              `[file-count guard] ${path} has ${files.length} files (ceiling ${ceiling}). Hard-fail enabled once #98 lands.`,
            );
          }
          expect(files.length).toBeGreaterThanOrEqual(0); // always passes; just records
        }
      });
    }
  });

  // 4. Version-pin parity
  describe("shared deps stay in sync across workspace package.jsons", () => {
    function workspacePackageJsons(): { dir: string; json: Record<string, unknown> }[] {
      const out: { dir: string; json: Record<string, unknown> }[] = [];
      for (const base of ["packages", "apps"]) {
        const baseDir = join(ROOT, base);
        if (!existsSync(baseDir)) continue;
        for (const entry of readdirSync(baseDir)) {
          const dir = join(baseDir, entry);
          const pkgJson = join(dir, "package.json");
          if (existsSync(pkgJson)) {
            try {
              out.push({ dir, json: JSON.parse(readFileSync(pkgJson, "utf-8")) });
            } catch {
              /* ignore */
            }
          }
        }
      }
      return out;
    }

    function depMajor(spec: string): string | null {
      // Strip leading ^, ~, >=, =, etc.
      const m = spec.match(/(\d+)/);
      return m ? m[1] : null;
    }

    for (const { name, expectedMajor } of SHARED_DEPS_REQUIRED_MAJOR) {
      it(`${name} declared at major ${expectedMajor} in every package.json that declares it`, () => {
        const violations: string[] = [];
        for (const { dir, json } of workspacePackageJsons()) {
          const buckets = ["dependencies", "peerDependencies", "devDependencies"] as const;
          for (const bucket of buckets) {
            const deps = (json[bucket] ?? {}) as Record<string, string>;
            const spec = deps[name];
            if (!spec) continue;
            const major = depMajor(spec);
            if (major !== expectedMajor) {
              violations.push(`${relative(ROOT, dir)} ${bucket}.${name}=${spec}`);
            }
          }
        }
        expect(
          violations,
          `${name} version drift detected; pnpm-workspace.yaml override hides it at install time but published metadata is wrong`,
        ).toEqual([]);
      });
    }
  });
});
