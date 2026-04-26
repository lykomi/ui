import { describe, it, expect, beforeEach } from "vitest";
import { useNavStore } from "../nav-store.ts";
import { DEFAULT_NAV_CONFIG } from "../nav-config.ts";
import type { NavGroup } from "../nav-config.ts";

const testGroup: NavGroup = {
  label: "TestGroup",
  items: [{ to: "/test", label: "Test", icon: {} as NavGroup["items"][0]["icon"] }],
};

describe("useNavStore", () => {
  beforeEach(() => {
    useNavStore.setState({ config: DEFAULT_NAV_CONFIG });
  });

  it("initializes with DEFAULT_NAV_CONFIG", () => {
    expect(useNavStore.getState().config).toBe(DEFAULT_NAV_CONFIG);
  });

  describe("setConfig", () => {
    it("replaces entire config", () => {
      useNavStore.getState().setConfig([testGroup]);
      expect(useNavStore.getState().config).toEqual([testGroup]);
    });
  });

  describe("addGroup", () => {
    it("appends new group", () => {
      const before = useNavStore.getState().config.length;
      useNavStore.getState().addGroup(testGroup);
      expect(useNavStore.getState().config.length).toBe(before + 1);
      expect(useNavStore.getState().config.at(-1)).toEqual(testGroup);
    });

    it("replaces existing group with same label (preserves order)", () => {
      useNavStore.getState().addGroup(testGroup);
      const updated: NavGroup = { ...testGroup, description: "updated" };
      useNavStore.getState().addGroup(updated);

      const matches = useNavStore.getState().config.filter((g) => g.label === "TestGroup");
      expect(matches.length).toBe(1);
      expect(matches[0].description).toBe("updated");
    });
  });

  describe("removeGroup", () => {
    it("removes group by label", () => {
      useNavStore.getState().addGroup(testGroup);
      useNavStore.getState().removeGroup("TestGroup");
      expect(useNavStore.getState().config.find((g) => g.label === "TestGroup")).toBeUndefined();
    });

    it("no-op for non-existent label", () => {
      const before = useNavStore.getState().config.length;
      useNavStore.getState().removeGroup("NoSuchGroup");
      expect(useNavStore.getState().config.length).toBe(before);
    });
  });
});
