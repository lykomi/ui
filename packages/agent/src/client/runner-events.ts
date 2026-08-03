import type { StreamingStatus } from "../store/streaming-status-store.ts";

/**
 * Normalized event stream emitted by `AGUIRunner.run()`. The runner is
 * framework-agnostic; consumers (e.g. the assistant-ui shim in
 * `@iloveagents/foundry-web-ui`) translate these events into their own runtime model.
 *
 * `request-sent` carries the exact AG-UI request payload — used by host
 * dev-tooling to capture each turn.
 *
 * `turn-started` fires at the top of every iteration of the multi-turn loop
 * (initial request + each client-tool follow-up). Consumers reset their
 * per-turn buffers (e.g. `currentText`) here.
 */
export type RunnerEvent =
  | { type: "request-sent"; input: Record<string, unknown> }
  | { type: "turn-started" }
  | { type: "run-started" }
  | { type: "text-delta"; delta: string }
  | { type: "text-message-end" }
  | { type: "tool-call-start"; id: string; name: string; isClientSide: boolean }
  | { type: "tool-call-args"; id: string; delta: string }
  | { type: "tool-call-end"; id: string; args: string; result?: unknown; isError?: boolean }
  | { type: "tool-call-result"; id: string; result: unknown; isError: boolean }
  | { type: "streaming-status"; status: StreamingStatus }
  /**
   * Model reasoning/thinking text (AG-UI `REASONING_*`; the deprecated
   * `THINKING_*` events are normalized onto these by `@ag-ui/client`'s
   * backward-compatibility middleware). Kept separate from `text-delta`
   * because reasoning is not the answer — consumers render it as its own
   * collapsed part, never inline with the reply.
   */
  | { type: "reasoning-delta"; delta: string }
  | { type: "reasoning-end" }
  /**
   * Named agent step (AG-UI `STEP_STARTED` / `STEP_FINISHED`). A long
   * agentic run otherwise presents as one opaque "thinking" state for
   * minutes; the step name is what makes the wait legible.
   */
  | { type: "step-started"; name: string }
  | { type: "step-finished"; name: string }
  /**
   * Agent state published by the server (`STATE_SNAPSHOT` / `STATE_DELTA`).
   * The AG-UI client applies deltas (JSON Patch) to its own state; this
   * event carries the RESULT so consumers can react without reaching into
   * the client. `patch` is present only for deltas, for consumers that want
   * to know what changed rather than just the new value.
   */
  | { type: "agent-state"; state: unknown; patch?: unknown[] }
  /**
   * Server-authoritative history replacement (`MESSAGES_SNAPSHOT`). Emitted
   * when the backend rewrites the conversation — e.g. after compaction. The
   * runner does NOT interrupt an in-flight message for this: upstream saw
   * mid-run snapshots truncate streaming answers, so consumers should
   * reconcile persisted history and leave the streaming turn alone.
   */
  | { type: "messages-snapshot"; messages: unknown[] }
  /**
   * Generative-UI surface (`ACTIVITY_SNAPSHOT` / `ACTIVITY_DELTA`) — MCP
   * apps and A2UI. Passed through verbatim; hosts that don't render
   * activities can ignore it.
   */
  | {
      type: "activity";
      messageId: string;
      activityType: string;
      content?: unknown;
      patch?: unknown[];
    }
  /**
   * Provider passthrough (`RAW`). Never interpreted here — hosts use it for
   * provider-specific behaviour and debugging.
   */
  | { type: "raw"; event: unknown; source?: string }
  | { type: "run-finished" }
  | { type: "run-error"; message: string }
  /**
   * Server liveness signal (AG-UI CUSTOM event named `heartbeat`, emitted by
   * the backend between real events so long tool calls / thinking phases are
   * distinguishable from a dead pipe). Carries the server-side elapsed run
   * time when provided. Consumers refresh their liveness clock; no UI yield.
   */
  | { type: "heartbeat"; elapsedMs?: number };
