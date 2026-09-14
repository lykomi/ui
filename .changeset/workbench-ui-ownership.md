---
"@iloveagents/foundry-web-ui": minor
"@iloveagents/foundry-web-shell": patch
---

Expose the shared workbench presentation through a lazy-loadable web-ui/workbench entry point. Keep the shell responsible only for opt-in/runtime wiring, and split navigation, pane controls, resize handling, welcome content, and layout state into focused UI components and hooks. Preserve entity-field retargeting and sidebar contour updates.

Export the shared themed PinToggle and reuse the pin state glyph across content controls.
