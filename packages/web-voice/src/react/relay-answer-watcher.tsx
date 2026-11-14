/**
 * `RelayAnswerWatcher` — speaks the agent's answer, in `relay` mode.
 *
 * Render-less, mounted inside the assistant runtime (the same shape as
 * web-ui's `ComposerSubmitBridge`). It watches the last assistant
 * message as it streams and hands the prose to the bridge, which cuts it
 * into sentences and speaks them one at a time.
 *
 * Only **text** parts are spoken. Reasoning parts are the model thinking out
 * loud on the way to an answer, and tool calls are machinery — reading
 * either aloud would be worse than saying nothing.
 */

import { useEffect, useRef } from "react";
import { useAuiState, useVoiceState } from "@assistant-ui/react";
import type { ThreadMessage } from "@assistant-ui/react";
import type { VoiceBridge } from "../adapter/voice-bridge.ts";
import { currentRelayActivity } from "../adapter/relay-activity.ts";

export function RelayAnswerWatcher({ bridge }: { bridge: VoiceBridge }) {
  // The array identity changes on every streamed token, which is exactly
  // the update this component exists to observe. It renders nothing, so the
  // re-render costs a comparison and a `useEffect`.
  const messages = useAuiState((s) => s.thread.messages) as readonly ThreadMessage[];
  const status = useVoiceState()?.status.type;
  const running = useAuiState((s) => s.thread.isRunning);
  const userTurnId = [...messages].reverse().find((m) => m.role === "user")?.id ?? null;

  // Whatever is on screen when the session goes live was answered before the
  // user asked for voice. Reading it back at them is not a greeting, it is a
  // non-sequitur.
  const latest = useRef(messages);
  latest.current = messages;
  useEffect(() => {
    if (status !== "running") return;
    const lastAssistant = [...latest.current].reverse().find((m) => m.role === "assistant");
    bridge.primeAnswer(lastAssistant?.id ?? null);
  }, [bridge, status]);

  useEffect(() => {
    bridge.trackRelayRun(status === "running" && running ? userTurnId : null);
    return () => bridge.trackRelayRun(null);
  }, [bridge, status, running, userTurnId]);

  useEffect(() => {
    bridge.trackRelayActivity(
      status === "running" && running ? currentRelayActivity(messages) : null,
    );
  }, [bridge, messages, status, running]);

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
