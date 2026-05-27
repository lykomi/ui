# @iloveagents/foundry-web-shell

## 0.2.1

### Patch Changes

- No source changes. Bumped in lock-step with the fixed group so the
  whole group can publish at a version number that's free across all
  four packages. (`shell@0.2.0` already published cleanly; this is a
  follow-the-group patch bump.)

## 0.2.0

### Minor Changes

- shell: ChatConversationConfig API + sticky-runtime threadId

  Lets a downstream module (e.g. `@ltwlf/spaces-web-ui`) attach a
  `ChatConversationConfig` to its `ChatModule`. The shell then:
  - Pre-mints a fresh thread UUID via `useRef` so the AG-UI runtime's
    `threadId` is defined from first render — no `undefined → defined`
    remount mid-conversation when the user sends the first message.
  - Calls `config.useStickyConversationId()` (when declared) and
    feeds the resulting id into the runtime so the chat stays "live"
    while the user browses non-chat routes (Workspaces, Jobs, etc.).
  - Per-config keyed child components (`StickyAwareRuntime` vs
    `UrlOnlyRuntime`) so optional hooks satisfy Rules-of-Hooks across
    multi-module config swaps.

### Patch Changes

- Move `@iloveagents/foundry-agent`, `-web-primitives`, `-web-ui` from
  `peerDependencies` to `dependencies`. They always ship together as a
  coordinated fixed group from this monorepo — they were never
  independently-versioned peers. Declaring them as peerDeps caused
  changesets' `shouldBumpMajor` cascade to promote the entire group to
  a major version on every minor changeset. See the root `foundry-agent`
  CHANGELOG entry for details.

- Updated dependencies
  - @iloveagents/foundry-web-ui@0.2.0
  - @iloveagents/foundry-agent@0.2.0
  - @iloveagents/foundry-web-primitives@0.2.0

### NOTE: 1.0.1 was accidental

Version 1.0.1 was published briefly on 2026-05-27 due to the peerDep
cascade bug described above (1.0.0 was reserved but not published —
1.0.1 was the retry). It has been unpublished. Both 1.0.0 and 1.0.1
are now permanently reserved on npm and CANNOT be re-published. Do
not depend on 1.0.x.

## 0.1.5

### Patch Changes

- Updated dependencies [f9144ca]
  - @iloveagents/foundry-web-ui@0.1.5
  - @iloveagents/foundry-agent@0.1.5
  - @iloveagents/foundry-web-primitives@0.1.5

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
