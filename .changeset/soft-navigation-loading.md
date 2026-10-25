---
"@iloveagents/foundry-web-ui": patch
---

Suppress brief navigation loading flashes. Show first-load status only after
150 milliseconds, fade it in gently and respect reduced motion. Loaded children
appear immediately and background refresh never inserts a status row.
