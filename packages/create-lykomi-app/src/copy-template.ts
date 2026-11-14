import {
  copyFileSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { join } from "node:path";

export interface CopyTemplateOptions {
  sourceDir: string;
  targetDir: string;
  /**
   * Project name. Written into the target's root `package.json#name` field.
   * Also substituted for the literal sentinel `__PROJECT_NAME__` in non-JSON
   * text files (README, HTML, etc.).
   */
  projectName: string;
  /**
   * Exact LYKOMI UI package version to stamp into generated apps.
   */
  lykomiPackageVersion?: string;
}

export interface ApplyOverlayOptions {
  overlayDir: string;
  targetDir: string;
  /**
   * Project name — substituted for `__PROJECT_NAME__` sentinel in overlay
   * text files. Overlays do NOT carry a root `package.json` (that comes from
   * the base template); use `mergeExtraDependencies` to add deps.
   */
  projectName: string;
}

export interface MergeExtraDepsOptions {
  targetDir: string;
  extraDependencies?: Record<string, string>;
  extraDevDependencies?: Record<string, string>;
  extraScripts?: Record<string, string>;
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
 * Renames: `_<name>` → `.<name>` for any underscore-prefixed file. npm strips
 * top-level dotfiles from published tarballs without explicit handling, so
 * templates ship them underscore-prefixed (`_gitignore`, `_npmrc`, …).
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
  // `.py` was missing, so every scaffold — default, foundry-iq and neo4j
  // alike — shipped `FastAPI(title="__PROJECT_NAME__ Agent")` verbatim and
  // served the placeholder as its own OpenAPI title. Same failure as the
  // corrupted preset README this PR also fixes: a substitution nobody
  // noticed was not happening.
  ".py",
]);

function isTextFile(filename: string): boolean {
  const dot = filename.lastIndexOf(".");
  if (dot === -1) {
    // Dotfiles + no-extension files (.gitignore, _gitignore, Dockerfile) — text.
    return true;
  }
  return TEXT_EXTENSIONS.has(filename.slice(dot));
}

interface WalkOptions {
  srcDir: string;
  dstDir: string;
  projectName: string;
  lykomiPackageVersion?: string;
  /**
   * If true, the root-level `package.json` (depth 0) is parsed-edited-stringified
   * to set its `name` field. If false (overlay mode), the special-case is
   * skipped: any `package.json` in the source falls through to the binary
   * byte-copy branch (since `.json` is intentionally outside `TEXT_EXTENSIONS`
   * to avoid sentinel-substituting JSON files). Overlays shouldn't ship a
   * root package.json — declare deps via the manifest's `extraDependencies`
   * instead — but if one slips in, this avoids clobbering the base template's
   * package.json#name with a partial copy.
   */
  rewriteRootPackageJson: boolean;
}

function walkAndCopy(opts: WalkOptions): void {
  const { srcDir, dstDir, projectName, lykomiPackageVersion, rewriteRootPackageJson } = opts;

  function walk(currentSrc: string, currentDst: string, depth: number): void {
    for (const entry of readdirSync(currentSrc)) {
      const src = join(currentSrc, entry);
      const stat = statSync(src);
      // Single-underscore prefix → dotfile (e.g. `_gitignore` → `.gitignore`,
      // `_npmrc` → `.npmrc`). Double-underscore prefix is preserved as-is so
      // Python dunder files (`__init__.py`, `__main__.py`) survive intact.
      const renamed =
        entry.startsWith("_") && !entry.startsWith("__") && entry !== "_"
          ? "." + entry.slice(1)
          : entry;
      const dst = join(currentDst, renamed);

      if (stat.isDirectory()) {
        mkdirSync(dst, { recursive: true });
        walk(src, dst, depth + 1);
        continue;
      }

      // Root package.json: parse → set name → stringify (safe for any project name).
      if (rewriteRootPackageJson && depth === 0 && entry === "package.json") {
        const parsed = JSON.parse(readFileSync(src, "utf-8"));
        parsed.name = projectName;
        if (lykomiPackageVersion) {
          syncLykomiPackageVersions(parsed, lykomiPackageVersion);
        }
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

  walk(srcDir, dstDir, 0);
}

export async function copyTemplate(opts: CopyTemplateOptions): Promise<void> {
  walkAndCopy({
    srcDir: opts.sourceDir,
    dstDir: opts.targetDir,
    projectName: opts.projectName,
    lykomiPackageVersion: opts.lykomiPackageVersion,
    rewriteRootPackageJson: true,
  });
}

/**
 * Apply an overlay directory's contents on top of an already-scaffolded target.
 *
 * Same walk semantics as `copyTemplate` — sentinel substitution, `_<name>` →
 * `.<name>` renames, binary byte-copy — but the root `package.json` is **not**
 * rewritten (the base template's name stays). Existing files are silently
 * overwritten so overlays can replace `src/main.tsx`, `src/index.css`, etc.
 */
export async function applyOverlay(opts: ApplyOverlayOptions): Promise<void> {
  walkAndCopy({
    srcDir: opts.overlayDir,
    dstDir: opts.targetDir,
    projectName: opts.projectName,
    rewriteRootPackageJson: false,
  });
}

/**
 * Merge `extraDependencies` / `extraDevDependencies` / `extraScripts` from a
 * preset manifest into the target's root `package.json`. Sorts the resulting
 * dep maps alphabetically (matches what `pnpm install` would do on its own).
 *
 * Scripts go through here rather than through the file overlay because the
 * overlay copies files verbatim: an overlay `package.json` would replace the
 * template's, losing its dependencies, its name substitution and its foundry
 * version pins. Merging is the only way a preset can add a script safely.
 *
 * Scripts keep the template's order with the preset's appended, since npm
 * script order is what `pnpm run` lists and grouping beats alphabetising there.
 */
export async function mergeExtraDependencies(opts: MergeExtraDepsOptions): Promise<void> {
  if (!opts.extraDependencies && !opts.extraDevDependencies && !opts.extraScripts) return;

  const pkgPath = join(opts.targetDir, "package.json");
  const parsed = JSON.parse(readFileSync(pkgPath, "utf-8"));

  if (opts.extraDependencies) {
    parsed.dependencies = sortKeys({ ...(parsed.dependencies ?? {}), ...opts.extraDependencies });
  }
  if (opts.extraDevDependencies) {
    parsed.devDependencies = sortKeys({
      ...(parsed.devDependencies ?? {}),
      ...opts.extraDevDependencies,
    });
  }
  if (opts.extraScripts) {
    parsed.scripts = { ...(parsed.scripts ?? {}), ...opts.extraScripts };
  }
  writeFileSync(pkgPath, JSON.stringify(parsed, null, 2) + "\n");
}

function sortKeys<T extends Record<string, string>>(obj: T): T {
  const sorted = {} as T;
  for (const key of Object.keys(obj).sort()) {
    (sorted as Record<string, string>)[key] = obj[key];
  }
  return sorted;
}

const LYKOMI_PACKAGES = [
  "@lykomi/agent",
  "@lykomi/web-graph",
  "@lykomi/web-primitives",
  "@lykomi/web-shell",
  "@lykomi/web-ui",
] as const;

function syncLykomiPackageVersions(pkg: Record<string, unknown>, version: string): void {
  for (const sectionName of ["dependencies", "devDependencies"] as const) {
    const section = pkg[sectionName];
    if (!section || typeof section !== "object" || Array.isArray(section)) continue;

    const dependencies = section as Record<string, unknown>;
    for (const packageName of LYKOMI_PACKAGES) {
      if (packageName in dependencies) {
        dependencies[packageName] = version;
      }
    }
  }
}
