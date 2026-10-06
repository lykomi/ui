import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/** All app chunks retain the 500 kB gate. One indivisible lazy parser has its own cap. */
export function checkStarterChunks(dist) {
  const manifest = JSON.parse(readFileSync(join(dist, ".vite", "manifest.json"), "utf8"));
  const initial = new Set();
  const visited = new Set();
  function visit(key) {
    if (visited.has(key)) return;
    visited.add(key);
    const entry = manifest[key];
    if (!entry) throw new Error(`Missing bundle manifest entry: ${key}`);
    initial.add(entry.file);
    for (const imported of entry.imports ?? []) visit(imported);
  }
  for (const [key, entry] of Object.entries(manifest)) {
    if (entry.isEntry) visit(key);
  }
  if (!visited.size) throw new Error("Bundle manifest has no application entry.");
  for (const file of readdirSync(join(dist, "assets"))) {
    if (!file.endsWith(".js")) continue;
    const size = statSync(join(dist, "assets", file)).size;
    const parser = /^vendor-mermaid-parser-[\w-]+\.js$/.test(file);
    if (parser) {
      const emitted = Object.values(manifest).some((entry) => entry.file === `assets/${file}`);
      if (!emitted || initial.has(`assets/${file}`)) {
        throw new Error("Mermaid parser must stay outside the initial application bundle.");
      }
    }
    const limit = parser ? 750_000 : 500_000;
    if (size > limit) throw new Error(`Starter chunk ${file} exceeds ${limit} bytes (${size}).`);
  }
}
