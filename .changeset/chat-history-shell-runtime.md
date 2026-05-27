---
"@iloveagents/foundry-web-shell": minor
"@iloveagents/foundry-web-ui": minor
"@iloveagents/foundry-agent": minor
"@iloveagents/foundry-web-primitives": minor
---

shell: ChatConversationConfig API + sticky-runtime threadId

Lets a downstream module (e.g. `@ltwlf/spaces-web-ui`) attach a
`ChatConversationConfig` to its `ChatModule`. The shell then:

- Pre-mints a fresh thread UUID via `useRef` so the AG-UI runtime's
  `threadId` is defined from first render — no `undefined → defined`
  remount mid-conversation when the user sends the first message.
- Calls `config.useStickyConversationId()` (when declared) and
  feeds the resulting id into the runtime so the chat stays "live"
  while the user browses non-chat routes (Workspaces, Jobs, etc.).
- Per-config keyed child components (`StickyAwareRuntime` vs
  `UrlOnlyRuntime`) so optional hooks satisfy Rules-of-Hooks across
  multi-module config swaps.

UI: collapsible nav groups in `sidebar.tsx` with persisted state via
`useSyncExternalStore` + localStorage, plus stable group ordering via
new `priority` field in `nav-config.ts`.

`ag-ui-runtime-provider.tsx` accepts an external `threadId` and
`historyAdapterFactory` so the consuming app can wire its own
persistence (e.g. `ThreadHistoryAdapter` → REST `/api/conversations`).
