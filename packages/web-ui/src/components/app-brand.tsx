import { Layers3 } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import type { ThemeBranding } from "../lib/theme-runtime.ts";
import { useThemeRuntime } from "./theme-runtime-provider.tsx";

export interface BrandLockup {
  /** Image to render, or undefined to fall back to the generic glyph. */
  markUrl?: string;
  /** True when `markUrl` is a compact icon rather than a wordmark. */
  isIcon: boolean;
  name: string;
  showName: boolean;
  /** Validated CSS height for the mark, or undefined to use the default. */
  height?: string;
}

/**
 * Decide what the brand lockup renders. Exported (underscore-prefixed) so the
 * branching is unit-testable without a DOM renderer — same approach as
 * ``tool-fallback.tsx``.
 *
 * The rule worth stating: whether the name is printed depends on the *shape*
 * of the brand image. A wordmark already spells the brand out, so pairing it
 * with `appName` stutters ("Acme Acme"). An icon says nothing on its
 * own, so it needs the name to complete the lockup. Hence an icon wins over a
 * wordmark when both are set — supplying an icon is an explicit request for
 * "<mark> Product Name", which is what a tenant whose product name differs
 * from their company name is asking for.
 */
/**
 * A tenant-supplied length, or undefined.
 *
 * The value lands in an inline `style`, and a theme is content a tenant
 * authors — so this allowlists a shape rather than trying to spot bad ones.
 * Anything else (a `calc()`, a `var()`, a url, a second declaration smuggled
 * in behind a `;`) fails the pattern and the caller falls back to the default
 * height, which is always a safe thing to render.
 */
//: The tallest mark the header will render. A syntactically valid length is
//: not a SAFE one: `logoHeight: "320px"` is a plausible typo, and because the
//: mark is `shrink-0` it would push the sidebar and mobile-header actions off
//: screen rather than shrinking. Marks above this are clamped, not rejected —
//: a too-large value should look wrong, not vanish.
const MAX_LOGO_HEIGHT_REM = 4;
const REM_PER_UNIT: Record<string, number> = { rem: 1, em: 1, px: 1 / 16 };

export function _safeLogoHeight(value: string | undefined): string | undefined {
  if (!value) return undefined;
  // The integer part is optional: `.5rem` is a valid CSS length and a common
  // spelling, and silently falling back to the default for it would make the
  // contract a lie.
  const match = /^(\d*\.?\d+)(px|rem|em)$/.exec(value.trim());
  if (!match) return undefined;
  const [, rawNumber, unit] = match;
  const asRem = Number(rawNumber) * REM_PER_UNIT[unit];
  if (!Number.isFinite(asRem) || asRem <= 0) return undefined;
  return asRem > MAX_LOGO_HEIGHT_REM ? `${MAX_LOGO_HEIGHT_REM}rem` : value.trim();
}

export function _resolveBrandLockup(
  branding: ThemeBranding,
  mode: "light" | "dark",
  showName: boolean,
): BrandLockup {
  const isDark = mode === "dark";
  const pick = (dark?: string, light?: string) => (isDark ? dark || light : light || dark);

  const iconUrl = pick(branding.darkIconUrl, branding.iconUrl);
  const logoUrl = pick(branding.darkLogoUrl, branding.logoUrl);
  const markUrl = iconUrl || logoUrl;

  return {
    markUrl,
    isIcon: Boolean(iconUrl),
    name: branding.appName || "Foundry UI",
    showName: showName && (Boolean(iconUrl) || !markUrl),
    height: _safeLogoHeight(branding.logoHeight),
  };
}

export function AppBrand({
  showName = true,
  className,
  iconClassName,
  labelClassName,
}: {
  showName?: boolean;
  className?: string;
  iconClassName?: string;
  labelClassName?: string;
}) {
  const runtime = useThemeRuntime();
  const lockup = _resolveBrandLockup(runtime.branding, runtime.mode, showName);

  return (
    <span className={cn("flex items-center gap-2", className)}>
      {lockup.markUrl ? (
        <img
          src={lockup.markUrl}
          alt={lockup.name}
          style={lockup.height ? { height: lockup.height } : undefined}
          className={cn(
            "object-contain",
            // A custom mark must be able to SHRINK. `shrink-0` is right for the
            // 20px default, whose max-widths already fit every header; for a
            // taller one it is the thing that pushes the collapse button out
            // of the sidebar instead of letting the image narrow.
            lockup.height ? "min-w-0 shrink" : "shrink-0",
            // Both lock HEIGHT and let width follow the aspect ratio. Sizing an
            // icon into a square box (`size-5`) silently shrinks any mark that
            // is not 1:1 — `object-contain` letterboxes a 4:3 glyph to 20x15,
            // so it lands visibly smaller and thinner than the wordmark it
            // replaced. Marks are rarely square, so height is the only
            // dimension worth fixing. The max-width is just a runaway guard:
            // tighter for an icon, which has to leave room for the name.
            // `branding.logoHeight` overrides the HEIGHT, and the width is
            // bounded by the CONTAINER rather than by a number picked here.
            // The 7rem cap is sized for a 20px mark and would letterbox a
            // taller one; a bigger fixed cap is just a different wrong number
            // — 20rem is 320px while an expanded sidebar is 248px, so a 4:1
            // wordmark at the 4rem ceiling (256px) still overflowed it.
            // `max-w-full` is whatever the header actually has.
            lockup.height
              ? "w-auto max-w-full"
              : lockup.isIcon
                ? "h-5 w-auto max-w-8"
                : "h-5 w-auto max-w-[7rem]",
            iconClassName,
          )}
        />
      ) : (
        <Layers3 className={cn("size-5 shrink-0 text-primary", iconClassName)} />
      )}
      {lockup.showName && <span className={cn("truncate", labelClassName)}>{lockup.name}</span>}
    </span>
  );
}
