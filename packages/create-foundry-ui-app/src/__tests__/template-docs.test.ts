import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "..", "..", "..", "..");
const templateRoot = join(packageRoot, "packages/create-foundry-ui-app/template");
const foundryIqRoot = join(packageRoot, "packages/create-foundry-ui-app/presets/foundry-iq/files");
const presetsRoot = join(packageRoot, "packages/create-foundry-ui-app/presets");
const neo4jRoot = join(presetsRoot, "neo4j/files");

describe("template docs", () => {
  it("ships coding-agent instructions for generated apps", () => {
    const agentsPath = join(templateRoot, "AGENTS.md");
    const claudePath = join(templateRoot, "CLAUDE.md");

    expect(existsSync(agentsPath)).toBe(true);
    expect(readFileSync(claudePath, "utf-8")).toBe("@AGENTS.md\n");

    const agents = readFileSync(agentsPath, "utf-8");
    expect(agents).toContain("agent/app/tools.py");
    expect(agents).toContain("AGENT_TOOLS");
    expect(agents).toContain("FOUNDRY_PROJECT_ENDPOINT");
    expect(agents).toContain("FOUNDRY_MODEL");
    expect(agents).toContain("MCPStreamableHTTPTool");
    expect(agents).toContain("Package-backed mode");
    expect(agents).toContain("Copy/template mode");
    expect(agents).toContain("`theme` layers in `src/main.tsx`");
    expect(agents).toContain("browser title as `Foundry UI`");
  });

  it("keeps the __PROJECT_NAME__ sentinel intact in the README title", () => {
    // Prettier normalizes __text__ to **text** — a `pnpm format` without the
    // .prettierignore entry corrupts the sentinel and every scaffolded app
    // ships a README titled "**PROJECT_NAME**" instead of the app name.
    const readme = readFileSync(join(templateRoot, "README.md"), "utf-8");

    expect(readme.startsWith("# __PROJECT_NAME__")).toBe(true);
    expect(readme).not.toContain("**PROJECT_NAME**");
  });

  it("keeps the sentinel intact in EVERY preset README, not just the template", () => {
    // This already went wrong once: .prettierignore covered only the base
    // template, so `pnpm format` rewrote the foundry-iq preset's H1 and every
    // app scaffolded from it shipped a README titled "**PROJECT_NAME**".
    // Looping over the directory means a preset added later is covered the
    // day it lands, without anyone remembering to extend this test.
    const presets = readdirSync(presetsRoot, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name);
    expect(presets.length).toBeGreaterThan(0);

    for (const preset of presets) {
      const readmePath = join(presetsRoot, preset, "files/README.md");
      if (!existsSync(readmePath)) continue;
      const readme = readFileSync(readmePath, "utf-8");
      expect(readme.startsWith("# __PROJECT_NAME__"), `${preset} README title`).toBe(true);
      expect(readme, `${preset} README`).not.toContain("**PROJECT_NAME**");
    }
  });

  it("keeps the generated README focused on bootstrap DX", () => {
    const readme = readFileSync(join(templateRoot, "README.md"), "utf-8");

    expect(readme).toContain("## Quick Start");
    expect(readme).toContain("## Update Modes");
    expect(readme).toContain("## Theme The App");
    expect(readme).toContain("## Add A Tool");
    expect(readme).toContain("## Add An MCP Server");
    expect(readme).toContain("MCPStreamableHTTPTool");
    expect(readme).toContain('appTitle: "Foundry UI"');
    expect(readme).toContain("AGENTS.md");
    expect(readme).not.toContain("DWX");
  });

  it("uses the documented Foundry IQ MCP tool argument shape", () => {
    const toolSource = readFileSync(join(foundryIqRoot, "agent/app/foundry_iq.py"), "utf-8");

    expect(toolSource).toContain('"arguments": {"queries": [query]}');
    expect(toolSource).not.toContain('"arguments": {"query": query}');
  });

  it("ships a Foundry IQ search result tool card", () => {
    const main = readFileSync(join(foundryIqRoot, "src/main.tsx"), "utf-8");
    const toolUi = readFileSync(
      join(foundryIqRoot, "src/tools/search-results-tool-ui.tsx"),
      "utf-8",
    );

    expect(main).toContain("foundryIqModule");
    expect(toolUi).toContain('toolName: "foundry_iq_search"');
    expect(toolUi).toContain("ToolCallCard");
    expect(toolUi).toContain("SearchResultsBody");
    expect(toolUi).toContain("ActivityViewer");
    expect(toolUi).toContain("activitySummary");
  });
});

