import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "..", "..", "..", "..");
const templateRoot = join(packageRoot, "packages/create-foundry-ui-app/template");
const foundryIqRoot = join(packageRoot, "packages/create-foundry-ui-app/presets/foundry-iq/files");

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
