// Distribution copies; edit the maintained source documents in docs/.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve, dirname } from "node:path";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const source = "docs/FORM_UX.md";
const content = `<!-- Generated from ${source}; do not edit. -->\n\n${readFileSync(resolve(root, source), "utf8")}`;
const check = process.argv.includes("--check");
const stale = [];
for (const name of ["foundry-author-chat-module", "foundry-verify-agent-apis"]) {
  for (const [file, body] of [
    ["form-ux.md", content],
    [
      "PROCESS_GUIDE.md",
      `<!-- Generated from docs/PROCESS_GUIDE.md; do not edit. -->\n\n${readFileSync(resolve(root, "docs/PROCESS_GUIDE.md"), "utf8")}`,
    ],
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
