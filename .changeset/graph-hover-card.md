---
"@iloveagents/foundry-web-graph": patch
---

Graph hover card follows the theme: an opaque `--popover` surface with `--popover-foreground` text, a muted kind line, a bold title and label/value rows. float-tooltip's injected translucent black sheet no longer wins the cascade, and the card carries no inline colours. The card follows the cursor and so cannot be clicked: in the full view its link rows stay out of it, and it ends with "Click for details", since the drawer a click opens carries the working links. An inline graph, with no drawer, keeps those rows as text and promises no click.
