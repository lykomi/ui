/** Shared placeholder geometry for contextual actions, starters and recent chats. */
export function ActionListSkeleton({
  label,
  rows = 3,
  secondaryText = false,
}: {
  label: string;
  rows?: number;
  secondaryText?: boolean;
}) {
  return (
    <div role="status" aria-label={label} aria-busy="true" className="w-full space-y-2">
      <div aria-hidden="true" className="h-4 w-24 rounded bg-muted motion-safe:animate-pulse" />
      {Array.from({ length: rows }, (_, index) => (
        <div
          key={index}
          aria-hidden="true"
          className="flex min-h-9 items-center gap-2 px-2 py-2 [@media(pointer:coarse)]:min-h-11"
        >
          <span className="size-4 shrink-0 rounded bg-muted motion-safe:animate-pulse" />
          <div className="flex-1 space-y-1">
            <div className="h-4 w-3/4 rounded bg-muted motion-safe:animate-pulse" />
            {secondaryText && (
              <div className="h-3 w-1/2 rounded bg-muted motion-safe:animate-pulse" />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
