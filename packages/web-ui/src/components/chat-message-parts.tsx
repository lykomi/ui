import { MessagePrimitive, groupPartByType } from "@assistant-ui/react";
import { MarkdownText } from "./markdown-text.tsx";
import { ReasoningMessagePartComponent } from "./reasoning-part.tsx";
import { ToolFallback } from "./tool-fallback.tsx";
import { ToolRunGroup } from "./tool-run-group.tsx";

/**
 * Coalesce adjacent tool calls into one `group-tool` node. Everything else
 * stays ungrouped and renders as its own leaf.
 */
const groupBy = groupPartByType({ "tool-call": ["group-tool"] });

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
 * Adjacent tool calls fold into one {@link ToolRunGroup} — a single summary row
 * over the cards, collapsed; see that component for why.
 *
 * Reading order is fixed rather than chronological: tool runs, then the
 * reasoning that explains them, then the answer. A model normally emits its
 * thinking FIRST, which put the least important row at the top of every
 * message and pushed the answer down. Flex `order` does the moving, so the
 * parts stay where the runtime put them in the DOM.
 */
export function ChatMessageParts() {
  return (
    <MessagePrimitive.GroupedParts groupBy={groupBy} indicator="never">
      {({ part, children }) => {
        switch (part.type) {
          case "group-tool":
            return (
              <ToolRunGroup indices={part.indices} isRunning={part.status?.type === "running"}>
                {children}
              </ToolRunGroup>
            );
          case "text":
            // The answer is ordered LAST so the message ends on its point,
            // with the reasoning row (order-1) sitting between the tool runs
            // and it. Tool groups keep the default order-0.
            return (
              <div className="order-2">
                <MarkdownText />
              </div>
            );
          case "reasoning":
            return <ReasoningMessagePartComponent text={part.text} />;
          case "tool-call":
            return part.toolUI ?? <ToolFallback {...part} />;
          default:
            return null;
        }
      }}
    </MessagePrimitive.GroupedParts>
  );
}
