/**
 * Open-core packaging guards.
 *
 * Four data-driven guards (the customer-isolation + Python guards from the
 * lastspace-origin version were dropped — lykomi-ui is TS-only, no
 * customer-specific code lives here):
 *
 *  1. Banned imports inside `packages/agent/src/` — no React, no DOM, no
 *     `@assistant-ui/*`, no bare `"zustand"`. The MSAL subpath is the
 *     single exception that may import `@azure/msal-browser`.
 *  2. Open-core import-direction graph — each `@lykomi/*`
 *     package may only import from a declared subset of siblings.
 *  3. File-count ceiling on `packages/web-shell/src` — the shell stays
 *     thin (composition layer, not application surface).
 *  4. Version-pin parity — shared deps in `pnpm-workspace.yaml` overrides
 *     stay in sync across workspace `package.json` files.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname!, "../../../..");

// ----------------------------------------------------------------------------
// Configs
// ----------------------------------------------------------------------------

/**
 * Open-core package import graph. For each package, list which `@lykomi/*`
 * packages it MAY import. Empty array = none.
 *
 * Packages that do not yet exist on disk are skipped at runtime by
 * `findPackageDir` so future packages can be wired in here ahead of their
 * extraction.
 */
const OPEN_CORE_GRAPH: Record<string, string[]> = {
  "@lykomi/agent": [],
  "@lykomi/web-primitives": [],
  "@lykomi/web-ui": ["@lykomi/web-primitives", "@lykomi/agent"],
  // The graph package sits ABOVE web-ui, never below it: web-ui must not gain
  // an edge to web-graph, or `react-force-graph-2d` would land in the install
  // of every consumer that only wants a chat.
  "@lykomi/web-graph": ["@lykomi/web-primitives", "@lykomi/web-ui", "@lykomi/agent"],
  "@lykomi/web-3d": ["@lykomi/web-primitives", "@lykomi/agent"],
  "@lykomi/web-shell": ["@lykomi/web-primitives", "@lykomi/web-ui", "@lykomi/agent"],
  // The optional voice tier is a *module*: it composes the UI packages, and
  // nothing composes it. It must never appear in another package's allowed
  // list, or "optional" stops being true.
  //
  // The Azure Voice Live SDK remains in the @iloveagents scope; it is a
  // third-party dependency, not a sibling in this workspace.
  "@lykomi/web-voice": ["@lykomi/web-ui", "@lykomi/agent"],
};

/**
 * Banned bare-package imports inside `packages/agent/src/`.
 *
 * `@lykomi/agent` is the cross-runtime transport — pure TS, zero React,
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

/** File-count ceiling: `packages/web-shell/src` is hard-capped at 15 — the
 *  shell is a thin composition layer (bootstrapShell + ChatModule wiring +
 *  auth provider seam), not application surface. Growth indicates leakage.
 */
