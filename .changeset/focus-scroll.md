---
"@iloveagents/foundry-web-ui": patch
---

Focus mode scrolls. The fullscreen layer no longer scrolls itself; inside it the table becomes the scroll region on both axes with a sticky header, so the toolbar stays put while long, wide lists scroll. Entering and leaving focus only swaps the frame's classes, so the list keeps its state and its theme scope. `DataTable` gains `fill` to request that layout outside a frame.
