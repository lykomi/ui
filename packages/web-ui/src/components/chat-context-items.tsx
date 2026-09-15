import { FileText, Link2, StickyNote, TextSelect, X } from "lucide-react";
import { useNavigate } from "react-router";
import { useAppStore, type ContextItem } from "../lib/app-store.ts";
import { getNavigablePath } from "./context-bar.tsx";
import { PinStateIcon } from "./pin-state-icon.tsx";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";

const icons = { page: FileText, ref: Link2, note: StickyNote, selection: TextSelect };

/** All added context is managed in the With menu, regardless of its lifetime. */
export function ChatContextItems({
  items,
  onNavigate,
}: {
  items: ContextItem[];
  onNavigate: () => void;
}) {
  const navigate = useNavigate();
  const remove = useAppStore((s) => s.removeContextItem);
  const pin = useAppStore((s) => s.promoteContextItem);
  if (!items.length) return null;

  return (
    <section className="border-t border-border pt-3" aria-label="Added context">
      <h3 className="px-2 text-xs font-medium text-muted-foreground">Added context</h3>
      <ul className="mt-1">
        {items.map((item) => {
          const Icon = icons[item.type];
          const path = getNavigablePath(item);
          const pinned = item.persistence === "persistent";
          return (
            <li key={item.id} className="flex min-h-9 items-center gap-2 rounded-lg px-2 py-1">
              <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                {path ? (
                  <button
                    type="button"
                    className="block w-full truncate text-left text-sm hover:underline"
                    title={item.label}
                    onClick={() => {
                      navigate(path);
                      onNavigate();
                    }}
                  >
                    {item.label}
                  </button>
                ) : (
                  <span className="block truncate text-sm" title={item.label}>
                    {item.label}
                  </span>
                )}
                <span className="block text-xs text-muted-foreground">
                  {pinned ? "Pinned" : item.key ? "Follows selection" : "Next message"}
                </span>
              </div>
              {!pinned && (
                <TooltipIconButton
                  tooltip="Keep in context"
                  aria-label={`Pin ${item.label}`}
                  className="size-8 shrink-0 text-muted-foreground"
                  onClick={() => pin(item.id)}
                >
                  <PinStateIcon pinned={false} className="size-3.5" />
                </TooltipIconButton>
              )}
              <TooltipIconButton
                tooltip="Remove from context"
                aria-label={`Remove ${item.label}`}
                className="size-8 shrink-0 text-muted-foreground"
                onClick={() => remove(item.id)}
              >
                <X className="size-3.5" />
              </TooltipIconButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