const FILE_COUNT_CEILINGS = [{ path: "packages/web-shell/src", ceiling: 15, hardFail: true }];

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
  // 1. Agent package: no React / no assistant-ui / no bare zustand
  describe("@lykomi/agent banned-import guard", () => {
    const agentRoot = findPackageDir("@lykomi/agent");

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

  // 2. Open-core import graph
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
            // LYKOMI UI packages must never import commercial downstream
            // packages (@ltwlf/* today; @lastspace/* was the pre-rename scope);
            // allow-listing is enforced for sibling @lykomi/* deps.
            if (imp.startsWith("@lastspace/") || imp.startsWith("@ltwlf/")) {
              violations.push(
                `${relative(ROOT, file)} -> ${imp} (commercial downstream import forbidden)`,
              );
              continue;
            }
            if (!imp.startsWith("@lykomi/")) continue;
            // Self-imports allowed (subpath exports etc).
            if (imp === pkg || imp.startsWith(`${pkg}/`)) continue;
            // Strip subpath off the imported package.
            const importedPkg = imp.split("/").slice(0, 2).join("/");
            if (!allowed.includes(importedPkg)) {
              violations.push(`${relative(ROOT, file)} -> ${imp}`);
            }
          }
        }
        expect(violations, `${pkg} imported a forbidden package`).toEqual([]);
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
      for (const base of ["packages"]) {
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

    // 4b. The @assistant-ui/tap pin must stay, and must stay below 0.9.13.
    //
    // `@assistant-ui/react@0.15.1` depends on `@assistant-ui/tap: ^0.9.7`, and
    // tap 0.9.13 rewrote its internal `useSyncExternalStore`. assistant-ui was
    // built against the old semantics and does not survive the new ones: the
    // composer silently drops every keystroke, with only a console line about
    // an uncached `getSnapshot` to show for it. Install succeeds, the build
    // succeeds, and the app is dead.
    //
    // Nothing else expresses that constraint — upstream's caret accepts the
    // broken versions — so a pin removed as tidy-up would ship a chat with no
    // composer. Measured: 0.9.8 and 0.9.12 green, 0.9.13/0.9.14/0.9.15 red.
    it("pins @assistant-ui/tap below the release that breaks the composer", () => {
      const workspaceYaml = readFileSync(join(ROOT, "pnpm-workspace.yaml"), "utf8");
      const override = workspaceYaml
        .split("\n")
        .map((line) => line.replace(/#.*$/, "").trim())
        .find((line) => line.startsWith('"@assistant-ui/tap":'));
      expect(
        override,
        "pnpm-workspace.yaml must override @assistant-ui/tap — see the comment beside it",
      ).toBeDefined();

      // Accepts an exact version or a range, and asks the same question of
      // both: can this admit 0.9.13? An exact pin is preferred (a range
      // spanning two good versions permits a SPLIT, which nothing here would
      // report), but the pin's job is the version, so the guard checks that.
      const rank = (major: number, minor: number, patch: number) =>
        major * 1e6 + minor * 1e3 + patch;
      const FIRST_BROKEN = rank(0, 9, 13);
      const constraint = override!.slice(override!.indexOf(":") + 1).trim();
      const bound = /<\s*(\d+)\.(\d+)\.(\d+)/.exec(constraint);
      const exact = /^"(\d+)\.(\d+)\.(\d+)"$/.exec(constraint);
      const parsed = bound ?? exact;
      expect(
        parsed,
        `@assistant-ui/tap must be an exact version or carry an exclusive upper bound, got ${constraint}`,
      ).not.toBeNull();
      const [major, minor, patch] = parsed!.slice(1).map(Number);
      // A `<X` bound is safe when X is at or below the first broken release;
      // an exact version is safe when it is strictly below it.
      const ceiling = bound ? rank(major, minor, patch) : rank(major, minor, patch) + 1;
      expect(
        ceiling <= FIRST_BROKEN,
        `@assistant-ui/tap must stay below 0.9.13; ${constraint} does not`,
      ).toBe(true);
    });

    // 5. Sibling @lykomi/* packages must never be peerDependencies.
    //
    // The four packages ship together as a coordinated `fixed` changesets
    // group, so they belong in `dependencies` with `workspace:*`. As peerDeps
    // they trigger changesets' `shouldBumpMajor` cascade: one `minor` on any
    // sibling exits the strict `^0.x.y` peer range, promotes every dependent
    // to major, and the fixed group then syncs all four to that major.
    //
    // This has fired for real, which is why the published version line has a
    // permanent hole in it. Encoded as a test rather than prose so it cannot
    // quietly stop being true.
    it("no @lykomi/* sibling appears in peerDependencies", () => {
      const violations: string[] = [];
      for (const { dir, json } of workspacePackageJsons()) {
        const peers = (json.peerDependencies ?? {}) as Record<string, string>;
        for (const dep of Object.keys(peers)) {
          if (dep.startsWith("@lykomi/")) {
            violations.push(`${relative(ROOT, dir)} peerDependencies.${dep}=${peers[dep]}`);
          }
        }
      }
      expect(
        violations,
        "sibling @lykomi/* packages must be `dependencies` (workspace:*), never peerDependencies — " +
          "peerDeps trigger the changesets major-bump cascade across the whole fixed group",
      ).toEqual([]);
    });
  });
});
