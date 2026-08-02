---
name: foundry-verify-agent-apis
description: Ground yourself in the CURRENT APIs before writing or editing code that touches @assistant-ui/*, @ag-ui/*, @iloveagents/foundry-*, or the Microsoft Agent Framework. This stack moves fast and training data on it is stale — always verify against live docs/samples first. Use before implementing tool UIs, AG-UI transports, agent endpoints, or upgrading any of these packages.
---

Training-data knowledge of this stack is unreliable. Before writing code, verify against a live source:

## Where to verify

| Surface                                 | Source of truth                                                                                             | How                                                                                  |
| --------------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Microsoft Agent Framework (Python/.NET) | [microsoft/agent-framework](https://github.com/microsoft/agent-framework) `python/samples/`                 | Fetch the closest sample to your use case FIRST — the samples directory is canonical |
| `@assistant-ui/react`                   | [assistant-ui docs](https://www.assistant-ui.com/docs), version-pinned                                      | `context7` MCP with the pinned version, or WebFetch                                  |
| `@ag-ui/*` (AG-UI protocol)             | [docs.ag-ui.com](https://docs.ag-ui.com/) + [ag-ui-protocol/ag-ui](https://github.com/ag-ui-protocol/ag-ui) | WebFetch / context7                                                                  |
| Azure Foundry / Azure services          | learn.microsoft.com                                                                                         | `microsoft_docs_mcp` (search + fetch)                                                |

## Non-negotiables for this stack (verify they still hold, then follow)

- `@assistant-ui/react` is pinned to **0.15.x**. Tool UIs use `makeAssistantToolUI(...)`. The per-scope runtime hooks (`useComposerRuntime`, `useThreadRuntime`, `useMessageRuntime`, …) were removed in 0.15 — use `useAui()` / `useAuiState()`.
- An official `@assistant-ui/react-ag-ui` provider exists, but **this stack deliberately does not use it** — do not import it or migrate onto it. It drops AG-UI `CUSTOM`/`RAW` events (killing heartbeats and citations) and has no stalled-stream watchdog. The protocol engine here is `AGUIRunner` (`@iloveagents/foundry-agent`): it drives `HttpAgent.runAgent()` with an `AgentSubscriber` and yields a normalized `RunnerEvent` stream; `@iloveagents/foundry-web-ui` ships the assistant-ui shim that turns those into cumulative `ChatModelRunResult` yields. See the root `AGENTS.md` for the rationale and the conditions for revisiting.
- Agent Framework (Python): `from agent_framework import Agent, tool` — `Agent`, NOT `ChatAgent`; `@tool`, NOT `ai_function`; `Agent(client=..., ...)`, NOT `chat_client=`. AG-UI endpoint via `from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint`. Re-verify against the samples anyway — these have changed before.
- `@iloveagents/foundry-agent` is cross-runtime: zero React, zero DOM, zero `@assistant-ui/*`. Never add those imports to transport-level code.

## Procedure

1. Identify which of the four surfaces your change touches.
2. Fetch the closest current sample/doc for it (table above).
3. Diff what you fetched against what you were about to write; prefer the fetched pattern.
4. Only then write code.
