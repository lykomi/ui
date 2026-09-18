---
"@iloveagents/foundry-agent": minor
"@iloveagents/foundry-web-ui": minor
"@iloveagents/foundry-web-shell": minor
---

Show how full a conversation is. The runner now surfaces the server's per-call `usage` CUSTOM event as a `usage` runner event, the chat adapter records it per thread in the new `contextUsageStore`, and `ContextUsageIndicator` (a small ring beside the reasoning picker in both composers) draws how full the conversation is. When the server adds `context_used_tokens` and `context_limit_tokens` to the usage event, the ring uses that pair, which is in its own units and excludes the system prompt and tool declarations the raw model count includes. Otherwise it draws the latest call's input size against a window the host states via `/api/chat/config` as `context.windowTokens`. It warns at 80% and turns destructive at 95%. With no stated window, or before a thread's first model call, it renders nothing. The adapter's React context moved to `ag-ui-adapter-context.ts` so composer controls can read the current thread without importing the runtime provider; `useCurrentThreadId()` is exported from there.
