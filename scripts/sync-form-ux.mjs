// All UX rules have one source: docs/FORM_UX.md. Other guides are generated.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = "docs/FORM_UX.md";
const content = `<!-- Generated from ${source}; do not edit. -->\n\n${readFileSync(resolve(root, source), "utf8")}`;
const canonical = readFileSync(resolve(root, source), "utf8");
const section = canonical.indexOf("## Wizards and process guidance");
if (section < 0) throw new Error("Missing canonical process guidance section");
const processGuide = `<!-- Generated from docs/FORM_UX.md; do not edit. -->\n\n${canonical.slice(section)}`;
const check = process.argv.includes("--check");
const stale = [];
const guidePath = resolve(root, "docs/PROCESS_GUIDE.md");
if (!existsSync(guidePath) || readFileSync(guidePath, "utf8") !== processGuide) {
  stale.push("docs/PROCESS_GUIDE.md");
  if (!check) writeFileSync(guidePath, processGuide);
}
for (const name of ["foundry-author-chat-module", "foundry-verify-agent-apis"]) {
  for (const [file, body] of [
    ["form-ux.md", content],
    ["PROCESS_GUIDE.md", processGuide],
  ]) {
    const relative = `plugins/foundry-ui/skills/${name}/references/${file}`;
    const target = resolve(root, relative);
    if (existsSync(target) && readFileSync(target, "utf8") === body) continue;
    stale.push(relative);
    if (!check) {
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, body);
    }
  }
}
if (check && stale.length) {
  console.error(`Stale UX references: ${stale.join(", ")}\nRun pnpm sync:form-ux`);
  process.exitCode = 1;
}
