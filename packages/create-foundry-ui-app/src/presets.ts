import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export interface ResolvedPreset {
  name: string;
  templateDir: string;
}

/**
 * Resolve a preset name to a template directory.
 *
 * - `default` (or unspecified) → bundled `template/` next to the CLI's dist.
 * - `lastspace` → fetched at runtime via the lastspace preset URL gated by
 *   `FOUNDRY_UI_TOKEN` (a fine-grained PAT with read access to
 *   ltwlf/lastspace's preset path). Same auth model as private
 *   @lastspace/spaces-web-ui access — see lastspace docs.
 * - Other registered presets follow the same pattern.
 *
 * For the alpha 0.1.0 release we only ship the `default` preset bundled.
 * The `lastspace` preset path is reserved here but throws "not yet
 * available" until #100-F lands the lastspace-side preset content.
 */
export async function resolvePreset(name: string): Promise<ResolvedPreset> {
  if (name === "default") {
    return { name, templateDir: bundledTemplateDir() };
  }
  if (name === "lastspace") {
    throw new Error(
      "preset 'lastspace' not yet available — ships in lastspace#100-F. " +
        "Use the default preset for now and add Spaces manually, or wait.",
    );
  }
  throw new Error(`Unknown preset: ${name}`);
}

/**
 * Locate the bundled template directory.
 *
 * Resolution rules:
 * - Built CLI (dist/index.js): `<pkg-root>/template/` (one level up from dist).
 * - Source mode (src/index.ts via tsx, used in tests): `<pkg-root>/template/`
 *   (two levels up from src).
 *
 * Either way, `<pkg-root>/template/` is the answer. We walk up from the file
 * URL until we find it.
 */
function bundledTemplateDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  // Walk up looking for a sibling `template/` directory.
  let dir = here;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "template");
    if (existsSync(candidate)) {
      return candidate;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate bundled template/ relative to ${here}. ` +
      "Did you build the CLI? Run `pnpm build` in packages/create-foundry-ui-app.",
  );
}
