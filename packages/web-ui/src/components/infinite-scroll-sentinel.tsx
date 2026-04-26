import { useEffect, useRef } from "react";

import { cn } from "@lastspace/web-primitives";

export function InfiniteScrollSentinel({
  enabled,
  loading,
  onVisible,
  className,
}: {
  enabled: boolean;
  loading?: boolean;
  onVisible: () => void;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const pendingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !loading) {
      pendingRef.current = false;
    }
  }, [enabled, loading]);

  useEffect(() => {
    if (!enabled || !ref.current) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting) && !pendingRef.current) {
          pendingRef.current = true;
          onVisible();
        }
      },
      { rootMargin: "240px 0px" },
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [enabled, onVisible]);

  return (
    <div
      ref={ref}
      className={cn("flex h-12 items-center justify-center text-sm text-muted-foreground", className)}
    >
      {enabled ? (loading ? "Loading more..." : "Scroll for more") : null}
    </div>
  );
}
