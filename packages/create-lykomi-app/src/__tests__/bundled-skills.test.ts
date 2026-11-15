import { mkdtempSync, readFileSync, readdirSync, rmSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { expect, it } from "vitest";
import { copyTemplate } from "../copy-template.js";

it("scaffolds discoverable skills with identical local references for both clients", async () => {
  const target = mkdtempSync(join(tmpdir(), "lykomi-skills-"));
  const source = resolve(import.meta.dirname, "../../template");
  try {
    await copyTemplate({ sourceDir: source, targetDir: target, projectName: "skills-app" });
    const canonical = resolve(import.meta.dirname, "../../../../plugins/lykomi-ui/skills");
    const names = readdirSync(canonical);
    expect(names).toHaveLength(5);
    for (const client of [".agents", ".claude"]) {
      expect(existsSync(join(target, client.replace(".", "_")))).toBe(false);
      for (const name of names) {
        const dir = join(target, client, "skills", name);
        const skill = readFileSync(join(dir, "SKILL.md"), "utf8");
        expect(skill).toBe(readFileSync(join(canonical, name, "SKILL.md"), "utf8"));
        expect(skill).toContain(`name: ${name}`);
        for (const match of skill.matchAll(/\]\((references\/[^)]+)\)/g)) {
          expect(existsSync(join(dir, match[1]))).toBe(true);
        }
      }
    }
  } finally {
    rmSync(target, { recursive: true, force: true });
  }
});
