# @iloveagents/foundry-web-ui

## 0.4.0

### Patch Changes

- 9be8b3d: Add a default FastAPI + Microsoft Agent Framework AG-UI agent service scaffold to the starter, including a hello tool, a weather tool, current Foundry env examples, and a demo-grade Hello Agent page with one-click AG-UI prompts. Expose `agentFetch` through `bootstrapShell` so generated apps can use a local unauthenticated agent transport for demos before swapping to the MSAL-backed default.

  Ship the Foundry UI Tailwind v4 theme resource through `@iloveagents/foundry-web-ui/styles.css` and import it from the starter so panels and other source-shipped components render correctly without app-local theme copies. Default shared app branding and browser titles to `Foundry UI`, and document starter theming through `bootstrapShell({ theme })`.

  Hide the composer page-pin button by default, while keeping it available through `ChatContent` and `ContextPins` opt-in props. Make non-image document attachments degrade to model-visible metadata instead of malformed binary payloads so starter uploads do not break AG-UI streaming.

  Reserve user-message action-row height while the agent is running so the chat no longer jumps when the post-run edit button appears.

  Tighten the starter documentation around a single quick-start path, add generated-app `AGENTS.md` plus `CLAUDE.md` import support, and remove default-template product clutter so coding agents and humans both have one clear place to add tools.

  Document the two supported adoption modes: package-backed apps for central Foundry UI updates, and full-copy/GitHub-template apps for complete customization.

  Harden preview packaging by replacing internal `workspace:*` dependencies with installable semver ranges, adding package-level MIT licenses, publishing runtime packages as built ESM JavaScript plus `.d.ts` declarations, filtering runtime package tarballs to dist/README/LICENSE only, and adding missing package READMEs/typecheck coverage.
  - @iloveagents/foundry-agent@0.4.0
  - @iloveagents/foundry-web-primitives@0.4.0

## 0.3.1

### Patch Changes

- 9ec870e: Surface AG-UI run errors in chat instead of rendering an empty assistant bubble.
  - @iloveagents/foundry-agent@0.3.1
  - @iloveagents/foundry-web-primitives@0.3.1

## 0.3.0

### Patch Changes

- @iloveagents/foundry-agent@0.3.0
- @iloveagents/foundry-web-primitives@0.3.0

## 0.2.2

### Patch Changes

- 395f0cd: web-ui: popover New Thread didn't actually start a new thread

  When the user clicks the compose / SquarePen "New Thread" button in
  the floating chat popover (`ChatBubble` on workspace/entity pages with
  `navigateToChat: false`), the runtime was supposed to discard the
  current thread and start fresh. In practice the popover header
  subtitle flipped to "New conversation" but the message list stayed
  populated with the prior chat's messages — the button looked like a
  no-op.

  Root cause: `useNewConversation` bumped the AGUIRuntime inner key to
  remount, but the parent `RuntimeBody`'s `effectiveThreadId`
  (`urlMatch ?? sticky ?? freshIdRef.current`) stayed pinned to the
  sticky active-chat id. The history adapter on the fresh inner mount
  immediately loaded the same chat's messages from the server →
  nothing visibly changed.

  The sidebar "New Thread" button avoided this only by side-effect —
  it navigates to `/`, which triggers `useTrackActiveChatFromUrl` to
  clear sticky. The popover preserves the user's workspace context and
  doesn't navigate, so sticky never cleared.

  Fix: add a tiny DI store `useChatLifecycleStore` exposing an
  `onNewConversation` callback. `useNewConversation` invokes it BEFORE
  `resetThread` so the host (spaces-web-ui in lastspace) can clear its
  sticky id; the next render's `effectiveThreadId` has already advanced
  to a freshly-minted UUID, and the history adapter binds to that
  instead of re-hydrating the prior chat.

  Customers that don't track sticky ids leave `onNewConversation`
  unset; the call site no-ops gracefully.

- 1ba01ef: web-ui(sidebar): align group-header labels (CHATS, WORKSPACES, ADMIN, …)
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

- Updated dependencies [8184a8c]
  - @iloveagents/foundry-agent@0.2.2
  - @iloveagents/foundry-web-primitives@0.2.2

## 0.2.1

### Patch Changes

- No source changes. Bumped in lock-step with the fixed group so the
  whole group can publish at a version number that's free across all
  four packages. (`ui@0.2.0` already published cleanly; this is a
  follow-the-group patch bump.)

## 0.2.0

### Minor Changes

- UI: collapsible nav groups in `sidebar.tsx` with persisted state via
  `useSyncExternalStore` + localStorage, plus stable group ordering via
  new `priority` field in `nav-config.ts`.

  `ag-ui-runtime-provider.tsx` accepts an external `threadId` and
  `historyAdapterFactory` so the consuming app can wire its own
  persistence (e.g. `ThreadHistoryAdapter` → REST `/api/conversations`).

### Patch Changes

- Move `@iloveagents/foundry-agent`, `-web-primitives` from
  `peerDependencies` to `dependencies`. They always ship together as a
  coordinated fixed group from this monorepo — they were never
  independently-versioned peers. Declaring them as peerDeps caused
  changesets' `shouldBumpMajor` cascade to promote the entire group to
  a major version on every minor changeset. See the root `foundry-agent`
  CHANGELOG entry for details.

- Updated dependencies
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
