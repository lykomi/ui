---
"@iloveagents/foundry-web-ui": patch
---

web-ui(sidebar): align group-header labels (CHATS, WORKSPACES, ADMIN, …)
with the leftmost edge of their item labels

Previously the collapsible group header used `px-3` on the outer wrapper
and a `size-6` chevron, while item rows used `pl-5` (depth-0 indent) +
`size-3.5` icon + `gap-2`. Result: group labels landed at ~36px from the
sidebar edge while item labels landed at 42px — group labels drifted
right of the children they introduced and the visual rhythm broke.

Make the header's leading column a shared `SIDEBAR_ITEM_ICON_CLASS` +
`SIDEBAR_ITEM_GAP_CLASS` cell — the same constants item icons use — so
every group label (collapsible, link-style, or plain) lands at the same
x-coordinate as item labels. The chevron now sits in the icon column;
its hit-area is preserved at 28px via `-m-2 p-2` (negative-margin
absorbs the extra padding so the visual cell stays 14px and label
geometry doesn't shift).

Non-collapsible header branches get an explicit invisible spacer of the
same width so their labels align too.
