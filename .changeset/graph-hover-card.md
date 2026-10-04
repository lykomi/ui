---
"@iloveagents/foundry-web-graph": patch
---

Graph hover card follows the theme: an opaque `--popover` surface with `--popover-foreground` text, a muted kind line, a bold title and label/value rows. float-tooltip's injected translucent black sheet no longer wins the cascade, and the card carries no inline colours. Link rows stay out of the card, which follows the cursor and so cannot be clicked: it ends with a hint, "Click for details and links", and the drawer a click opens carries the working link.
