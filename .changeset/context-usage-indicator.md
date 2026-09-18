---
"@iloveagents/foundry-agent": minor
"@iloveagents/foundry-web-ui": minor
"@iloveagents/foundry-web-shell": minor
---

Show how full a conversation is. The runner now surfaces the server's per-call `usage` CUSTOM event as a `usage` runner event, and the chat adapter records it per thread in the new `contextUsageStore`. The chat context card ("With …") gains a "Conversation memory" section: a bar with the fill and its ceiling, and a plain sentence about what happens as it fills. When the fill passes 90% the bar turns amber and the context row shows a small dot. The section prefers `context_used_tokens` / `context_limit_tokens` from the usage event, which are in the server's own units and exclude the system prompt and tool declarations. Otherwise it uses the latest call's input size against a window the host states via `/api/chat/config` as `context.windowTokens`. `useConversationMemory()` and `ConversationMemory` are exported. The adapter's React context moved to `ag-ui-adapter-context.ts`, which exports `useCurrentThreadId()`, so components can read the current thread without importing the runtime provider.
