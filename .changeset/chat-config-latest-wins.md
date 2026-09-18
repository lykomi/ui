---
"@iloveagents/foundry-web-shell": patch
---

Chat config: only the latest request may write. The boot load and context refreshes can overlap, and an older, slower response used to overwrite the current context's reasoning level and context window, or clear them on failure.
