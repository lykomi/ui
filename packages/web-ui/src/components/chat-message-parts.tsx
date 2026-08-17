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
 * Tool calls collapse behind {@link ToolRunGroup}; see that component for why
 * the details are hidden by default.
 */
export function ChatMessageParts() {
  return (
    <MessagePrimitive.GroupedParts groupBy={groupBy} indicator="never">
      {({ part, children }) => {
        switch (part.type) {
          case "group-tool":
            return (
              <ToolRunGroup
                indices={part.indices}
                isRunning={part.status?.type === "running"}
              >
                {children}
              </ToolRunGroup>
            );
          case "text":
            return <MarkdownText />;
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
