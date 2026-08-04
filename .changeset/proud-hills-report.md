---
"@iloveagents/foundry-web-shell": minor
---

`loadChatConfig` accepts opaque query params and forwards the backend's `scope`; new `refreshChatConfig(params?)` lets host apps re-resolve the `Auto` reasoning level when the user's context changes (e.g. switching workspace). The params are opaque to this package — the backend defines what they mean. Before shell boot `refreshChatConfig` is a safe no-op.
