import { readFileSync } from "node:fs";
import { join } from "node:path";

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

  it("derives secondary surfaces from the high-impact palette", () => {
    const runtime = resolveThemeRuntime(
      [
        {
          definition: {
            light: {
              background: "#ffffff",
              foreground: "#101828",
              primary: "#045cac",
            },
          },
        },
      ],
      "light",
    );
    const variables = runtime.variables as Record<string, string>;

    expect(variables["--heading"]).toBe("#101828");
    expect(variables["--card"]).toBe("#ffffff");
    expect(variables["--accent"]).toBe("color-mix(in srgb, #ffffff 90%, #045cac 10%)");
    expect(variables["--ring"]).toBe("#045cac");
    expect(variables["--sidebar-primary"]).toBe("#045cac");
  });

  it("keeps explicit secondary surfaces over their derived values", () => {
    const runtime = resolveThemeRuntime(
      [
        {
          definition: {
            light: {
              background: "#ffffff",
              foreground: "#101828",
              primary: "#045cac",
              accent: "#f0f000",
            },
            sidebar: { light: { sidebarSelected: "#00f000" } },
          },
        },
      ],
      "light",
    );
    const variables = runtime.variables as Record<string, string>;

    expect(variables["--accent"]).toBe("#f0f000");
    expect(variables["--sidebar-selected"]).toBe("#00f000");
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

  it("does not move a theme authored before these slots existed", () => {
    // Shaped like the themes downstream deployments ship: every sidebar slot
    // set EXCEPT the new one. Adding a slot must
    // be inert for them — an existing deployment must not repaint on upgrade,
    // which is the whole reason the default reproduces the old value instead
    // of deriving something nicer from `primary`.
    const legacySidebar = {
      sidebar: "#ffffff",
      sidebarForeground: "#1f2937",
      sidebarPrimary: "#0075BE",
      sidebarPrimaryForeground: "#ffffff",
      sidebarAccent: "#e8f2f8",
      sidebarAccentForeground: "#0f172a",
      sidebarBorder: "#d8dfe5",
      sidebarRing: "#0075BE",
      sidebarSelectedForeground: "#0075BE",
    };
    const runtime = resolveThemeRuntime(
      [{ id: "legacy", definition: { sidebar: { light: legacySidebar } } }],
      "light",
    );
    const v = runtime.variables as Record<string, string>;

    for (const [key, value] of Object.entries(legacySidebar)) {
      const cssVar = "--" + key.replace(/[A-Z]/g, (c) => "-" + c.toLowerCase());
      expect(v[cssVar]).toBe(value);
    }
    // ...and the icons keep the tint the hardcoded class used to apply.
    expect(v["--sidebar-icon"]).toBe(
      "color-mix(in srgb, var(--sidebar-foreground) 60%, transparent)",
    );
  });

  it("colours the collapsed rail's idle icons too", () => {
    // A theme slot that stops applying when the sidebar is collapsed is worse
    // than no slot: the branding silently changes on a UI state the user
    // controls. Asserted against the source, because the collapsed branches
    // render through TooltipIconButton rather than the shared nav row.
    const src = readFileSync(join(import.meta.dirname!, "../components/sidebar.tsx"), "utf-8");
    // The collapsed "New Thread" button.
    expect(src).toContain('<SquarePen className="size-4 text-sidebar-icon" />');
    // The collapsed nav shortcuts use selected text when active, idle takes the icon slot.
    expect(src).toContain('isActive ? "text-sidebar-selected-foreground" : "text-sidebar-icon"');
    // And nothing anywhere still hardcodes the tint the slot replaced.
    expect(src).not.toContain("text-sidebar-foreground/60");
  });

  it("lets a custom-sized mark shrink inside its header", () => {
    // A fixed max-width is always the wrong number for someone: 20rem is
    // 320px while an expanded sidebar is 248px, so a 4:1 wordmark at the 4rem
    // ceiling still overflowed and pushed the collapse button out. The bound
    // has to be the container, and the image has to be allowed to narrow —
    // `shrink-0` is what turns "too wide" into "off screen".
    const src = readFileSync(join(import.meta.dirname!, "../components/app-brand.tsx"), "utf-8");
    expect(src).toContain('lockup.height ? "min-w-0 shrink" : "shrink-0"');
    expect(src).toContain('"w-auto max-w-full"');
    expect(src).not.toContain("max-w-[20rem]");
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
