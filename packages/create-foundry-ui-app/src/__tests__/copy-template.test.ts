import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { copyTemplate } from "../copy-template.js";

describe("copyTemplate", () => {
  let sourceDir: string;
  let targetDir: string;

  beforeEach(() => {
    sourceDir = mkdtempSync(join(tmpdir(), "cf-src-"));
    targetDir = mkdtempSync(join(tmpdir(), "cf-dst-"));
    writeFileSync(
      join(sourceDir, "package.json"),
      JSON.stringify({ name: "__PROJECT_NAME__", version: "0.0.0", private: true }, null, 2),
    );
    writeFileSync(join(sourceDir, "_gitignore"), "node_modules/\n");
    writeFileSync(join(sourceDir, "README.md"), "# __PROJECT_NAME__\n\nHello.\n");
    mkdirSync(join(sourceDir, "src"));
    writeFileSync(join(sourceDir, "src", "index.ts"), "export const x = 1;\n");
  });

  afterEach(() => {
    rmSync(sourceDir, { recursive: true, force: true });
    rmSync(targetDir, { recursive: true, force: true });
  });

  it("copies all files recursively", async () => {
    await copyTemplate({ sourceDir, targetDir, projectName: "my-app" });
    expect(existsSync(join(targetDir, "package.json"))).toBe(true);
    expect(existsSync(join(targetDir, "src", "index.ts"))).toBe(true);
    expect(readFileSync(join(targetDir, "src", "index.ts"), "utf-8")).toBe("export const x = 1;\n");
  });

  it("renames _gitignore to .gitignore", async () => {
    await copyTemplate({ sourceDir, targetDir, projectName: "my-app" });
    expect(existsSync(join(targetDir, ".gitignore"))).toBe(true);
    expect(existsSync(join(targetDir, "_gitignore"))).toBe(false);
  });

  it("rewrites package.json#name via parse-edit-stringify (preserves other fields)", async () => {
    await copyTemplate({ sourceDir, targetDir, projectName: "my-shiny-app" });
    const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("my-shiny-app");
    expect(pkg.version).toBe("0.0.0");
    expect(pkg.private).toBe(true);
  });

  it("rewrites __PROJECT_NAME__ in markdown text files via sentinel", async () => {
    await copyTemplate({ sourceDir, targetDir, projectName: "my-app" });
    const readme = readFileSync(join(targetDir, "README.md"), "utf-8");
    expect(readme).toBe("# my-app\n\nHello.\n");
    expect(readme).not.toContain("__PROJECT_NAME__");
  });

  it("rewrites all occurrences when there are multiple per file", async () => {
    writeFileSync(
      join(sourceDir, "multi.md"),
      "__PROJECT_NAME__\n__PROJECT_NAME__\n",
    );
    await copyTemplate({ sourceDir, targetDir, projectName: "x" });
    expect(readFileSync(join(targetDir, "multi.md"), "utf-8")).toBe("x\nx\n");
  });
});
