---
"@iloveagents/foundry-web-ui": minor
"@iloveagents/foundry-web-shell": minor
---

Upgrade @assistant-ui/react to 0.15.x. The 0.12-era pin existed because
0.12.28's store/tap dependency graph was internally inconsistent; 0.15's
graph (tap ^0.9, store ^0.3) is consistent again. Migration surface was the
two `useComposerRuntime()` call sites (removed in 0.15) — now `useAui().composer`.
Ships a pnpm patch for @assistant-ui/store 0.3.2 replicating the merged-but-
unreleased upstream StrictMode fix (assistant-ui#5411): without it the
composer silently drops all typed input under `<StrictMode>` in dev.
