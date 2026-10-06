import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, it } from "vitest";
// @ts-expect-error Smoke helper is deliberately a plain Node ESM module.
import { checkStarterChunks } from "../../../../scripts/lib/check-starter-chunks.mjs";
const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});
function fixture(file: string, size: number, eager = false) {
  const dir = mkdtempSync(join(tmpdir(), "foundry-chunk-gate-"));
  dirs.push(dir);
  mkdirSync(join(dir, "assets"));
  mkdirSync(join(dir, ".vite"));
  writeFileSync(join(dir, "assets", file), Buffer.alloc(size));
  writeFileSync(
    join(dir, ".vite", "manifest.json"),
    JSON.stringify({
      "index.html": {
        file: "assets/index.js",
        isEntry: true,
        imports: eager ? ["parser"] : [],
        dynamicImports: ["parser"],
      },
      parser: { file: `assets/${file}` },
    }),
  );
  return dir;
}
it("keeps the ordinary 500 kB budget", () => {
  expect(() => checkStarterChunks(fixture("app-abc.js", 500_001))).toThrow("exceeds");
});
it("allows the bounded Mermaid parser only as a lazy asset", () => {
  expect(() => checkStarterChunks(fixture("vendor-mermaid-parser-abc.js", 700_000))).not.toThrow();
  expect(() => checkStarterChunks(fixture("vendor-mermaid-parser-abc.js", 700_000, true))).toThrow(
    "initial",
  );
  expect(() => checkStarterChunks(fixture("vendor-mermaid-parser-abc.js", 750_001))).toThrow(
    "exceeds",
  );
});
