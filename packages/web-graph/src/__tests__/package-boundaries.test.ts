/**
 * Boundary guards for this package.
 *
 * Both rules are the reason the package is shaped the way it is, and both are
 * easy to break with an import that looks harmless:
 *
 *  1. The force engine has exactly one import site, so it stays code-split.
 *  2. Nothing outside `adapters/` knows what Neo4j is, so the visualizer stays
 *     reusable for any graph source.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const SRC = join(import.meta.dirname!, "..");

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "__tests__" || entry === "node_modules" || entry === "dist") continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) out.push(...sourceFiles(path));
    else if (path.endsWith(".ts") || path.endsWith(".tsx")) out.push(path);
  }
  return out;
}

const files = sourceFiles(SRC).map((path) => ({
  path: relative(SRC, path),
  content: readFileSync(path, "utf-8"),
}));

/**
 * Strip comments and string literals.
 *
 * The neutrality rule is about CODE, not prose: a comment saying "mirrors the
 * Neo4j starter's graph_payload.py" is exactly the cross-reference a reader
 * needs, and banning it would push the explanation somewhere nobody looks. What
 * must not exist is a `neo4j` import, identifier or type outside `adapters/`.
 */
const codeOnly = (content: string): string =>
  content
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/\/\/[^\n]*/g, " ")
    .replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""');

/**
 * Comments gone, strings kept — the opposite trade-off from `codeOnly`, and
 * the one an import scan needs. Line comments are only stripped where they
 * START a line, so a `https://` inside a string survives.
 */
const withoutComments = (content: string): string =>
  content.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^[ \t]*\/\/[^\n]*/gm, " ");

const importsOf = (content: string): string[] => {
  const out: string[] = [];
  const re = /(?:import|export)\s*[^"';]*?["']([^"']+)["']/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) out.push(match[1]);
  return out;
};

describe("engine isolation", () => {
  it("imports react-force-graph-2d from exactly one module", () => {
    // More than one import site means the engine is reachable from the root
    // barrel and stops being code-split — every consumer then downloads and
    // parses force-graph plus the d3 stack whether or not they draw a graph.
    // Comments stripped first — but NOT with `codeOnly`, which also blanks
    // string literals and would erase the very specifiers this reads. Prose
    // matters here: a doc comment explaining a force-graph behaviour is not an
    // import, and reading raw content made documenting the engine trip the
    // guard.
    const importers = files
      .filter((file) =>
        importsOf(withoutComments(file.content)).some((spec) => spec.includes("force-graph")),
      )
      .map((file) => file.path);
    expect(importers).toEqual(["graph-canvas.tsx"]);
  });

  it("reaches the engine module only through a lazy import", () => {
    const view = files.find((file) => file.path === "graph-view.tsx")!;
    expect(view.content).toContain('lazy(() => import("./graph-canvas.tsx"))');
    const eager = files.filter(
      (file) =>
        file.path !== "graph-view.tsx" &&
        file.path !== "graph-canvas.tsx" &&
        /^import\s[^;]*from\s+"\.[^"]*graph-canvas\.tsx"/m.test(file.content),
    );
    // A type-only import is fine — it disappears at build time.
    const valueImports = eager.filter((file) => !/import type/.test(file.content));
    expect(valueImports.map((file) => file.path)).toEqual([]);
  });
});

describe("source neutrality", () => {
  it("has no Neo4j identifier or import outside adapters/", () => {
    // The visualizer takes a source-neutral payload. The moment a component
    // special-cases Neo4j, every other graph source becomes a second-class
    // citizen and the package stops being reusable. Comments may still refer
    // to it — see `codeOnly`.
    const offenders = files
      .filter((file) => !file.path.startsWith("adapters/"))
      .filter((file) => /neo4j/i.test(codeOnly(file.content)))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("does not re-export the Neo4j adapter from the root barrel", () => {
    // It has its own entry point precisely so it can be left out.
    const barrel = files.find((file) => file.path === "index.ts")!;
    expect(importsOf(barrel.content).some((spec) => spec.includes("adapters"))).toBe(false);
  });

  it("keeps the payload contract free of React", () => {
    for (const path of ["model.ts", "adapters/neo4j.ts"]) {
      const file = files.find((candidate) => candidate.path === path)!;
      expect(importsOf(file.content), `${path} must stay renderer-agnostic`).not.toContain("react");
    }
  });
});

describe("packaging", () => {
  const pkg = JSON.parse(readFileSync(join(SRC, "..", "package.json"), "utf-8")) as Record<
    string,
    Record<string, unknown>
  >;

  it("exports each entry point the README documents", () => {
    expect(Object.keys(pkg.exports)).toEqual([
      ".",
      "./adapters/neo4j",
      "./assistant-ui",
      "./styles.css",
    ]);
  });

  it("keeps @assistant-ui/react an optional peer", () => {
    // It is only needed by the ./assistant-ui entry point; a hard dependency
    // would pull the chat runtime into a dashboard that just draws a graph.
    expect(pkg.peerDependencies["@assistant-ui/react"]).toBeDefined();
    expect(pkg.peerDependenciesMeta["@assistant-ui/react"]).toEqual({ optional: true });
    expect(pkg.dependencies["@assistant-ui/react"]).toBeUndefined();
  });

  it("depends on siblings through the workspace, never as peers", () => {
    // Sibling packages in peerDependencies trigger the changesets
    // shouldBumpMajor cascade — the mistake that burned 1.0.0 and 1.0.1.
    for (const [name, range] of Object.entries(pkg.dependencies)) {
      if (name.startsWith("@iloveagents/")) expect(range).toBe("workspace:^");
    }
    for (const name of Object.keys(pkg.peerDependencies)) {
      expect(name.startsWith("@iloveagents/")).toBe(false);
    }
  });
});

describe("theming", () => {
  it("paints no hard-coded colour — every canvas colour comes from a token", () => {
    // A canvas cannot read CSS variables, so colours have to be resolved from
    // the DOM and passed in. The failure mode is quiet: one `#666` and that
    // element stays light-grey forever, including in dark mode, and nothing
    // errors. `theme.ts` is exempt: it holds the documented fallback palette
    // for when no stylesheet is present, and it must not itself depend on a
    // token resolving.
    const offenders = files
      .filter((file) => file.path !== "theme.ts")
      .filter((file) => /#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\(|oklch\(/.test(codeOnly(file.content)))
      .map((file) => file.path);
    expect(offenders).toEqual([]);
  });

  it("resolves the tokens the stylesheet actually defines", () => {
    // A typo in a token name resolves to empty and silently falls back, so the
    // graph would quietly stop following the host's theme.
    const css = readFileSync(join(SRC, "styles.css"), "utf-8");
    const theme = files.find((file) => file.path === "theme.ts")!.content;
    for (const token of theme.match(/"--graph-\d"/g) ?? []) {
      expect(css, `styles.css is missing ${token}`).toContain(`${token.slice(1, -1)}:`);
    }
  });

  it("defines every graph token for dark mode too", () => {
    const css = readFileSync(join(SRC, "styles.css"), "utf-8");
    const [light, dark] = css.split(".dark");
    expect(dark, "styles.css has no .dark block").toBeDefined();
    const names = [...(light.match(/--graph-\d(?=:)/g) ?? [])];
    expect(names.length).toBeGreaterThan(0);
    for (const name of names) expect(dark, `${name} has no dark value`).toContain(`${name}:`);
  });
});
