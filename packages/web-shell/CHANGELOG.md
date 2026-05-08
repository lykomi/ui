# @iloveagents/foundry-web-shell

## 0.1.4

### Patch Changes

- Updated dependencies [07ace7e]
  - @iloveagents/foundry-agent@0.1.4
  - @iloveagents/foundry-web-ui@0.1.4
  - @iloveagents/foundry-web-primitives@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [d9b0460]
  - @iloveagents/foundry-agent@0.1.3
  - @iloveagents/foundry-web-ui@0.1.3
  - @iloveagents/foundry-web-primitives@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [30a4346]
  - @iloveagents/foundry-agent@0.1.2
  - @iloveagents/foundry-web-ui@0.1.2
  - @iloveagents/foundry-web-primitives@0.1.2

## 0.1.1

### Patch Changes

- 689d3e9: feat(sidebar): distinct file-drop affordance for nav containers

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

- Updated dependencies [689d3e9]
  - @iloveagents/foundry-web-ui@0.1.1
  - @iloveagents/foundry-agent@0.1.1
  - @iloveagents/foundry-web-primitives@0.1.1
