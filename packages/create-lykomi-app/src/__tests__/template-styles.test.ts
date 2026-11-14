import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const testDir = dirname(fileURLToPath(import.meta.url));
const packageRoot = join(testDir, "..", "..", "..", "..");

describe("template styles", () => {
  it("imports the LYKOMI UI style resource exported by the package", () => {
    const templateCss = readFileSync(
      join(packageRoot, "packages/create-lykomi-app/template/src/index.css"),
      "utf-8",
    );

    expect(templateCss).toContain('@import "@lykomi/web-ui/styles.css";');
    expect(templateCss).toContain('@source "../node_modules/@lykomi/web-ui/dist";');
    expect(templateCss).toContain('@source "../node_modules/@lykomi/web-shell/dist";');
    expect(templateCss).toContain('@source "../node_modules/@lykomi/web-primitives/dist";');
  });

  it("ships the LYKOMI UI style resource declared in package exports", () => {
    const packageJson = JSON.parse(
      readFileSync(join(packageRoot, "packages/web-ui/package.json"), "utf-8"),
    ) as { exports: Record<string, string> };
    const stylesExport = packageJson.exports["./styles.css"];

    expect(stylesExport).toBe("./dist/styles.css");
    expect(existsSync(join(packageRoot, "packages/web-ui", stylesExport))).toBe(true);

    const stylesCss = readFileSync(join(packageRoot, "packages/web-ui", stylesExport), "utf-8");
    expect(stylesCss).toContain("@theme inline");
    expect(stylesCss).toContain("--color-background: var(--background);");
    expect(stylesCss).toContain("--color-sidebar-selected: var(--sidebar-selected);");
  });
});
