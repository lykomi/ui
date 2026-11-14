import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, it, expect } from "vitest";

/**
 * The generated app must satisfy the peers its scaffolded packages declare.
 *
 * This drifted silently and shipped: the template asked for
 * `@assistant-ui/react ^0.12.25` while `@lykomi/web-ui` required
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
    expect(names.filter((n) => n.startsWith("@assistant-ui/"))).toEqual(["@assistant-ui/react"]);
  });

  /**
   * The four that ship as one release (`fixed` in `.changeset/config.json`)
   * must scaffold at one version — a template mixing 0.20.1 with 0.19.0 of a
   * `fixed` group installs two copies of React context holders.
   *
   * `web-voice` is deliberately NOT in that group: it is optional and
   * releases on its own cadence, so it is listed here by absence rather than
   * by a prefix match. A new coordinated package must be added to this list,
   * which is the point — a prefix match would have silently swept an
   * independently-versioned package back into the invariant.
   */
  const COORDINATED = [
    "@lykomi/agent",
    "@lykomi/web-primitives",
    "@lykomi/web-ui",
    "@lykomi/web-shell",
  ];

  it("scaffolds the coordinated LYKOMI packages at one version", () => {
    const deps = template.dependencies as Record<string, string>;
    const ranges = COORDINATED.map((name) => {
      expect(deps[name], `${name} missing from the template`).toBeTruthy();
      return deps[name];
    });
    expect(new Set(ranges).size).toBe(1);
  });

  it("keeps every scaffolded LYKOMI package pinned exactly", () => {
    // Independently-versioned packages may differ from the group, but none
    // of them may drift to a range: the scaffold pins exact versions so a
    // generated app is reproducible.
    const lykomi = Object.entries(template.dependencies as Record<string, string>).filter(
      ([name]) => name.startsWith("@lykomi/"),
    );
    expect(lykomi.length).toBeGreaterThan(COORDINATED.length - 1);
    for (const [name, range] of lykomi) {
      expect(range, `${name} should be an exact version`).toMatch(/^\d+\.\d+\.\d+/);
    }
  });
});
