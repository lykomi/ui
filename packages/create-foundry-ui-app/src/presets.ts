import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export interface PresetEnvVar {
  name: string;
  description: string;
  required: boolean;
  secret: boolean;
}

export interface PresetManifest {
  name: string;
  version: string;
  description?: string;
  extends?: string;
  filesDir?: string;
  extraDependencies?: Record<string, string>;
  extraDevDependencies?: Record<string, string>;
  /** npm scripts merged into the generated `package.json`. */
  extraScripts?: Record<string, string>;
  envVars?: PresetEnvVar[];
  postInstall?: { scripts?: Array<{ command: string; description: string }> };
}

export interface ResolvedPreset {
  name: string;
  templateDir: string;
  overlayDir?: string;
  extraDependencies?: Record<string, string>;
  extraDevDependencies?: Record<string, string>;
  extraScripts?: Record<string, string>;
  envVars?: PresetEnvVar[];
  postInstall?: PresetManifest["postInstall"];
}

/**
 * Resolve a preset name to the bundled base template plus an optional bundled overlay.
 *
 * - `default` (or unspecified): chat-first Foundry UI app, FastAPI AG-UI
 *   agent service, and hello/weather demo tools.
 * - `foundry-iq`: default plus an Azure AI Search Foundry IQ knowledge-base
 *   retrieval tool using the documented MCP endpoint shape.
 * - `neo4j`: default plus Neo4j graph tools (schema, read-only Cypher,
 *   semantic search) and an interactive graph visualization. Works against a
 *   local database or Neo4j Aura — only the connection URI differs.
 */
export async function resolvePreset(name: string): Promise<ResolvedPreset> {
  if (name === "default") {
    return {
      name,
      templateDir: bundledTemplateDir(),
    };
  }
  if (name === "foundry-iq" || name === "neo4j") {
    return await loadBundledManifestPreset({ name, presetRoot: bundledPresetDir(name) });
  }
  throw new Error(`Unknown preset: ${name}`);
}

function bundledTemplateDir(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "template");
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate bundled template/ relative to ${here}. ` +
      "Did you build the CLI? Run `pnpm build` in packages/create-foundry-ui-app.",
  );
}

function bundledPresetDir(name: string): string {
  const here = dirname(fileURLToPath(import.meta.url));
  let dir = here;
  for (let i = 0; i < 5; i++) {
    const candidate = join(dir, "presets", name);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(
    `Could not locate bundled presets/${name}/ relative to ${here}. ` +
      "Did you build the CLI? Run `pnpm build` in packages/create-foundry-ui-app.",
  );
}

interface BundledPresetOptions {
  name: string;
  presetRoot: string;
}

async function loadBundledManifestPreset(opts: BundledPresetOptions): Promise<ResolvedPreset> {
  const manifestPath = join(opts.presetRoot, "manifest.json");
  if (!existsSync(manifestPath)) {
    throw new Error(`Bundled preset '${opts.name}' has no manifest.json.`);
  }
  const manifest = JSON.parse(await readFile(manifestPath, "utf-8")) as PresetManifest;
  return buildResolvedPreset(opts.name, opts.presetRoot, manifest);
}

function buildResolvedPreset(
  name: string,
  presetRoot: string,
  manifest: PresetManifest,
): ResolvedPreset {
  if (manifest.extends && manifest.extends !== "default") {
    throw new Error(
      `Preset '${name}' extends '${manifest.extends}', but only 'default' is supported.`,
    );
  }

  const overlayName = manifest.filesDir ?? "files";
  const overlayDir = join(presetRoot, overlayName);
  if (!existsSync(overlayDir)) {
    throw new Error(
      manifest.filesDir === undefined
        ? `Preset '${name}' has no '${overlayName}/' directory at the package root (default filesDir).`
        : `Preset '${name}' declares filesDir='${overlayName}' but the directory is missing in the package.`,
    );
  }

  return {
    name,
    templateDir: bundledTemplateDir(),
    overlayDir,
    extraDependencies: manifest.extraDependencies,
    extraDevDependencies: manifest.extraDevDependencies,
    extraScripts: manifest.extraScripts,
    envVars: manifest.envVars,
    postInstall: manifest.postInstall,
  };
}
