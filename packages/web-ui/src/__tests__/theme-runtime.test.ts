import { describe, expect, it } from "vitest";
import {
  getThemePreset,
  mergeThemeDefinitions,
  resolveThemeRuntime,
} from "../lib/theme-runtime.ts";

describe("theme runtime", () => {
  it("merges sparse definitions in precedence order", () => {
    const merged = mergeThemeDefinitions(
      {
        light: {
          primary: "oklch(0.4 0.2 280)",
          foreground: "oklch(0.2 0.01 280)",
        },
      },
      {
        light: {
          primary: "oklch(0.5 0.19 260)",
        },
        status: {
          light: {
            success: "oklch(0.6 0.15 150)",
          },
        },
      },
    );

    expect(merged.light?.primary).toBe("oklch(0.5 0.19 260)");
    expect(merged.light?.foreground).toBe("oklch(0.2 0.01 280)");
    expect(merged.status?.light?.success).toBe("oklch(0.6 0.15 150)");
  });

  it("resolves scoped layers on top of the preset", () => {
    const runtime = resolveThemeRuntime(
      [
        {
          id: "global-theme",
          basePreset: "foundry-violet",
          definition: {
            light: {
              primary: "oklch(0.45 0.18 300)",
            },
            sidebar: {
              light: {
                sidebar: "oklch(0.98 0.01 300)",
              },
            },
          },
        },
        {
          id: "workspace-theme",
          definition: {
            light: {
              primary: "oklch(0.52 0.16 240)",
            },
          },
        },
      ],
      "light",
    );

    expect(runtime.mode).toBe("light");
    expect(runtime.sources.map((layer) => layer.id)).toEqual(["global-theme", "workspace-theme"]);
    expect(runtime.definition.light?.primary).toBe("oklch(0.52 0.16 240)");
    expect(runtime.variables["--primary" as keyof typeof runtime.variables]).toBe(
      "oklch(0.52 0.16 240)",
    );
    expect(runtime.variables["--sidebar" as keyof typeof runtime.variables]).toBe(
      "oklch(0.98 0.01 300)",
    );
    expect(runtime.variables["--success" as keyof typeof runtime.variables]).toBeTruthy();
  });

  it("lets a theme colour the sidebar icons without dragging the labels", () => {
    // A brand whose mark is a colour wants the icons in it and the labels
    // still readable. Before `sidebarIcon` the only lever was
    // `sidebarForeground`, which is the LABEL colour — reaching the icons
    // through it turned every label the brand colour too.
    const runtime = resolveThemeRuntime(
      [
        {
          id: "t",
          definition: {
            sidebar: { light: { sidebarForeground: "#1f2937", sidebarIcon: "#A4C407" } },
          },
        },
      ],
      "light",
    );
    const v = runtime.variables as Record<string, string>;
    expect(v["--sidebar-icon"]).toBe("#A4C407");
    expect(v["--sidebar-foreground"]).toBe("#1f2937");
  });

  it("resolves the icon colour to the previous rendering when unset", () => {
    // The default must reproduce the previous rendering exactly — the label
    // colour at 60% — so adding the token moves no existing theme.
    const runtime = resolveThemeRuntime(
      [{ id: "t", definition: { sidebar: { light: { sidebarForeground: "#1f2937" } } } }],
      "light",
    );
    const v = runtime.variables as Record<string, string>;
    expect(v["--sidebar-icon"]).toBe(
      "color-mix(in srgb, var(--sidebar-foreground) 60%, transparent)",
    );
  });

  it("falls back to the default preset for unknown names", () => {
    expect(getThemePreset("unknown-preset")).toEqual(getThemePreset("foundry-violet"));
  });

  it("uses Foundry UI as the default app branding", () => {
    const runtime = resolveThemeRuntime([], "light");

    expect(runtime.branding.appName).toBe("Foundry UI");
    expect(runtime.branding.appTitle).toBe("Foundry UI");
  });
});
