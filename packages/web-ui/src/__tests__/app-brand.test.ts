/**
 * Unit tests for the brand-lockup decision in ``app-brand.tsx``.
 *
 * The component renders an image plus optional text, which is awkward to
 * assert from node-land without ``@testing-library/react`` (not a workspace
 * dep). The interesting logic is the branching over branding fields, exported
 * as ``_resolveBrandLockup`` for exactly this reason — same approach as
 * ``tool-fallback.tsx``.
 */

import { describe, expect, it } from "vitest";
import { _resolveBrandLockup } from "../components/app-brand.tsx";

describe("_resolveBrandLockup", () => {
  it("falls back to the generic glyph and the default name", () => {
    const l = _resolveBrandLockup({}, "light", true);
    expect(l.markUrl).toBeUndefined();
    expect(l.name).toBe("Foundry UI");
    // No mark at all → the name is the only thing identifying the app, so it
    // must render.
    expect(l.showName).toBe(true);
  });

  it("renders a wordmark ALONE — the name would stutter", () => {
    const l = _resolveBrandLockup(
      { appName: "Acme", logoUrl: "https://x/wordmark.png" },
      "light",
      true,
    );
    expect(l.markUrl).toBe("https://x/wordmark.png");
    expect(l.isIcon).toBe(false);
    expect(l.showName).toBe(false);
  });

  it("renders an icon WITH the name — that is the point of an icon", () => {
    const l = _resolveBrandLockup(
      { appName: "AI Navigator", iconUrl: "data:image/svg+xml,<svg/>" },
      "light",
      true,
    );
    expect(l.markUrl).toBe("data:image/svg+xml,<svg/>");
    expect(l.isIcon).toBe(true);
    expect(l.showName).toBe(true);
    expect(l.name).toBe("AI Navigator");
  });

  it("prefers the icon when a tenant supplies both", () => {
    // The Acme case: a wordmark was already configured, and adding an icon
    // is the explicit request to switch to "<mark> Product Name".
    const l = _resolveBrandLockup(
      {
        appName: "AI Navigator",
        logoUrl: "https://x/wordmark.png",
        iconUrl: "https://x/icon.svg",
      },
      "light",
      true,
    );
    expect(l.markUrl).toBe("https://x/icon.svg");
    expect(l.isIcon).toBe(true);
    expect(l.showName).toBe(true);
  });

  it("honours showName=false regardless of brand shape", () => {
    // Collapsed sidebar / tight headers pass this.
    expect(_resolveBrandLockup({ iconUrl: "i.svg" }, "light", false).showName).toBe(false);
    expect(_resolveBrandLockup({}, "light", false).showName).toBe(false);
  });

  describe("light/dark selection", () => {
    const branding = {
      iconUrl: "light-icon.svg",
      darkIconUrl: "dark-icon.svg",
      logoUrl: "light-logo.png",
      darkLogoUrl: "dark-logo.png",
    };

    it("picks the mode-specific asset", () => {
      expect(_resolveBrandLockup(branding, "light", true).markUrl).toBe("light-icon.svg");
      expect(_resolveBrandLockup(branding, "dark", true).markUrl).toBe("dark-icon.svg");
    });

    it("falls back across modes rather than rendering nothing", () => {
      // A tenant supplying only one variant should still get a mark in both
      // modes — a missing dark asset must not blank the header.
      expect(_resolveBrandLockup({ iconUrl: "only.svg" }, "dark", true).markUrl).toBe("only.svg");
      expect(_resolveBrandLockup({ darkIconUrl: "only.svg" }, "light", true).markUrl).toBe(
        "only.svg",
      );
      expect(_resolveBrandLockup({ darkLogoUrl: "only.png" }, "light", true).markUrl).toBe(
        "only.png",
      );
    });

    it("does not let a dark-only icon lose to a light wordmark in light mode", () => {
      // Cross-mode icon fallback still counts as an icon, so the name shows.
      const l = _resolveBrandLockup(
        { appName: "AI Navigator", darkIconUrl: "icon.svg", logoUrl: "wordmark.png" },
        "light",
        true,
      );
      expect(l.markUrl).toBe("icon.svg");
      expect(l.showName).toBe(true);
    });
  });
});
