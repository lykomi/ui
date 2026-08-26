---
"@iloveagents/foundry-web-ui": minor
---

Add a `sidebarIcon` theme slot

The sidebar's idle-row icons were hardcoded to `text-sidebar-foreground/60`,
so the only way to colour them from a theme was `sidebarForeground` — which is
the LABEL colour. Reaching the icons through it turned every sidebar label the
brand colour too, which is why a brand whose mark is a colour could not match
its own product.

`sidebar.sidebarIcon` colours those icons on their own, in the expanded rows
and the collapsed rail alike. Unset, it resolves to the previous value (the
label colour at 60%), so no existing theme moves. Active rows keep using
`primary`, so the active/idle distinction the component encodes is untouched.
