#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import * as p from "@clack/prompts";
import { applyOverlay, copyTemplate, mergeExtraDependencies } from "./copy-template.js";
import type { PresetEnvVar } from "./presets.js";
import { resolvePreset } from "./presets.js";

interface CliArgs {
  targetDir: string | null;
  preset: string;
  install: boolean;
  force: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  const args: CliArgs = {
    targetDir: null,
    preset: "default",
    install: true,
    force: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "-h":
      case "--help":
        args.help = true;
        break;
      case "--no-install":
        args.install = false;
        break;
      case "--force":
        args.force = true;
        break;
      case "--preset":
        args.preset = argv[++i] ?? "default";
        break;
      default:
        if (a.startsWith("--")) {
          throw new Error(`Unknown flag: ${a}`);
        }
        if (args.targetDir === null) {
          args.targetDir = a;
        }
    }
  }
  return args;
}

function printHelp(): void {
  // eslint-disable-next-line no-console
  console.log(`Usage: create-lykomi-app <target-dir> [options]

Scaffold a new LYKOMI app — AG-UI protocol + Microsoft Agent Framework + Azure Foundry.

Options:
  --preset <name>    Preset to scaffold from (default: "default" — OSS shell + AG-UI agent service).
                     Use "foundry-iq" for an Azure AI Search Foundry IQ knowledge base demo,
                     or "neo4j" for an agent over a Neo4j graph with an interactive
                     visualization (local database or Neo4j Aura).
  --no-install       Skip running pnpm install in the new directory.
  --force            Allow scaffolding into a non-empty directory.
  -h, --help         Show this message.

Example:
  npx create-lykomi-app my-app
  npx create-lykomi-app my-app --preset foundry-iq
  npx create-lykomi-app my-app --preset neo4j
`);
}

function reportEnvVars(envVars: PresetEnvVar[] | undefined): void {
  if (!envVars || envVars.length === 0) return;
  const required = envVars.filter((v) => v.required);
  const optional = envVars.filter((v) => !v.required);
  if (required.length > 0) {
    p.log.info(
      "Required env vars (set before running the app):\n" +
        required.map((v) => `  - ${v.name}: ${v.description}`).join("\n"),
    );
  }
  if (optional.length > 0) {
    p.log.info(
      "Optional env vars:\n" + optional.map((v) => `  - ${v.name}: ${v.description}`).join("\n"),
    );
  }
}

function readTemplateLykomiPackageVersion(templateDir: string): string {
  const pkgPath = join(templateDir, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as {
    dependencies?: Record<string, string>;
  };
  const version = pkg.dependencies?.["@lykomi/agent"];

  if (!version) {
    throw new Error(`Template package.json is missing @lykomi/agent.`);
  }
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Template @lykomi/agent must use an exact version, got '${version}'.`);
  }

  return version;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return 0;
  }

  let targetDir = args.targetDir;
  if (!targetDir) {
    const answer = await p.text({
      message: "Project directory:",
      placeholder: "my-lykomi-app",
      validate: (v) => (!v || v.length === 0 ? "Required" : undefined),
    });
    if (p.isCancel(answer)) {
      p.cancel("Cancelled.");
      return 1;
    }
    targetDir = String(answer);
  }

  const targetPath = resolve(process.cwd(), targetDir);
  const targetExists = existsSync(targetPath);
  if (targetExists && !args.force) {
    const entries = readdirSync(targetPath);
    if (entries.length > 0) {
      p.log.error(`Target ${targetPath} is not empty. Use --force to scaffold over it.`);
      return 1;
    }
  }

  if (!targetExists) {
    mkdirSync(targetPath, { recursive: true });
  }

  p.log.step(`Scaffolding into ${targetPath}`);
  p.log.step(`Preset: ${args.preset}`);

  const preset = await resolvePreset(args.preset);
  // Project name = basename of the target path, sanitized for npm/JS naming.
  const rawName = basename(targetPath);
  const projectName =
    rawName.replace(/^[^a-zA-Z]+/, "").replace(/[^a-zA-Z0-9-_]/g, "-") || "my-app";

  await copyTemplate({
    sourceDir: preset.templateDir,
    targetDir: targetPath,
    projectName,
    lykomiPackageVersion: readTemplateLykomiPackageVersion(preset.templateDir),
  });
  if (preset.overlayDir) {
    await applyOverlay({
      overlayDir: preset.overlayDir,
      targetDir: targetPath,
      projectName,
    });
  }
  await mergeExtraDependencies({
    targetDir: targetPath,
    extraDependencies: preset.extraDependencies,
    extraDevDependencies: preset.extraDevDependencies,
    extraScripts: preset.extraScripts,
  });
  p.log.success(`Files copied (preset: ${preset.name}).`);

  if (args.install) {
    const installSpinner = p.spinner();
    installSpinner.start("pnpm install");
    const result = spawnSync("pnpm", ["install"], {
      cwd: targetPath,
      stdio: "inherit",
    });
    if (result.status !== 0) {
      installSpinner.error("pnpm install failed");
      p.log.warn(
        "Scaffold completed but install failed. cd into the dir and re-run `pnpm install`.",
      );
      return result.status ?? 1;
    }
    installSpinner.stop("pnpm install done");
  } else {
    p.log.info("Skipped pnpm install (--no-install).");
  }

  reportEnvVars(preset.envVars);
  p.outro(`✓ Done. Next:\n  cd ${targetDir}\n  pnpm dev`);
  return 0;
}

main().then(
  (code) => process.exit(code),
  (err) => {
    // eslint-disable-next-line no-console
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  },
);
