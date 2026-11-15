// Plugin skills are canonical; templates carry portable, generated local copies.
import { readdirSync, readFileSync, mkdirSync, writeFileSync, existsSync, rmSync } from "node:fs";
import { resolve, relative, dirname } from "node:path";

const root = resolve(import.meta.dirname, "..");
const source = resolve(root, "plugins/lykomi-ui/skills");
const check = process.argv.includes("--check");
function files(dir) {
  return existsSync(dir)
    ? readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
        entry.isDirectory() ? files(resolve(dir, entry.name)) : [resolve(dir, entry.name)],
      )
    : [];
}
const expected = new Map(files(source).map((path) => [relative(source, path), readFileSync(path)]));
const stale = [];
for (const folder of ["_agents", "_claude"]) {
  const destination = resolve(root, `packages/create-lykomi-app/template/${folder}/skills`);
  for (const [path, body] of expected) {
    const target = resolve(destination, path);
    if (existsSync(target) && readFileSync(target).equals(body)) continue;
    stale.push(relative(root, target));
    if (!check) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
  }
  for (const path of files(destination)) {
    if (expected.has(relative(destination, path))) continue;
    stale.push(relative(root, path));
    if (!check) rmSync(path);
  }
}
if (check && stale.length) {
  console.error(`Stale starter skills: ${stale.join(", ")}\nRun pnpm sync:starter-skills`);
  process.exitCode = 1;
}
