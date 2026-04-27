import { mkdtempSync, rmSync, existsSync, readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { applyOverlay, copyTemplate, mergeExtraDependencies } from "../copy-template.js";

describe("applyOverlay", () => {
  let baseDir: string;
  let overlayDir: string;
  let targetDir: string;

  beforeEach(() => {
    baseDir = mkdtempSync(join(tmpdir(), "cf-base-"));
    overlayDir = mkdtempSync(join(tmpdir(), "cf-overlay-"));
    targetDir = mkdtempSync(join(tmpdir(), "cf-dst-"));

    // Base template: package.json + src/main.tsx + src/index.css.
    writeFileSync(
      join(baseDir, "package.json"),
      JSON.stringify(
        { name: "__PROJECT_NAME__", version: "0.0.0", dependencies: { react: "^18" } },
        null,
        2,
      ),
    );
    mkdirSync(join(baseDir, "src"));
    writeFileSync(join(baseDir, "src", "main.tsx"), "// base main\n");
    writeFileSync(join(baseDir, "src", "index.css"), "/* base css */\n");

    // Overlay: replaces src/main.tsx + src/index.css, adds _npmrc + docker-compose.yml.
    mkdirSync(join(overlayDir, "src"));
    writeFileSync(join(overlayDir, "src", "main.tsx"), "// overlay main for __PROJECT_NAME__\n");
    writeFileSync(join(overlayDir, "src", "index.css"), "/* overlay css */\n");
    writeFileSync(join(overlayDir, "_npmrc"), "@lastspace:registry=https://npm.pkg.github.com/\n");
    writeFileSync(
      join(overlayDir, "docker-compose.yml"),
      "services:\n  mongo:\n    image: mongo:8\n",
    );
  });

  afterEach(() => {
    rmSync(baseDir, { recursive: true, force: true });
    rmSync(overlayDir, { recursive: true, force: true });
    rmSync(targetDir, { recursive: true, force: true });
  });

  it("overlays files on top of an already-scaffolded target", async () => {
    await copyTemplate({ sourceDir: baseDir, targetDir, projectName: "my-app" });
    expect(readFileSync(join(targetDir, "src", "main.tsx"), "utf-8")).toBe("// base main\n");

    await applyOverlay({ overlayDir, targetDir, projectName: "my-app" });
    expect(readFileSync(join(targetDir, "src", "main.tsx"), "utf-8")).toBe(
      "// overlay main for my-app\n",
    );
    expect(readFileSync(join(targetDir, "src", "index.css"), "utf-8")).toBe("/* overlay css */\n");
  });

  it("renames _npmrc to .npmrc", async () => {
    await copyTemplate({ sourceDir: baseDir, targetDir, projectName: "my-app" });
    await applyOverlay({ overlayDir, targetDir, projectName: "my-app" });
    expect(existsSync(join(targetDir, ".npmrc"))).toBe(true);
    expect(existsSync(join(targetDir, "_npmrc"))).toBe(false);
  });

  it("does NOT rewrite the base template's package.json#name", async () => {
    await copyTemplate({ sourceDir: baseDir, targetDir, projectName: "my-app" });
    // Sanity: base copy set name correctly.
    expect(JSON.parse(readFileSync(join(targetDir, "package.json"), "utf-8")).name).toBe("my-app");

    // Overlay carries no package.json — name must stay.
    await applyOverlay({ overlayDir, targetDir, projectName: "different-name" });
    expect(JSON.parse(readFileSync(join(targetDir, "package.json"), "utf-8")).name).toBe("my-app");
  });

  it("substitutes __PROJECT_NAME__ sentinels in overlay text files", async () => {
    await copyTemplate({ sourceDir: baseDir, targetDir, projectName: "my-app" });
    await applyOverlay({ overlayDir, targetDir, projectName: "my-app" });
    expect(readFileSync(join(targetDir, "src", "main.tsx"), "utf-8")).toContain("for my-app");
  });
});

describe("mergeExtraDependencies", () => {
  let targetDir: string;

  beforeEach(() => {
    targetDir = mkdtempSync(join(tmpdir(), "cf-merge-"));
    writeFileSync(
      join(targetDir, "package.json"),
      JSON.stringify(
        {
          name: "my-app",
          version: "0.0.0",
          dependencies: { react: "^18" },
          devDependencies: { vite: "^7" },
        },
        null,
        2,
      ),
    );
  });

  afterEach(() => {
    rmSync(targetDir, { recursive: true, force: true });
  });

  it("merges extraDependencies into the existing dependencies map", async () => {
    await mergeExtraDependencies({
      targetDir,
      extraDependencies: { "@lastspace/spaces-web-ui": "^0.1.0" },
    });
    const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf-8"));
    expect(pkg.dependencies).toEqual({
      "@lastspace/spaces-web-ui": "^0.1.0",
      react: "^18",
    });
  });

  it("merges extraDevDependencies into the existing devDependencies map", async () => {
    await mergeExtraDependencies({
      targetDir,
      extraDevDependencies: { "@types/node": "^24" },
    });
    const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf-8"));
    expect(pkg.devDependencies).toEqual({
      "@types/node": "^24",
      vite: "^7",
    });
  });

  it("sorts the resulting dep maps alphabetically", async () => {
    await mergeExtraDependencies({
      targetDir,
      extraDependencies: { zustand: "^5", axios: "^1" },
    });
    const pkg = JSON.parse(readFileSync(join(targetDir, "package.json"), "utf-8"));
    expect(Object.keys(pkg.dependencies)).toEqual(["axios", "react", "zustand"]);
  });

  it("is a no-op when neither extraDependencies nor extraDevDependencies is provided", async () => {
    const before = readFileSync(join(targetDir, "package.json"), "utf-8");
    await mergeExtraDependencies({ targetDir });
    const after = readFileSync(join(targetDir, "package.json"), "utf-8");
    expect(after).toBe(before);
  });
});
