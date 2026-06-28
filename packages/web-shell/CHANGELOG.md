# @iloveagents/foundry-web-shell

## 0.4.0

### Minor Changes

- 9be8b3d: Add a default FastAPI + Microsoft Agent Framework AG-UI agent service scaffold to the starter, including a hello tool, a weather tool, current Foundry env examples, and a demo-grade Hello Agent page with one-click AG-UI prompts. Expose `agentFetch` through `bootstrapShell` so generated apps can use a local unauthenticated agent transport for demos before swapping to the MSAL-backed default.

  Ship the Foundry UI Tailwind v4 theme resource through `@iloveagents/foundry-web-ui/styles.css` and import it from the starter so panels and other source-shipped components render correctly without app-local theme copies. Default shared app branding and browser titles to `Foundry UI`, and document starter theming through `bootstrapShell({ theme })`.

  Hide the composer page-pin button by default, while keeping it available through `ChatContent` and `ContextPins` opt-in props. Make non-image document attachments degrade to model-visible metadata instead of malformed binary payloads so starter uploads do not break AG-UI streaming.

  Reserve user-message action-row height while the agent is running so the chat no longer jumps when the post-run edit button appears.

  Tighten the starter documentation around a single quick-start path, add generated-app `AGENTS.md` plus `CLAUDE.md` import support, and remove default-template product clutter so coding agents and humans both have one clear place to add tools.

  Document the two supported adoption modes: package-backed apps for central Foundry UI updates, and full-copy/GitHub-template apps for complete customization.

  Harden preview packaging by replacing internal `workspace:*` dependencies with installable semver ranges, adding package-level MIT licenses, publishing runtime packages as built ESM JavaScript plus `.d.ts` declarations, filtering runtime package tarballs to dist/README/LICENSE only, and adding missing package READMEs/typecheck coverage.

### Patch Changes

- Updated dependencies [9be8b3d]
  - @iloveagents/foundry-web-ui@0.4.0
  - @iloveagents/foundry-agent@0.4.0
  - @iloveagents/foundry-web-primitives@0.4.0

## 0.3.1

### Patch Changes

- Updated dependencies [9ec870e]
  - @iloveagents/foundry-web-ui@0.3.1
  - @iloveagents/foundry-agent@0.3.1
  - @iloveagents/foundry-web-primitives@0.3.1

## 0.3.0

### Minor Changes

- df383c9: Add runtime configuration support so the web app can ship as a single prebuilt
  container image that boots for any environment without a rebuild. New
  `runtimeConfig(key)` helper resolves `window.__APP_CONFIG__[key]` (injected by
  the container at startup) before `import.meta.env[key]` (build-time Vite env,
  the local-dev fallback). The default MSAL auth adapter and agent fetch client
  now read `VITE_MSAL_*` / `VITE_API_BASE_URL` through it. Local `pnpm dev` is
  unchanged (no `/config.js` → falls back to `import.meta.env`).

### Patch Changes

- @iloveagents/foundry-agent@0.3.0
- @iloveagents/foundry-web-primitives@0.3.0
- @iloveagents/foundry-web-ui@0.3.0

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

- Updated dependencies [395f0cd]
- Updated dependencies [1ba01ef]
- Updated dependencies [8184a8c]
  - @iloveagents/foundry-web-ui@0.2.2
  - @iloveagents/foundry-agent@0.2.2
  - @iloveagents/foundry-web-primitives@0.2.2

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
