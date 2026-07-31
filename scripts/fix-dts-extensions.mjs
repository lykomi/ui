import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const targetDir = process.argv[2];

if (!targetDir) {
  console.error("Usage: node scripts/fix-dts-extensions.mjs <dist-dir>");
  process.exit(1);
}

function visit(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    const stat = statSync(path);
    if (stat.isDirectory()) {
      visit(path);
      continue;
    }
    if (!path.endsWith(".d.ts")) continue;

    const before = readFileSync(path, "utf8");
    const after = before.replace(
      /(from\s+["'][^"']+|import\(["'][^"']+)\.(ts|tsx)(["'])/g,
      "$1.js$3",
    );
    if (after !== before) {
      writeFileSync(path, after);
    }
  }
}

visit(targetDir);
