import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_SLOTS, resolveThemeRuntime, type ThemeDefinition } from "../lib/theme-runtime";

describe("theme slot contract", () => {
  it("orders surface controls by visual impact", () => {
    const surfaces = THEME_SLOTS.filter(
      (slot) => slot.group === "Surfaces" && slot.mode === "light",
    ).sort((left, right) => left.impact - right.impact);

    expect(surfaces.slice(0, 5).map((slot) => slot.path.at(-1))).toEqual([
      "primary",
      "primaryForeground",
      "heading",
      "background",
      "foreground",
    ]);
    expect(surfaces.find((slot) => slot.path.at(-1) === "accent")?.derivedFrom).toBe(
      "background + primary",
    );
  });
  it("round-trips every advertised slot into the runtime", () => {
    expect(new Set(THEME_SLOTS.map((slot) => slot.path.join("."))).size).toBe(THEME_SLOTS.length);
    for (const slot of THEME_SLOTS) {
      const definition: Record<string, unknown> = {};
      let cursor = definition;
      for (const key of slot.path.slice(0, -1)) {
        cursor[key] = {};
        cursor = cursor[key] as Record<string, unknown>;
      }
      cursor[slot.path.at(-1)!] = "sentinel";
      const result = resolveThemeRuntime(
        [{ definition: definition as ThemeDefinition }],
        slot.mode ?? "light",
      );
      const value = slot.cssVariable
        ? result.variables[slot.cssVariable as keyof typeof result.variables]
        : result.branding[slot.path.at(-1)! as keyof typeof result.branding];
      expect(value, slot.path.join(".")).toBe("sentinel");
    }
  });
  it("headings inherit body colour until explicitly themed", () => {
    expect(
      resolveThemeRuntime([{ definition: { light: { foreground: "#112233" } } }], "light")
        .variables,
    ).toMatchObject({
      "--heading": "#112233",
      "--content-heading-1": "#112233",
      "--content-heading-3": "#112233",
    });
    expect(
      resolveThemeRuntime([{ definition: { light: { heading: "#234567" } } }], "light").variables,
    ).toMatchObject({ "--heading": "#234567" });
  });

  it("lets document heading levels diverge from interface headings", () => {
    const variables = resolveThemeRuntime(
      [
        {
          definition: {
            light: {
              heading: "#0055aa",
              contentHeading1: "#112233",
              contentHeading2: "#334455",
            },
          },
        },
      ],
      "light",
    ).variables;

    expect(variables).toMatchObject({
      "--heading": "#0055aa",
      "--content-heading-1": "#112233",
      "--content-heading-2": "#334455",
    });
  });

  it("keeps preset surfaces when a sparse edit changes an unrelated colour", () => {
    const baseline = resolveThemeRuntime([], "light").variables;
    const result = resolveThemeRuntime(
      [{ definition: { light: { destructive: "#aabbcc" } } }],
      "light",
    ).variables;
    for (const key of ["--card", "--secondary", "--muted", "--accent", "--border", "--sidebar"]) {
      expect(result[key], key).toBe(baseline[key]);
    }
    expect(result["--destructive"]).toBe("#aabbcc");
  });

  it("keeps preset navigation when only selected text is authored", () => {
    const baseline = resolveThemeRuntime([], "light").variables;
    const result = resolveThemeRuntime(
      [{ definition: { sidebar: { light: { sidebarSelectedForeground: "#123456" } } } }],
      "light",
    ).variables;
    for (const key of ["--sidebar", "--sidebar-accent", "--sidebar-border", "--sidebar-ring"]) {
      expect(result[key], key).toBe(baseline[key]);
    }
    expect(result["--sidebar-selected-foreground"]).toBe("#123456");
  });

  it("uses selected foreground for the active chevron, dot, and collapsed shortcut", () => {
    const source = readFileSync(join(import.meta.dirname!, "../components/sidebar.tsx"), "utf8");
    expect(source).toContain('isActive ? "bg-sidebar-selected-foreground/70"');
    expect(source).toContain('isActive ? "text-sidebar-selected-foreground"');
    expect(source).toContain("bg-sidebar-selected text-sidebar-selected-foreground");
  });
});
