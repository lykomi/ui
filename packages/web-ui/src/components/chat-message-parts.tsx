import { MessagePrimitive, groupPartByType } from "@assistant-ui/react";
import { MarkdownText } from "./markdown-text.tsx";
import { OpenPanelOutputs } from "./open-panel-outputs.tsx";
import { ReasoningMessagePartComponent } from "./reasoning-part.tsx";
import { ToolFallback } from "./tool-fallback.tsx";
import { TurnActivity } from "./turn-activity.tsx";

/**
 * A turn's machinery nests under a `group-activity` node; inside it, adjacent
 * tool calls still coalesce into `group-tool`.
 *
 * Text is deliberately absent from this map. The model's prose stays
 * ungrouped, so it can never end up inside the fold — and because grouping
 * coalesces ADJACENT parts, each stretch of prose also ends one activity node
 * and starts the next. That is the intent: a multi-step turn reads as work,
 * what it learned, work, what it learned, answer.
 */
const groupBy = groupPartByType({
  "tool-call": ["group-activity", "group-tool"],
  reasoning: ["group-activity"],
});

/**
 * The parts of an assistant message — ONE renderer, used by every chat
 * surface.
 *
 * The bubble and the expanded chat used to configure `MessagePrimitive.Parts`
 * separately, and had drifted: the expanded chat passed a `tools` fallback and
 * rendered full tool cards, the bubble passed none and so rendered assistant-ui's
 * default. Same conversation, two different transcripts depending on which
 * window you happened to have open. Composing this component instead of
 * hand-rolling a parts config is what keeps them honest — there is now only
 * one place to drift from.
 *
 * Each stretch of machinery folds into one {@link TurnActivity} — a single
 * summary row over the cards and the thinking, collapsed; see that component
 * for why.
 *
 * Reading order is CHRONOLOGICAL, throughout. It briefly was not: text
 * carried a flex `order` that floated every prose part to the bottom of the
 * message, to keep a reasoning row from sitting above a one-line answer.
 * With the machinery folded into a quiet 20px row that argument is spent,
 * and the hoist actively hurt — in a multi-step turn it stripped the
 * narration out from between the work and stacked the bare rows into the
 * ladder this component exists to prevent. It also glued consecutive prose
 * parts into one run-on paragraph. Parts now render where the model put
 * them.
 */
export function ChatMessageParts() {
  return (
    <MessagePrimitive.GroupedParts groupBy={groupBy} indicator="never">
      {({ part, children }) => {
        switch (part.type) {
          case "group-activity":
            return (
              <>
                <TurnActivity indices={part.indices} isRunning={part.status?.type === "running"}>
                  {children}
                </TurnActivity>
                <OpenPanelOutputs indices={part.indices} />
              </>
            );
          case "group-tool":
            // Inside the activity fold, so NOT another collapsed row —
            // opening one disclosure only to meet a second is a maze. The
            // cards render directly; the count already showed on the row
            // above.
            return <div className="flex flex-col gap-2">{children}</div>;
          case "text":
            // The wrapper is load-bearing, though it carries no classes.
            // `MarkdownText` renders `<ReactMarkdown>` directly, which emits
            // its top-level blocks into a FRAGMENT — without an element to
            // hold them, every paragraph, list and code block becomes a
            // direct child of the message's `gap-4` flex container and picks
            // up 16px of message-part spacing between them, on top of their
            // own margins. It used to be the `order-2` div; the ordering went
            // away, the wrapper must not.
            return (
              <div>
                <MarkdownText />
              </div>
            );
          case "reasoning":
            // Plain inside the fold, rather than behind a second disclosure.
            //
            // Its POSITION is only as chronological as the parts array it is
            // given. Replayed history preserves the model's interleaving;
            // the live adapter does not — it accumulates all reasoning into a
            // single part emitted ahead of every tool call, so a live
            // reasoning A → tool A → reasoning B → tool B arrives as
            // reasoning A+B → tool A → tool B. That is the adapter's to fix,
            // and rendering in place is right either way; this note is here
            // so the next reader does not take the ordering on faith.
            return <ReasoningMessagePartComponent text={part.text} nested />;
          case "tool-call":
            return part.toolUI ?? <ToolFallback {...part} />;
          default:
            return null;
        }
      }}
    </MessagePrimitive.GroupedParts>
  );
}
