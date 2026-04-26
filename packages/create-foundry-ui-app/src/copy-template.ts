import { copyFileSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

export interface CopyTemplateOptions {
  sourceDir: string;
  targetDir: string;
  /**
   * Project name. Written into the target's root `package.json#name` field.
   * Also substituted for the literal sentinel `__PROJECT_NAME__` in non-JSON
   * text files (README, HTML, etc.).
   */
  projectName: string;
}

const TEMPLATE_PROJECT_NAME = "__PROJECT_NAME__";

/**
 * Recursively copy template files into target.
 *
 * Templating rules:
 * - The target's **root** `package.json` is parsed, the `name` field is set
 *   to `projectName`, and the result is re-stringified. Robust against
 *   project names with JSON-unsafe characters. (Pattern from create-vite.)
 * - Other text files (README, HTML, CSS, TS, etc.) get a literal-string
 *   replacement of `__PROJECT_NAME__` → projectName. Single sentinel, no
 *   template engine.
 * - Binary files (anything outside the text-extension allowlist) are copied
 *   byte-for-byte without inspection — protects fonts, images, archives,
 *   lockfiles.
 *
 * Renames: `_gitignore` → `.gitignore`. npm strips top-level dotfiles from
 * published tarballs without explicit handling, so the template ships them
 * underscore-prefixed.
 */
const TEXT_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".md",
  ".css",
  ".html",
  ".yml",
  ".yaml",
  ".toml",
  ".env",
  ".sh",
]);

function isTextFile(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) {
    // Dotfiles + no-extension files (.gitignore, _gitignore, Dockerfile) — text.
    return true;
  }
  return TEXT_EXTENSIONS.has(filename.slice(dot));
}

export async function copyTemplate(opts: CopyTemplateOptions): Promise<void> {
  const { sourceDir, targetDir, projectName } = opts;

  function walk(srcDir: string, dstDir: string): void {
    for (const entry of readdirSync(srcDir)) {
      const src = join(srcDir, entry);
      const stat = statSync(src);
      const renamed = entry.startsWith("_") && entry !== "_" ? "." + entry.slice(1) : entry;
      const dst = join(dstDir, renamed);

      if (stat.isDirectory()) {
        mkdirSync(dst, { recursive: true });
        walk(src, dst);
        continue;
      }

      const rel = relative(sourceDir, src);
      // Root package.json: parse → set name → stringify (safe for any project name).
      if (rel === "package.json") {
        const parsed = JSON.parse(readFileSync(src, "utf-8"));
        parsed.name = projectName;
        writeFileSync(dst, JSON.stringify(parsed, null, 2) + "\n");
        continue;
      }

      // Text files: sentinel substitution.
      if (isTextFile(entry)) {
        const raw = readFileSync(src, "utf-8");
        const replaced = raw.split(TEMPLATE_PROJECT_NAME).join(projectName);
        writeFileSync(dst, replaced);
        continue;
      }

      // Binary: byte-for-byte.
      copyFileSync(src, dst);
    }
  }

  walk(sourceDir, targetDir);
}
