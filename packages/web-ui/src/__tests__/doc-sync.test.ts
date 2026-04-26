/**
 * Guard test: documentation stays in sync with code.
 *
 * Catches drift before it reaches main. Agents add scripts, rename
 * commands, or create new packages — this test ensures the instruction
 * files and playbook reflect reality.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = join(import.meta.dirname!, "../../../..");

function readJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, "utf-8"));
}

function readText(path: string): string {
  return readFileSync(path, "utf-8");
}

/** Find directories containing AGENTS.md (packages and apps). */
function findAgentsDirs(): string[] {
  const dirs: string[] = [];
  for (const base of ["packages", "apps"]) {
    const baseDir = join(ROOT, base);
    if (!existsSync(baseDir)) continue;
    for (const entry of readdirSync(baseDir)) {
      const dir = join(baseDir, entry);
      if (statSync(dir).isDirectory() && existsSync(join(dir, "AGENTS.md"))) {
        dirs.push(dir);
      }
    }
  }
  // Root AGENTS.md
  if (existsSync(join(ROOT, "AGENTS.md"))) {
    dirs.push(ROOT);
  }
  return dirs;
}

describe("documentation sync guards", () => {
  describe("every AGENTS.md directory has CLAUDE.md with @AGENTS.md import", () => {
    const dirs = findAgentsDirs();

    for (const dir of dirs) {
      const label = dir === ROOT ? "root" : relative(ROOT, dir);

      it(`${label}/CLAUDE.md exists and imports @AGENTS.md`, () => {
        const claudePath = join(dir, "CLAUDE.md");
        expect(existsSync(claudePath), `${label}/CLAUDE.md is missing`).toBe(true);
        const content = readText(claudePath);
        expect(
          content.trimStart().startsWith("@AGENTS.md"),
          `${label}/CLAUDE.md must start with @AGENTS.md`,
        ).toBe(true);
      });
    }
  });

  describe("test scripts documented in AGENTS.md or docs/COMMANDS.md", () => {
    const pkg = readJson(join(ROOT, "package.json")) as {
      scripts: Record<string, string>;
    };
    const agentsMd = readText(join(ROOT, "AGENTS.md"));
    const commandsPath = join(ROOT, "docs/COMMANDS.md");
    const commandsMd = existsSync(commandsPath) ? readText(commandsPath) : "";
    const corpus = `${agentsMd}\n${commandsMd}`;

    // All test:* scripts should be mentioned in AGENTS.md or docs/COMMANDS.md
    // (the latter is the SSOT for the full command list, linked from AGENTS.md).
    // Exclude dev-only convenience scripts (headed, coverage, docker).
    const exclude = ["coverage", "docker", "headed"];
    const testScripts = Object.keys(pkg.scripts).filter(
      (s) => s.startsWith("test:") && !exclude.some((e) => s.includes(e)),
    );

    for (const script of testScripts) {
      it(`"${script}" is documented in AGENTS.md or docs/COMMANDS.md`, () => {
        expect(
          corpus.includes(script),
          `Script "${script}" exists in package.json but is not mentioned in AGENTS.md or docs/COMMANDS.md. ` +
            `Add it to the Commands/Testing section in one of them.`,
        ).toBe(true);
      });
    }
  });

  describe("playwright versions stay compatible", () => {
    // The Playwright browser runner (`@playwright/test`) and the MCP server
    // (`@playwright/mcp`, wired in .mcp.json) share a browser-binary surface.
    // If they drift, the agent's MCP browser and the CI test runner can end
    // up on different Playwright cores with subtle behaviour differences.
    // Guard: when `@playwright/mcp` is pinned in package.json, its major must
    // match `@playwright/test`. `.mcp.json` must reference the MCP server.

    it(".mcp.json wires the playwright MCP server", () => {
      const mcp = readJson(join(ROOT, ".mcp.json")) as {
        mcpServers?: Record<string, { args?: string[] }>;
      };
      expect(mcp.mcpServers?.playwright, ".mcp.json must define a `playwright` server").toBeTruthy();
      const args = mcp.mcpServers!.playwright.args ?? [];
      const hasMcp = args.some((a) => a.includes("@playwright/mcp"));
      expect(hasMcp, ".mcp.json `playwright` server must reference @playwright/mcp").toBe(true);
    });

    it("if @playwright/mcp is pinned, major matches @playwright/test", () => {
      const pkg = readJson(join(ROOT, "package.json")) as {
        devDependencies?: Record<string, string>;
        dependencies?: Record<string, string>;
      };
      const all = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
      const testVer = all["@playwright/test"];
      const mcpVer = all["@playwright/mcp"];
      expect(testVer, "@playwright/test must be pinned in package.json").toBeTruthy();
      if (!mcpVer) {
        // MCP not pinned (using @latest via npx) — nothing to check.
        return;
      }
      const major = (v: string) => v.replace(/^[^\d]*/, "").split(".")[0];
      expect(major(mcpVer), `@playwright/mcp major must match @playwright/test`).toBe(major(testVer));
    });
  });

  describe("playbook exists and references test tiers", () => {
    const playbookPath = join(ROOT, "e2e/PLAYBOOK.md");

    it("e2e/PLAYBOOK.md exists", () => {
      expect(existsSync(playbookPath)).toBe(true);
    });

    it("playbook references key test commands", () => {
      const content = readText(playbookPath);
      for (const cmd of ["test:unit:web", "test:e2e:smoke", "test:e2e:ci"]) {
        expect(
          content.includes(cmd),
          `PLAYBOOK.md should reference "${cmd}"`,
        ).toBe(true);
      }
    });

    it("AGENTS.md links to the playbook", () => {
      const agentsMd = readText(join(ROOT, "AGENTS.md"));
      expect(
        agentsMd.includes("PLAYBOOK.md"),
        "AGENTS.md should link to e2e/PLAYBOOK.md",
      ).toBe(true);
    });
  });
});
