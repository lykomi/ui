---
"@iloveagents/foundry-web-ui": minor
---

Sidebar groups can focus on one subject without the tree jumping. `NavGroup.backTo` turns the group header into the way back — same label, typography and height, a back chevron in the collapse chevron's column — so nothing above the subject moves. `NavItem.presentation` draws a row flat inside a tree group (`"flat"`: no disclosure cell, quieter text, flush with the sidebar's flat rows) or as the heading the rows beneath belong to (`"heading"`: flat and emphasised like a section label, never collapsed, keeping icon, badges, actions and drop target; its children render one indent step left of a branch's, at their usual row size). Before this a way back drawn as a row sat in the twisty column and looked indented, and the subject sat level with its own children.
