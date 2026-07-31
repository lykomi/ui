/**
 * Context badge components for the composer and sent messages.
 *
 * Renders user-selected context items as violet-tinted badges,
 * visually distinct from gray file attachment badges.
 *
 * - ComposerContextBadges: editable badges in the composer (with remove button)
 * - SentContextBadges: read-only badges on sent user messages
 */

import { type FC, createElement } from "react";
import { Pin, TextSelect, X, FileText, Link2, StickyNote, type LucideIcon } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
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

/** Editable badge in the composer with a remove button. */
const ComposerBadge: FC<{ item: ContextItem }> = ({ item }) => {
  const removeItem = useAppStore((s) => s.removeContextItem);
  const promoteItem = useAppStore((s) => s.promoteContextItem);
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
          <span className="text-xs text-foreground truncate">{item.label}</span>
          {isEphemeral && (
            <button
              type="button"
              onClick={() => promoteItem(item.id)}
              className="p-0.5 rounded hover:bg-primary/10 shrink-0"
              aria-label="Pin context"
            >
              <Pin className="size-3 text-muted-foreground" />
            </button>
          )}
          <button
            type="button"
            onClick={() => removeItem(item.id)}
            className="p-0.5 rounded hover:bg-primary/10 shrink-0"
            aria-label="Remove context"
          >
            <X className="size-3" />
          </button>
        </div>
      </TooltipTrigger>
      <TooltipContent side="top" className="whitespace-pre-line">
        {getBadgeTooltip(item)}
      </TooltipContent>
    </Tooltip>
  );
};

/** Read-only badge on a sent user message. Mirrors composer context chips. */
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

/** Renders ephemeral context badges in the composer (persistent items shown in ContextPins). */
export const ComposerContextBadges: FC = () => {
  const items = useAppStore((s) => s.contextItems);
  const ephemeral = items.filter((i) => i.persistence === "ephemeral");

  if (ephemeral.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-1.5">
      {ephemeral.map((item) => (
        <ComposerBadge key={item.id} item={item} />
      ))}
    </div>
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
