# @iloveagents/foundry-web-ui

## 1.0.1

### Patch Changes

- e54a336: chore(release): republish web-shell + web-ui (npm refused 1.0.0 — version was previously reserved)

  No source changes. The 1.0.0 release ran successfully for
  `@iloveagents/foundry-agent` and `@iloveagents/foundry-web-primitives`,
  but the npm publish for `@iloveagents/foundry-web-shell@1.0.0` and
  `@iloveagents/foundry-web-ui@1.0.0` failed with E400 "Cannot publish
  over previously published version" — those exact version numbers
  appear to have been reserved on the registry from an earlier
  publish-then-unpublish cycle. Bumping the fixed group to 1.0.1 so
  the four packages stay version-aligned and the publish goes through.

- Updated dependencies [e54a336]
  - @iloveagents/foundry-agent@1.0.1
  - @iloveagents/foundry-web-primitives@1.0.1

## 1.0.0

### Minor Changes

- 9105483: shell: ChatConversationConfig API + sticky-runtime threadId

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

  UI: collapsible nav groups in `sidebar.tsx` with persisted state via
  `useSyncExternalStore` + localStorage, plus stable group ordering via
  new `priority` field in `nav-config.ts`.

  `ag-ui-runtime-provider.tsx` accepts an external `threadId` and
  `historyAdapterFactory` so the consuming app can wire its own
  persistence (e.g. `ThreadHistoryAdapter` → REST `/api/conversations`).

### Patch Changes

- Updated dependencies [9105483]
- Updated dependencies [2b10540]
  - @iloveagents/foundry-agent@1.0.0
  - @iloveagents/foundry-web-primitives@1.0.0

## 0.1.5

### Patch Changes

- f9144ca: Add `NavItem.statusIcon` slot for sidebar warning / status hints.

  Renders a small tone-coloured icon next to the existing `statusDot`. Use for "this item needs attention" annotations (failed background jobs, permission drift, etc.) where a coloured dot isn't legible enough. Tones map to `warning` / `danger` / `info` / `neutral`. The `label` lands on both `aria-label` and the wrapping span's `title` attribute so screen-reader announcement + hover tooltip work without consumer wiring.
  - @iloveagents/foundry-agent@0.1.5
  - @iloveagents/foundry-web-primitives@0.1.5

## 0.1.4

### Patch Changes

- Updated dependencies [07ace7e]
  - @iloveagents/foundry-agent@0.1.4
  - @iloveagents/foundry-web-primitives@0.1.4

## 0.1.3

### Patch Changes

- Updated dependencies [d9b0460]
  - @iloveagents/foundry-agent@0.1.3
  - @iloveagents/foundry-web-primitives@0.1.3

## 0.1.2

### Patch Changes

- Updated dependencies [30a4346]
  - @iloveagents/foundry-agent@0.1.2
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
  - @iloveagents/foundry-agent@0.1.1
  - @iloveagents/foundry-web-primitives@0.1.1
