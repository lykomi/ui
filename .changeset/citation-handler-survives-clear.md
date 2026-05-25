---
"@iloveagents/foundry-agent": patch
---

Fix `citationStore.clear()` so the registered handler survives per-conversation resets.

The previous implementation wiped both `results` AND `handler`. `useNewConversation` calls `clear()` on every "New Thread" click. Combined with the `registerOnce`-style handler registration in feature modules (e.g. SPACES' `registerSpacesCitationHandler`), the result was that all `[n]` citation markers in chat became inert non-clickable spans for the rest of the session after the first new-thread click. `clear()` now resets `results` only — the handler is module-level state and must persist.
