/**
 * Guard test: @lastspace/web-ui must never import from @lastspace/spaces-web-ui.
 * This prevents SPACES code from leaking back into the React UI core package.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function findFiles(dir: string, ext: string[]): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (entry === "node_modules" || entry === "__tests__") continue;
    if (statSync(full).isDirectory()) {
      results.push(...findFiles(full, ext));
    } else if (ext.some((e) => full.endsWith(e))) {
      results.push(full);
    }
  }
  return results;
}

describe("@lastspace/web-ui import boundaries", () => {
  const srcDir = join(import.meta.dirname!, "..");
  const files = findFiles(srcDir, [".ts", ".tsx"]);

  it("must not import from @lastspace/spaces-web-ui", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (content.includes("@lastspace/spaces-web-ui")) {
        violations.push(file.replace(srcDir + "/", ""));
      }
    }
    expect(violations).toEqual([]);
  });

  it("must not import from @content-editor/react (legacy name)", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (content.includes("@content-editor/react")) {
        violations.push(file.replace(srcDir + "/", ""));
      }
    }
    expect(violations).toEqual([]);
  });

  it("must not use @/ path aliases (uses relative imports)", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf-8");
      if (/from ["']@\//.test(content)) {
        violations.push(file.replace(srcDir + "/", ""));
      }
    }
    expect(violations).toEqual([]);
  });
});
