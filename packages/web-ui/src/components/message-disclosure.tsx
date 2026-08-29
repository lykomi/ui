import { ChevronDown } from "lucide-react";
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
 * So the shape lives here once. A row is: the part's own icon, its label,
 * then the disclosure caret — on a single baseline, with identical metrics.
 * The icon leads because it is the glyph that carries meaning (what kind of
 * thing is folded away, and whether it went well); the caret trails, where
 * the eye lands after the words and where every chat client puts it.
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
  ariaLabel,
  forceMount,
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
  ariaLabel?: string;
  /**
   * Keep the body mounted while the row is closed, hidden rather than absent.
   *
   * For a row whose contents are only text this is waste. For one holding tool
   * cards it is correctness: a tool UI may DO something when its result lands
   * — open a panel, fold the result into the workspace already on screen — and
   * an unmounted card never runs. That made the fold decide whether a result
   * was processed, which is not a disclosure's job. Seen live: a graph
   * expansion the agent narrated correctly and the panel never received.
   */
  forceMount?: boolean;
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
      data-message-disclosure
      // Rows render where the model put them. There was once an
      // ``after-tools`` placement that moved a row with flex `order` — and a
      // separate data attribute, because the compaction below is a
      // DOM-SIBLING rule and a row that is first in the DOM but second on
      // screen would hand its negative margin to the wrong neighbour. Both
      // are gone: the reordering existed to keep a reasoning row from sitting
      // above a short answer, which folding the machinery into one quiet row
      // already solves.
      className="w-full [[data-message-disclosure]_+_&]:-mt-3"
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
            // `w-fit` with `-ml-1.5`: the row is a pill that hugs its own
            // words, and the negative margin cancels the padding so the
            // ICON lines up with the message text's left edge rather than
            // sitting 6px inside it. Full-width was worse on both counts —
            // it made a hover target the width of the message, and it left
            // the caret stranded at the far right once the caret moved.
            "group/disclosure -ml-1.5 flex w-fit max-w-full items-center gap-1.5 rounded-md",
            "px-1.5 py-0.5 text-left text-xs transition-colors",
            "text-muted-foreground hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            tone === "destructive" && "text-destructive hover:text-destructive",
          )}
        >
          <span className="flex size-3.5 shrink-0 items-center justify-center">{icon}</span>
          <span className="truncate">{label}</span>
          {/* The caret TRAILS the label. It led for a while, on the reasoning
              that the caret is the control and controls come first — but that
              put two glyphs in front of every row and left the status icon,
              which is the one that carries meaning, in second place. Reading
              order is now icon, words, control.
              Trailing carets point DOWN when closed ("opens downward") and up
              when open, which is the opposite of the leading convention: a
              leading caret points right and rotates 90° to point at the
              content. Same rotation trick, different rest position — swapping
              the position without swapping the glyph would have left it
              pointing sideways at nothing. */}
          <ChevronDown
            aria-hidden="true"
            className={cn(
              "size-3.5 shrink-0 opacity-60 transition-transform duration-150",
              "group-hover/disclosure:opacity-100",
              open && "rotate-180",
            )}
          />
        </button>
      </CollapsibleTrigger>
      {/* `forceMount` keeps Radix from unmounting the body, and then leaves it
          VISIBLE — it assumes the host hides a `data-state="closed"` panel in
          CSS, which is how its animated examples work. We have no animation
          here, so the `hidden` attribute is the honest way to say it: gone
          from the page and gone from the accessibility tree, without a
          stylesheet having to agree. Radix spreads our props over its own
          `hidden`, so this wins — but only when we pass it, hence the
          conditional rather than a `hidden={undefined}` that would blank
          Radix's value on the ordinary path. */}
      <CollapsibleContent {...(forceMount ? { forceMount: true, hidden: !open } : {})}>
        {/* Indented under the label, so the body hangs beneath the words
            rather than beneath the row's left edge. */}
        <div className="mt-1.5 ml-3 border-l border-border pl-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}
