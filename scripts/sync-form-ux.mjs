// Distribution copies of the framework contract; edit docs/FORM_UX.md only.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = "docs/FORM_UX.md";
const content = `<!-- Generated from ${source}; do not edit. -->\n\n${readFileSync(resolve(root, source), "utf8")}`;
const check = process.argv.includes("--check");
const stale = [];
for (const name of ["foundry-author-chat-module", "foundry-verify-agent-apis"]) {
  const relative = `plugins/foundry-ui/skills/${name}/references/form-ux.md`;
  const target = resolve(root, relative);
  if (existsSync(target) && readFileSync(target, "utf8") === content) continue;
  stale.push(relative);
  if (!check) {
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, content);
  }
}
if (check && stale.length) {
  console.error(`Stale UX references: ${stale.join(", ")}\nRun pnpm sync:form-ux`);
  process.exitCode = 1;
}
