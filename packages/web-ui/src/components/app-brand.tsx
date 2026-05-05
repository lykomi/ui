import { Layers3 } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { useThemeRuntime } from "./theme-runtime-provider.tsx";

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
  const brandName = runtime.branding.appName || "eomi";
  const logoUrl =
    runtime.mode === "dark"
      ? runtime.branding.darkLogoUrl || runtime.branding.logoUrl
      : runtime.branding.logoUrl || runtime.branding.darkLogoUrl;
  const shouldShowName = showName && !logoUrl;

  return (
    <span className={cn("flex items-center gap-2", className)}>
      {logoUrl ? (
        <img
          src={logoUrl}
          alt={brandName}
          className={cn("h-5 w-auto max-w-[7rem] shrink-0 object-contain", iconClassName)}
        />
      ) : (
        <Layers3 className={cn("size-5 shrink-0 text-primary", iconClassName)} />
      )}
      {shouldShowName && <span className={cn("truncate", labelClassName)}>{brandName}</span>}
    </span>
  );
}
