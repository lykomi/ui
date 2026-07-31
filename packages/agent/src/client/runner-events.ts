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
  | { type: "run-finished" }
  | { type: "run-error"; message: string }
  /**
   * Server liveness signal (AG-UI CUSTOM event named `heartbeat`, emitted by
   * the backend between real events so long tool calls / thinking phases are
   * distinguishable from a dead pipe). Carries the server-side elapsed run
   * time when provided. Consumers refresh their liveness clock; no UI yield.
   */
  | { type: "heartbeat"; elapsedMs?: number };
