# @iloveagents/foundry-web-primitives

## 0.49.1

## 0.49.0

## 0.48.1

## 0.48.0

## 0.47.1

## 0.47.0

## 0.46.5

## 0.46.4

## 0.46.3

## 0.46.2

## 0.46.1

## 0.46.0

## 0.45.1

## 0.45.0

## 0.44.5

## 0.44.4

## 0.44.3

## 0.44.2

## 0.44.1

## 0.44.0

## 0.43.0

## 0.42.3

### Patch Changes

- 0d2e87f: Publish the app starter as `create-lykomi-app` (`npm create lykomi-app`) and point package repository metadata at `lykomi/ui` after the GitHub transfer.

## 0.42.2

## 0.42.1

## 0.42.0

## 0.41.1

## 0.41.0

## 0.40.1

## 0.40.0

## 0.39.0

## 0.38.0

## 0.37.0

### Minor Changes

- a404c05: Add a content appearance to ReadOnlyField for fixed information without input borders, while preserving framed values by default.

## 0.36.0

### Minor Changes

- 28ab214: Add themed FormLayout, FormHeader, FormSection and FormActions presets and ReadOnlyField display rows, with a shared form and renderer UX contract for developers and agents. Associate Field help and errors with native controls and keep field actions outside labels.

## 0.35.1

## 0.35.0

## 0.34.0

## 0.33.4

## 0.33.3

## 0.33.2

## 0.33.1

## 0.33.0

## 0.32.4

## 0.32.3

## 0.32.2

## 0.32.1

## 0.32.0

## 0.31.0

## 0.30.0

## 0.29.1

## 0.29.0

## 0.28.1

## 0.28.0

## 0.27.1

## 0.27.0

## 0.26.0

## 0.25.0

## 0.24.0

## 0.23.0

## 0.22.0

## 0.21.1

## 0.21.0

## 0.20.1

### Patch Changes

- c1bd1c1: Checkbox: "some of these" now looks like its own state

  An indeterminate checkbox was left unstyled — a tick drawn on a white
  box, which is the one shape that reads as _not_ selected. Every list's
  select-all header inherited that: tick a single row and the header
  claimed a selection nobody made.

  Indeterminate now fills like checked and draws a minus instead of a
  check, so partial, none and all are three distinguishable shapes.

## 0.20.0

## 0.19.0

## 0.18.0

## 0.17.0

## 0.16.0

## 0.15.0

## 0.14.2

## 0.14.1

## 0.14.0

## 0.13.0

## 0.12.1

## 0.12.0

## 0.11.1

## 0.11.0

## 0.10.1

## 0.10.0

## 0.9.0

## 0.8.0

## 0.7.1

### Patch Changes

- 0d4f73b: Docs + packaging polish: restore the `__PROJECT_NAME__` sentinel in the scaffold template README (Prettier had normalized it to `**PROJECT_NAME**`, breaking every generated app's title) and guard it with a test + `.prettierignore`; bump template foundry pins to the current release and enforce parity in `pack:check`; add npm metadata (description, keywords, repository, homepage, bugs) to the four runtime packages; extend the open-core guard to ban `@ltwlf/*` downstream imports; sync web-shell/agent AGENTS.md with the actual public API; add CONTRIBUTING.md + SECURITY.md and README badges/prerequisites.

## 0.7.0

## 0.6.0

## 0.5.0

## 0.4.0

## 0.3.1

## 0.3.0

## 0.2.2

### Patch Changes

- 8184a8c: shell: URL is authoritative for the runtime threadId — fixes
  resume-creates-new-conversation race

  `ChatConversationAwareRuntime` previously computed
  `effectiveThreadId = sticky ?? urlMatch ?? freshIdRef.current`.
  When the user navigated from one chat to another via a Recents
  click, the synchronous render that followed the URL change had:
  - `urlMatch = B` (read from the now-updated `useLocation`)
  - `sticky = A` (the active-chat-store hadn't been updated by
    `useTrackActiveChatFromUrl`'s `useEffect` yet — effects run
    AFTER the commit phase)

  `sticky ?? urlMatch` picked `A` (the previous chat). The AG-UI
  adapter was constructed with `threadId = A`. The first message the
  user sent went to `/api/agent` with `thread_id = A`, the middleware
  created a new row keyed by `A`... wait actually no, here's what
  happens — the runtime mints a fresh runner UUID when given a
  mismatched threadId; that fresh UUID became a new conversation row,
  appearing as "Untitled chat" at the top of the sidebar while the
  URL still said `/chat/B`. Two active-looking dots: one for `B`
  (NavLink URL match), one for the new row (statusDot from the
  updated active-chat-store after the lazy ensure ran).

  Swap the priority: `urlMatch ?? sticky ?? freshIdRef.current`. The
  URL is authoritative whenever it's set (i.e. on `/chat/<id>`
  routes), eliminating the stale-sticky race entirely. `sticky` is
  still consulted as the second-priority fallback for non-chat
  routes (`/spaces`, `/tasks`) so the popout chat stays "live" while
  the user browses workspaces — that's the original purpose of
  `useStickyConversationId` and it's preserved.

## 0.2.1

### Patch Changes

- No source changes. Bumped in lock-step with the fixed group so the
  whole group can publish at a version number that's free across all
  four packages. `@iloveagents/foundry-agent@0.2.0` and
  `@iloveagents/foundry-web-primitives@0.2.0` were blocked by an old
  npm reservation; `shell` and `ui` published at 0.2.0 successfully.
  0.2.1 unblocks the two stuck packages without leaving the fixed
  group drifting.

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
