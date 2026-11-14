/**
 * The one structural rule this package has: `src/adapter/` is the protocol
 * layer. It may name assistant-ui's voice contract, but it must never import
 * React itself or the chat surface.
 *
 * It is what makes the mode policies, the speech queue and the tool
 * round-trip testable against a fake transport rather than a rendered tree —
 * and it is the reason `submitComposerText` is *injected* into the bridge
 * instead of imported by it. Both are easy to undo by reflex ("just import
 * the store here"), so the rule is asserted rather than described.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const PACKAGE_ROOT = join(import.meta.dirname!, "../..");
const ADAPTER_DIR = join(PACKAGE_ROOT, "src/adapter");

const BANNED = ["react", "react-dom", "react/jsx-runtime", "@lykomi/web-ui"];

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return full.endsWith(".ts") || full.endsWith(".tsx") ? [full] : [];
  });
}

function importsOf(content: string): string[] {
  const out: string[] = [];
  const re = /(?:import|export|require)\s*[^"';]*?["']([^"']+)["']/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(content)) !== null) out.push(m[1]!);
  return out;
}

describe("adapter layer", () => {
  it("imports no React and no chat surface", () => {
    const violations: string[] = [];
    for (const file of sourceFiles(ADAPTER_DIR)) {
      for (const imp of importsOf(readFileSync(file, "utf-8"))) {
        if (BANNED.includes(imp)) {
          violations.push(`${relative(PACKAGE_ROOT, file)} -> ${imp}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("has files to check", () => {
    // A rename that empties the directory would make the guard above pass
    // vacuously for the rest of the package's life.
    expect(sourceFiles(ADAPTER_DIR).length).toBeGreaterThan(3);
  });
});
