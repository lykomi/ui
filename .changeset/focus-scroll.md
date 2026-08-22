---
"@iloveagents/foundry-web-ui": patch
---

Focus mode scrolls. The fullscreen layer is portalled onto `document.body` (no ancestor transform or stacking context can trap it) and no longer scrolls itself; inside it the table becomes the scroll region on both axes with a sticky header, so the toolbar stays put while long, wide lists scroll. `DataTable` gains `fill` to force that layout outside a frame.
