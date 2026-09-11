---
"@iloveagents/foundry-web-ui": minor
---

Sidebar groups can focus on one item without the tree jumping. `NavGroup.focusOn` names the item's `to`: the header keeps its label, typography and height and leads back to the group's `to` (a back chevron in the collapse chevron's column), the item is drawn as an emphasised heading at the position it had before, with its children one step beneath it at their usual row size, and its siblings are not drawn — nothing moves up or sideways. The two shapes cross-fade briefly. Rows under a visible group header now indent under the header label like tree rows do, and the header's hover surface spans the row like an item row's. Before this a downstream app drew a focused group from the existing primitives and every part of it looked wrong on screen: a back row sat in the twisty column with a leaf dot, the subject sat level with its own children, promoted children grew to top-level row metrics, and the whole nav jumped.
