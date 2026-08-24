/**
 * `RelayAnswerWatcher` — speaks the agent's answer, in `relay` mode.
 *
 * Render-less, mounted inside the assistant runtime (the same shape as
 * foundry-web-ui's `ComposerSubmitBridge`). It watches the last assistant
 * message as it streams and hands the prose to the bridge, which cuts it
 * into sentences and speaks them one at a time.
 *
 * Only **text** parts are spoken. Reasoning parts are the model thinking out
 * loud on the way to an answer, and tool calls are machinery — reading
 * either aloud would be worse than saying nothing.
 */

import { useEffect } from "react";
import { useAuiState } from "@assistant-ui/react";
import type { ThreadMessage } from "@assistant-ui/react";
import type { VoiceBridge } from "../adapter/voice-bridge.ts";

export function RelayAnswerWatcher({ bridge }: { bridge: VoiceBridge }) {
  // The array identity changes on every streamed token, which is exactly
  // the update this component exists to observe. It renders nothing, so the
  // re-render costs a comparison and a `useEffect`.
  const messages = useAuiState((s) => s.thread.messages) as readonly ThreadMessage[];

  useEffect(() => {
    const last = messages[messages.length - 1];
    if (!last || last.role !== "assistant") return;

    const text = last.content
      .filter((part): part is Extract<typeof part, { type: "text" }> => part.type === "text")
      .map((part) => part.text)
      .join("\n");
    if (!text) return;

    bridge.trackAnswer(last.id, text, last.status?.type !== "running");
  }, [bridge, messages]);

  return null;
}
