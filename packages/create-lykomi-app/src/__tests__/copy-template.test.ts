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
      JSON.stringify(
        {
          name: "__PROJECT_NAME__",
          version: "0.0.0",
          private: true,
          dependencies: {
            "@lykomi/agent": "^0.1.0",
            "@lykomi/web-primitives": "^0.1.0",
            "@lykomi/web-shell": "^0.1.0",
            "@lykomi/web-ui": "^0.1.0",
            react: "^19.0.0",
          },
        },
        null,
        2,
      ),
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

  it("preserves Python dunder files like __init__.py", async () => {
    // Double-underscore prefix is a Python convention for special files
    // (`__init__.py`, `__main__.py`). The single-underscore-→-dotfile
    // rule must NOT touch them — otherwise scaffolds with Python sub-dirs
    // get broken `._init__.py` etc.
    mkdirSync(join(sourceDir, "py-pkg"));
    writeFileSync(join(sourceDir, "py-pkg", "__init__.py"), "# package marker\n");
    writeFileSync(join(sourceDir, "py-pkg", "__main__.py"), "# entry point\n");
    await copyTemplate({ sourceDir, targetDir, projectName: "my-app" });
    expect(existsSync(join(targetDir, "py-pkg", "__init__.py"))).toBe(true);
    expect(existsSync(join(targetDir, "py-pkg", "__main__.py"))).toBe(true);
    expect(existsSync(join(targetDir, "py-pkg", "._init__.py"))).toBe(false);
  });

  it("rewrites package.json#name via parse-edit-stringify (preserves other fields)", async () => {
    await copyTemplate({ sourceDir, targetDir, projectName: "my-shiny-app" });
    const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf-8"));
    expect(pkg.name).toBe("my-shiny-app");
    expect(pkg.version).toBe("0.0.0");
    expect(pkg.private).toBe(true);
  });

  it("stamps exact LYKOMI UI package versions into package.json", async () => {
    await copyTemplate({
      sourceDir,
      targetDir,
      projectName: "my-app",
      lykomiPackageVersion: "0.4.1",
    });
    const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf-8"));
    expect(pkg.dependencies["@lykomi/agent"]).toBe("0.4.1");
    expect(pkg.dependencies["@lykomi/web-primitives"]).toBe("0.4.1");
    expect(pkg.dependencies["@lykomi/web-shell"]).toBe("0.4.1");
    expect(pkg.dependencies["@lykomi/web-ui"]).toBe("0.4.1");
    expect(pkg.dependencies.react).toBe("^19.0.0");
  });

  it("rewrites __PROJECT_NAME__ in Python too, which is where it was silently not", async () => {
    // Every scaffold shipped `FastAPI(title="__PROJECT_NAME__ Agent")`
    // verbatim, because `.py` was missing from the text-extension allowlist —
    // so the generated app served the placeholder as its own OpenAPI title.
    writeFileSync(join(sourceDir, "main.py"), 'app = FastAPI(title="__PROJECT_NAME__ Agent")\n');
    await copyTemplate({ sourceDir, targetDir, projectName: "my-app" });
    const main = readFileSync(join(targetDir, "main.py"), "utf8");
    expect(main).toContain('title="my-app Agent"');
    expect(main).not.toContain("__PROJECT_NAME__");
  });

  it("rewrites __PROJECT_NAME__ in markdown text files via sentinel", async () => {
    await copyTemplate({ sourceDir, targetDir, projectName: "my-app" });
    const readme = readFileSync(join(targetDir, "README.md"), "utf-8");
    expect(readme).toBe("# my-app\n\nHello.\n");
    expect(readme).not.toContain("__PROJECT_NAME__");
  });

  it("rewrites all occurrences when there are multiple per file", async () => {
    writeFileSync(join(sourceDir, "multi.md"), "__PROJECT_NAME__\n__PROJECT_NAME__\n");
    await copyTemplate({ sourceDir, targetDir, projectName: "x" });
    expect(readFileSync(join(targetDir, "multi.md"), "utf-8")).toBe("x\nx\n");
  });
});
