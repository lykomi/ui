import { describe, expect, it } from "vitest";
import { Layers } from "lucide-react";
import type { NavGroup, NavItem } from "../lib/nav-config.ts";
import { overviewSpaceGroups, useRecentSpaceIds } from "../workbench/recent-spaces.ts";

const item = (id: string): NavItem => ({
  to: `/s/${id}`,
  label: id,
  icon: Layers,
  meta: { spacesRootId: id },
});
const group = (items: NavItem[]): NavGroup => ({
  label: "Spaces",
  to: "/spaces",
  meta: { type: "spaces-workspaces" },
  items,
});

describe("recent space shortcuts", () => {
  it("keeps five authorized unique spaces in visit order and sends Show more to Spaces", () => {
    const personal = {
      ...item("personal"),
      meta: { spacesRootId: "personal", spacesContentType: "personal_space" },
    };
    const groups = overviewSpaceGroups(
      group([
        personal,
        { ...item("disabled"), disabled: true },
        ...Array.from({ length: 7 }, (_, i) => item(String(i))),
      ]),
      ["revoked", "disabled", "personal", "4", "4", "2", "0", "6", "5", "1"],
    );
    expect(groups.map((g) => g.label)).toEqual(["Spaces", "Recent spaces"]);
    expect(groups[0].items).toEqual([]);
    expect(groups[1].items.map((i) => i.label)).toEqual(["4", "2", "0", "6", "5", "Show more"]);
    expect(groups[1].items.at(-1)?.to).toBe("/spaces");
  });
  it("has no empty recents heading or invented defaults", () => {
    expect(overviewSpaceGroups(group([item("one")]), []).map((g) => g.label)).toEqual(["Spaces"]);
  });
  it("does not offer Show more for unvisited spaces or inaccessible recents", () => {
    const one = item("one");
    const disabled = { ...item("disabled"), disabled: true };
    expect(
      overviewSpaceGroups(group([one, disabled]), ["one", "revoked"])[1].items.map((i) => i.label),
    ).toEqual(["one"]);
    expect(
      overviewSpaceGroups(group([one, item("two")]), ["one"])[1].items.map((i) => i.label),
    ).toEqual(["one"]);
  });
  it("only offers Show more beyond five accessible unique recents", () => {
    const spaces = Array.from({ length: 6 }, (_, i) => item(String(i)));
    const labels = (ids: string[]) =>
      overviewSpaceGroups(group(spaces), ids)[1].items.map((i) => i.label);
    expect(labels(["0", "1", "2", "3", "4", "4", "revoked"])).toEqual(["0", "1", "2", "3", "4"]);
    expect(labels(["0", "1", "2", "3", "4", "5"])).toEqual(["0", "1", "2", "3", "4", "Show more"]);
  });
  it("reads server-owned state supplied by the module", () => {
    const spaces = group([item("one")]);
    expect(useRecentSpaceIds([spaces])).toEqual([]);
    spaces.meta = { ...spaces.meta, userState: { recentSpaceIds: ["one"] } };
    expect(useRecentSpaceIds([spaces])).toEqual(["one"]);
  });
});
