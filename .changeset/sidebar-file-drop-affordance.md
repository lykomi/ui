---
"@iloveagents/foundry-web-ui": patch
"@iloveagents/foundry-agent": patch
"@iloveagents/foundry-web-primitives": patch
"@iloveagents/foundry-web-shell": patch
---

feat(sidebar): distinct file-drop affordance for nav containers

`useNavItemDnd` now exposes `isFileDragOver` separately from `isDragOver`
so consuming nav items can render a prominent file-drop visual (dashed
primary outline + soft primary background + Upload icon) when the user
is dragging native files over the container. Previously file drags
shared the same subtle ring as entity-move drags, so users couldn't
tell that a folder accepted external files. Applies to all five nav-
item shapes (action-row leaf, button leaf, `NestedFolderItem`,
`CollapsibleNavItem` with children/actions, `NavLink` fallthrough) and
updates `ContainerDropZone` for visual parity.

Also fixes a related regression: the capture-phase
`onDragEnterCapture` / `onDragOverCapture` handlers were calling
`e.stopPropagation()`, which short-circuits React's synthetic dispatch
and prevented the bubble-phase `onDragEnter` (where state actually
mutates) from running. Removed — `preventDefault()` alone is enough to
mark the element as droppable.
