import type { ThreadMessage } from "@assistant-ui/react";
import type { RelayActivity } from "./types.ts";

/** Only describe work in the current user turn; prefer a call still in progress. */
export function currentRelayActivity(messages: readonly ThreadMessage[]): RelayActivity | null {
  let userIndex = messages.length - 1;
  while (userIndex >= 0 && messages[userIndex]?.role !== "user") userIndex--;
  if (userIndex < 0) return null;
  const tools = messages
    .slice(userIndex + 1)
    .flatMap((message) =>
      message.role === "assistant"
        ? message.content.filter((part) => part.type === "tool-call")
        : [],
    );
  const tool =
    [...tools].reverse().find((part) => part.result === undefined) ?? tools[tools.length - 1];
  return tool
    ? { toolName: tool.toolName, completed: tool.result !== undefined, args: tool.args }
    : null;
}