describe("neo4j preset", () => {
  it("ships the graph tools and keeps read-only enforcement on the server", () => {
    const tools = readFileSync(join(neo4jRoot, "agent/app/graph_tools.py"), "utf-8");
    const db = readFileSync(join(neo4jRoot, "agent/app/graph_db.py"), "utf-8");

    expect(tools).toContain("graph_schema");
    expect(tools).toContain("graph_read_cypher");
    expect(tools).toContain("db.index.vector.queryNodes");
    // READ access mode is the actual boundary; the keyword scan is only a
    // friendlier error. Losing this line would silently make the read tool
    // able to write.
    expect(db).toContain("neo4j.READ_ACCESS");
  });

  it("registers the write tool only when writes are enabled", () => {
    // There is no human-approval round trip in this stack, so an approval-mode
    // gate would emit a request nothing answers and the run would stall. The
    // gate has to be whether the tool exists at all.
    const tools = readFileSync(join(neo4jRoot, "agent/app/graph_tools.py"), "utf-8");
    expect(tools).toContain("if graph_db.writes_enabled():");
    expect(tools).not.toContain('approval_mode="always_require"');
  });

  it("builds Cypher as constants, never by interpolation", () => {
    // Model-authored values go through `parameters`. An f-string or .format()
    // near a Cypher keyword is how that guarantee gets lost.
    for (const file of ["agent/app/graph_tools.py", "agent/app/graph_db.py"]) {
      const source = readFileSync(join(neo4jRoot, file), "utf-8");
      expect(source, `${file} builds Cypher with an f-string`).not.toMatch(
        /f"""[^"]*\b(MATCH|RETURN|MERGE|CREATE)\b/i,
      );
      expect(source, `${file} builds Cypher with .format()`).not.toMatch(
        /\b(MATCH|RETURN|MERGE|CREATE)\b[^\n]*"\s*\.format\(/i,
      );
    }
  });

  it("keeps the vendor-graph chunk rule above the react rule", () => {
    // "react-force-graph-2d" and "react-kapsule" both start with "react", so
    // a rule ordered after the react rule drops the whole force engine into
    // vendor-react and onto the critical path.
    // Compare CODE positions, not any occurrence of the text — the comment
    // above the rule explains the trap, and a naive indexOf would match it.
    const vite = readFileSync(join(neo4jRoot, "vite.config.ts"), "utf-8");
    const code = vite
      .split("\n")
      .filter((line) => !line.trim().startsWith("//") && !line.trim().startsWith("*"))
      .join("\n");
    // The rules match on the package name (the last node_modules segment),
    // not on the pnpm store path, which embeds peer names.
    const graphRule = code.indexOf('pkg.includes("force-graph")');
    const reactRule = code.indexOf('pkg.startsWith("react/")');
    expect(graphRule, "vendor-graph rule missing").toBeGreaterThan(-1);
    expect(reactRule, "vendor-react rule missing").toBeGreaterThan(-1);
    expect(graphRule).toBeLessThan(reactRule);
  });

  it("tells Tailwind to scan the graph package, or the panel renders unstyled", () => {
    const css = readFileSync(join(neo4jRoot, "src/index.css"), "utf-8");
    expect(css).toContain("@iloveagents/foundry-web-graph/dist");
  });

  it("wires the panel renderer and the agent's client tools", () => {
    const module = readFileSync(join(neo4jRoot, "src/tools/graph-module.tsx"), "utf-8");
    expect(module).toContain("registerGraphPanelRenderer");
    expect(module).toContain("registerGraphClientTools");
    expect(module).toContain("makeGraphToolUI");
  });
});
