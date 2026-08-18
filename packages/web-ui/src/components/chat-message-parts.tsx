import { MessagePrimitive, groupPartByType } from "@assistant-ui/react";
import { MarkdownText } from "./markdown-text.tsx";
import { ReasoningMessagePartComponent } from "./reasoning-part.tsx";
import { ToolFallback } from "./tool-fallback.tsx";
import { TurnActivity } from "./turn-activity.tsx";

/**
 * Everything a turn did before answering nests under ONE `group-activity`
 * node; inside it, adjacent tool calls still coalesce into `group-tool`.
 *
 * Text is deliberately absent from this map: the answer stays ungrouped, so
 * it can never end up inside the fold.
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
 * Everything the turn did folds into one {@link TurnActivity} — a single
 * summary row over the cards and the thinking, collapsed; see that component
 * for why.
 *
 * The work folds into ONE row per turn — see {@link TurnActivity} — with the
 * answer outside it. Reading order at the message level is still fixed
 * rather than chronological (machinery, then the answer, so a message ends
 * on its point); INSIDE the fold order is chronological, because reasoning
 * explains the calls that follow it.
 */
export function ChatMessageParts() {
  return (
    <MessagePrimitive.GroupedParts groupBy={groupBy} indicator="never">
      {({ part, children }) => {
        switch (part.type) {
          case "group-activity":
            return (
              <TurnActivity indices={part.indices} isRunning={part.status?.type === "running"}>
                {children}
              </TurnActivity>
            );
          case "group-tool":
            // Inside the activity fold, so NOT another collapsed row —
            // opening one disclosure only to meet a second is a maze. The
            // cards render directly; the count already showed on the row
            // above.
            return <div className="flex flex-col gap-2">{children}</div>;
          case "text":
            // The answer is ordered LAST so the message ends on its point,
            // below the single activity row (order-1).
            return (
              <div className="order-2">
                <MarkdownText />
              </div>
            );
          case "reasoning":
            // Same reason: plain inside the fold, in the chronological slot
            // where the model produced it.
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
