---
"@iloveagents/foundry-web-ui": patch
---

Sidebar: a flat group no longer renders the tree's leaf dot or reserves its
disclosure column. Whether a row is "in a tree" is decided per group, from
whether any item in it has children — so Workspaces keep the dot that lines
their leaves up, while New Thread, Activity and the chat list sit flush at
the sidebar's left edge.
