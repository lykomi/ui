---
"@iloveagents/foundry-agent": minor
"@iloveagents/foundry-web-ui": patch
---

Complete AG-UI protocol coverage in the runner.

The runner previously subscribed to a subset of the protocol and silently
dropped the rest. It now handles every event type the spec defines:

- `STATE_SNAPSHOT` / `STATE_DELTA` — published as an `agent-state` runner event
  and exposed through a new `agentStateStore`, so pages can react to
  server-driven state instead of reaching into the transport. The AG-UI client
  already applied the JSON Patch; this forwards the result plus the patch.
- `MESSAGES_SNAPSHOT` — server-authoritative history (e.g. after backend
  compaction), forwarded without disturbing the in-flight turn. Upstream saw
  mid-run snapshots truncate a streaming answer, so the streaming message is
  deliberately left alone.
- `ACTIVITY_SNAPSHOT` / `ACTIVITY_DELTA` — generative-UI surfaces (MCP apps,
  A2UI), passed through verbatim for hosts that render them.
- `RAW` — provider passthrough, never interpreted.
- `REASONING_START` / `REASONING_MESSAGE_END` — the reasoning block boundaries
  that were still missing.

The chunked and legacy variants (`TEXT_MESSAGE_CHUNK`, `TOOL_CALL_CHUNK`,
`THINKING_*`) need no handlers: `@ag-ui/client` normalizes them onto the
canonical events before the subscriber sees them.

Also adds `autoCancelPendingToolCalls` (default on): a client-side tool that
starts but never produces a result is settled with an error instead of being
left dangling. An unanswered call makes the model re-issue the tool and then
report that it "didn't complete", and the Responses API rejects a replayed
history whose `function_call` has no matching output.
