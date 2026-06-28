import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "..", "..", "..", "..");
const templateRoot = join(packageRoot, "packages/create-foundry-ui-app/template");

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
    expect(agents).toContain("Package-backed mode");
    expect(agents).toContain("Copy/template mode");
    expect(agents).toContain("`theme` layers in `src/main.tsx`");
    expect(agents).toContain("browser title as `Foundry UI`");
  });

  it("keeps the generated README focused on bootstrap DX", () => {
    const readme = readFileSync(join(templateRoot, "README.md"), "utf-8");

    expect(readme).toContain("## Quick Start");
    expect(readme).toContain("## Update Modes");
    expect(readme).toContain("## Theme The App");
    expect(readme).toContain("## Add A Tool");
    expect(readme).toContain("appTitle: \"Foundry UI\"");
    expect(readme).toContain("AGENTS.md");
    expect(readme).not.toContain("lastspace");
    expect(readme).not.toContain("DWX");
  });
});
