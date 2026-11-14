import { type FC, createElement } from "react";
import { TextSelect, FileText, Link2, StickyNote, type LucideIcon } from "lucide-react";
import { cn } from "@lykomi/web-primitives";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip.tsx";
import { useAppStore, type ContextItem, type ContextItemType } from "../lib/app-store.ts";

const CONTEXT_ICONS: Record<ContextItemType, LucideIcon> = {
  selection: TextSelect,
  page: FileText,
  ref: Link2,
  note: StickyNote,
};

function ContextIcon({ type, className }: { type: ContextItemType; className?: string }) {
  return createElement(CONTEXT_ICONS[type] ?? TextSelect, { className });
}

/** Get tooltip text for a context item (source page or path). */
function getBadgeTooltip(item: ContextItem): string {
  const source =
    item.type === "page" && item.payload.kind === "page" ? item.payload.path : item.sourcePage;
  return `${item.label}\n${source}`;
}

/** Read-only badge on a sent user message. Records the context attached to that turn. */
const SentBadge: FC<{ item: ContextItem }> = ({ item }) => {
  const isEphemeral = item.persistence === "ephemeral";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "inline-flex items-center gap-1.5 max-w-70",
            "rounded-lg bg-primary/5",
            "px-2 py-1",
            isEphemeral ? "border border-dashed border-primary/40" : "border border-primary/20",
          )}
        >
          <ContextIcon type={item.type} className="size-3 text-primary shrink-0" />
          <span className="text-[11px] leading-tight text-foreground truncate">{item.label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="whitespace-pre-line">
        {getBadgeTooltip(item)}
      </TooltipContent>
    </Tooltip>
  );
};

/** Renders sent context badges on a user message (read-only). */
export const SentContextBadges: FC<{ messageId: string }> = ({ messageId }) => {
  const items = useAppStore((s) => s.sentContext[messageId]);

  if (!items || items.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1 mb-1">
      {items.map((item) => (
        <SentBadge key={item.id} item={item} />
      ))}
    </div>
  );
};
