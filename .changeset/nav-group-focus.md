---
"@iloveagents/foundry-web-ui": minor
---

Sidebar groups can focus on one item without the tree jumping. `NavGroup.focusOn` names the item's `to`: the header keeps its label, typography and height and leads back to the group's `to` (a back chevron in the collapse chevron's column), the item is drawn as a flat, emphasised heading with its children beneath it — one indent step left of a branch's children, at their usual row size — and its siblings are not drawn. The new shape fades in briefly when the focus changes, in either direction. Rows under a visible group header now indent under the header label like tree rows do, and the header's hover surface spans the row like an item row's. Before this a downstream app drew a focused group from the existing primitives and every part of it looked wrong on screen: a back row sat in the twisty column with a leaf dot, the subject sat level with its own children, promoted children grew to top-level row metrics, and the whole nav jumped.
