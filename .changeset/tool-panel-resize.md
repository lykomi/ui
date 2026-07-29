---
"@iloveagents/foundry-web-ui": minor
---

Tool panel: drag-to-resize the chat/content split, persisted per user.

The navigation sidebar was resizable but the tool-panel divider was not, so the split was fixed at whatever the viewport dictated. Adds a pointer- and keyboard-driven separator on the panel's left edge (arrows nudge, Shift jumps, Home/End to the extremes), clamped so neither side collapses (panel ≥ 360px, sibling ≥ 420px), persisted to `localStorage` and re-clamped against the current viewport on load. Inert in overlay and fullscreen modes. Exports `clampPanelWidth` and `MIN_PANEL_WIDTH`.
