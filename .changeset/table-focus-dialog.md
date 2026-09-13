---
"@iloveagents/foundry-web-ui": patch
"@iloveagents/foundry-web-shell": patch
---

Use an accessible full-screen dialog for table focus mode, retaining the mounted table and restoring keyboard focus when closing. The dialog escapes narrow containers and retains theme context.

When an assistant runtime is available, focus mode offers the existing conversation in a collapsed chat pane. Source references open beside the focused content. Agent state includes the focused surface and bounded table contents.

Unify workbench list typography and navigation behavior. Recalculate composer height on pane resizing and keep an empty composer compact.
