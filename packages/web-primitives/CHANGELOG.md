# @iloveagents/foundry-web-primitives

## 0.2.0

### Minor Changes

- shell: ChatConversationConfig API + sticky-runtime threadId — bumped as
  part of the fixed group with `foundry-web-shell` / `foundry-web-ui` /
  `foundry-agent`. No direct source changes in this package.

### NOTE: 1.0.0 / 1.0.1 were accidental

These version numbers were published briefly on 2026-05-27 due to the
peerDep cascade bug in the sibling packages (see `foundry-agent`'s 0.2.0
changelog entry), then unpublished. The version numbers themselves are
now permanently reserved on npm and CANNOT be re-published. Do not
depend on 1.0.x.

## 0.1.5

## 0.1.4

## 0.1.3

## 0.1.2

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
