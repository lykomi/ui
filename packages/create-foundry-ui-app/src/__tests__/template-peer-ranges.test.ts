import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/**
 * The generated app must satisfy the peers its scaffolded packages declare.
 *
 * This drifted silently and shipped: the template asked for
 * `@assistant-ui/react ^0.12.25` while `@iloveagents/foundry-web-ui` required
 * `^0.15.1` as a peer. pnpm warns about an unmet peer and installs anyway, so
 * every generated app carried a two-minor-line-old assistant-ui — invisible
 * until web-ui used a 0.15-only export and the starter build died on
 * "groupPartByType is not exported".
 *
 * The build smoke test catches that only once a package actually uses a new
 * API. This catches the drift itself.
 */
const read = (relative: string) =>
  JSON.parse(readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8"));

const template = read("../../template/package.json");
const PEERED_BY = {
  "@assistant-ui/react": "../../../web-ui/package.json",
} as const;

describe("template dependency ranges", () => {
  for (const [dependency, packagePath] of Object.entries(PEERED_BY)) {
    it(`asks for the ${dependency} range its packages peer-depend on`, () => {
      const peer = read(packagePath).peerDependencies?.[dependency];
      expect(peer).toBeTruthy();
      expect(template.dependencies[dependency]).toBe(peer);
    });
  }

  it("pins none of assistant-ui's internals", () => {
    // Pinning store / core / tap is how the template fell behind: those
    // versions have to move together with @assistant-ui/react, and nothing
    // reminded anyone to move them. Let its own ranges resolve.
    const names = [
      ...Object.keys(template.dependencies ?? {}),
      ...Object.keys(template.devDependencies ?? {}),
      ...Object.keys(template.overrides ?? {}),
    ];
    expect(names.filter((n) => n.startsWith("@assistant-ui/"))).toEqual([
      "@assistant-ui/react",
    ]);
  });

  it("scaffolds the foundry packages at one coordinated version", () => {
    const foundry = Object.entries(template.dependencies as Record<string, string>).filter(
      ([name]) => name.startsWith("@iloveagents/foundry-"),
    );
    expect(foundry.length).toBeGreaterThan(0);
    expect(new Set(foundry.map(([, range]) => range)).size).toBe(1);
  });
});
