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
          className={cn(
            "shrink-0 object-contain",
            // Both lock HEIGHT and let width follow the aspect ratio. Sizing an
            // icon into a square box (`size-5`) silently shrinks any mark that
            // is not 1:1 — `object-contain` letterboxes a 4:3 glyph to 20x15,
            // so it lands visibly smaller and thinner than the wordmark it
            // replaced. Marks are rarely square, so height is the only
            // dimension worth fixing. The max-width is just a runaway guard:
            // tighter for an icon, which has to leave room for the name.
            lockup.isIcon ? "h-5 w-auto max-w-8" : "h-5 w-auto max-w-[7rem]",
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
