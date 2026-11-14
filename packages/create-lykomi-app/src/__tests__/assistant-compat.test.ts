import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The template must NOT pin `@assistant-ui/react`'s own transitives.
 *
 * This repo pins `@assistant-ui/store` and `@assistant-ui/tap` exactly, and
 * patches the store — because it pins `@assistant-ui/react` exactly too, and
 * that one version does not survive `tap` 0.9.13+ or want the store's
 * pre-patch StrictMode behaviour. A generated app is in the opposite
 * situation: it carries a CARET on `@assistant-ui/react`, so it resolves the
 * current release, which requires the current `store` and `tap` and has been
 * built against them.
 *
 * Copying this repo's pins into the template therefore freezes one node of a
 * graph the rest of which keeps moving. That is not a theory — it shipped:
 * `react` floated to a build whose `core` peer-required `store@^0.3.0`, the
 * pin held `store` at `0.2.10`, and every generated app failed to build on a
 * missing `@assistant-ui/store/client` specifier.
 *
 * `smoke:starter` already refuses these pins in the scaffold's
 * `pnpm-workspace.yaml`. It cannot see them in `package.json` — and its own
 * comment records why that matters: a `pnpm.overrides` block in `package.json`
 * makes pnpm ignore the workspace file's overrides entirely, so putting them
 * there is both the easier mistake and the one nothing was watching for. This
 * test is that half, and it needs no install to run.
 */
const here = dirname(fileURLToPath(import.meta.url));
const templateRoot = join(here, "..", "..", "template");
const template = JSON.parse(readFileSync(join(templateRoot, "package.json"), "utf8")) as Record<
  string,
  unknown
>;
const workspaceYaml = readFileSync(join(templateRoot, "pnpm-workspace.yaml"), "utf8");

/** Every place a manifest can force a version. */
const overrideBlocks = (): Record<string, unknown> => ({
  ...((template.overrides as Record<string, unknown>) ?? {}),
  ...((template.resolutions as Record<string, unknown>) ?? {}),
  ...(((template.pnpm as { overrides?: Record<string, unknown> })?.overrides as Record<
    string,
    unknown
  >) ?? {}),
});

const FROZEN = ["@assistant-ui/store", "@assistant-ui/core", "@assistant-ui/tap"];

describe("the template leaves assistant-ui's own graph alone", () => {
  it.each(FROZEN)("does not override %s in package.json", (name) => {
    expect(overrideBlocks()[name]).toBeUndefined();
  });

  it.each(FROZEN)("does not override %s in pnpm-workspace.yaml", (name) => {
    // Duplicates the smoke test deliberately: that one needs a build, a pack
    // and a five-minute install before it can say anything.
    expect(workspaceYaml).not.toMatch(new RegExp(`^\\s+"?${name.replace("/", "\\/")}"?\\s*:`, "m"));
  });

  it("ships no patch of its own to hold a pin in place", () => {
    // `patchedDependencies` keys on an exact version, so a patch cannot exist
    // without a pin to match it — carrying one is how a pin gets reintroduced.
    expect(template.pnpm).toBeUndefined();
  });

  it("keeps @assistant-ui/react on a caret, which is what makes all of that safe", () => {
    // It is here only to satisfy the peer `@lykomi/web-ui`
    // declares; the generated app never imports it. The caret is the point:
    // the resolved release brings the transitives it was built against.
    const range = (template.dependencies as Record<string, string>)["@assistant-ui/react"];
    expect(range).toMatch(/^\^/);
  });
});
