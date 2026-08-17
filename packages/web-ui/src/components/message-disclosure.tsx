import { ChevronRight } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.tsx";
import type { ReactNode } from "react";

/**
 * The one row shape every foldaway inside an assistant message uses.
 *
 * Reasoning and tool runs are the same affordance — a quiet line the reader
 * can open when curious — but they were built twice and had drifted into two
 * different controls stacked on top of each other: one chevron pointing down
 * on the RIGHT of its label, another pointing right on the LEFT of its own,
 * different paddings, different hover treatments, different default states.
 * Read together in a transcript they looked like two unrelated widgets.
 *
 * So the shape lives here once. A row is: disclosure caret, the part's own
 * icon, its label — left-aligned in that order, on a single baseline, with
 * identical metrics. The caret is the FIRST thing in the row because it is
 * the control; the icon that follows says what kind of thing is folded away.
 *
 * Everything is understated on purpose. These rows sit between the user's
 * question and the answer, and they are machinery, not content: muted until
 * hovered, no border, no fill. The body indents under the label behind a
 * hairline rule, so an open row reads as a margin note rather than a second
 * message.
 */
export function MessageDisclosure({
  icon,
  label,
  open,
  onOpenChange,
  tone = "muted",
  placement = "inline",
  ariaLabel,
  children,
  ...rest
}: {
  /** The part's own icon — a brain, a wrench, a status glyph. */
  icon: ReactNode;
  label: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** ``destructive`` is for a run where everything failed; nothing else. */
  tone?: "muted" | "destructive";
  /**
   * ``after-tools`` sits the row between the tool runs and the answer,
   * wherever the model actually emitted it — reasoning belongs under the
   * work it explains and above the conclusion it produced. (The message
   * text is ordered after it; see `ChatMessageParts`.)
   *
   * It is a flex `order`, so the row moves VISUALLY while staying put in the
   * DOM. That is exactly why such a row carries a different attribute: the
   * compaction below is a DOM-sibling rule, and a row that is first in the
   * DOM but second on screen would otherwise hand its negative margin to
   * whichever row really is on top.
   */
  placement?: "inline" | "after-tools";
  ariaLabel?: string;
  children: ReactNode;
} & Record<`data-${string}`, unknown>) {
  return (
    <Collapsible
      open={open}
      onOpenChange={onOpenChange}
      // The message wraps its parts in `gap-4`, which is the right rhythm
      // between blocks of CONTENT and far too much between two 20px meta
      // rows — two foldaways alone put 64px of chrome above a one-line
      // answer. A row that directly follows another closes the gap to 4px,
      // so the machinery reads as one compact strip rather than a stack.
      {...(placement === "after-tools"
        ? { "data-message-disclosure-reordered": true }
        : { "data-message-disclosure": true })}
      className={cn(
        "w-full [[data-message-disclosure]_+_&]:-mt-3",
        placement === "after-tools" && "order-1",
      )}
      {...rest}
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          // Every disclosure trigger is addressable the same way — tests and
          // any future styling hook should not need to know which part it is.
          data-disclosure-trigger
          aria-label={ariaLabel}
          className={cn(
            "group/disclosure flex w-full items-center gap-1.5 rounded-md",
            "px-1.5 py-0.5 text-left text-xs transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tone === "destructive" && "text-destructive hover:text-destructive",
          )}
        >
          <ChevronRight
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 opacity-60 transition-transform duration-150",
              "group-hover/disclosure:opacity-100",
              open && "rotate-90",
            )}
          />
          <span className="flex size-3.5 shrink-0 items-center justify-center">{icon}</span>
          <span className="truncate">{label}</span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {/* Indented to the label column (caret + icon + both gaps), so the body
            hangs under the words rather than under the control. */}
        <div className="mt-1.5 ml-3 border-l border-border pl-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
