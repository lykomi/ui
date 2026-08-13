# @iloveagents/foundry-web-ui

## 0.12.0

### Minor Changes

- f588a5f: Attachment adapter registry + Office MIME resolution + graceful drop rejection.
  - `registerAttachmentAdapter(adapter)` — hosts can inject a custom composer
    attachment adapter (mirrors the `registerChatSlots` pattern); the AG-UI
    runtime falls back to the built-in `FileAttachmentAdapter` when none is
    registered.
  - `resolveMimeType(file)` is now exported, and the extension→MIME fallback
    table covers `.xlsx` and `.pptx` (browsers often report an empty
    `file.type` for Office files).
  - The chat drop zone now surfaces per-file rejections from the adapter's
    `add()` (previously an unhandled promise rejection and a silently missing
    attachment chip). Drops bypass the file picker's `accept` filter, so a
    composite adapter's "no matching adapter" error is the real gate — it now
    shows as a transient inline alert.

### Patch Changes

- @iloveagents/foundry-agent@0.12.0
- @iloveagents/foundry-web-primitives@0.12.0

## 0.11.1

### Patch Changes

- @iloveagents/foundry-agent@0.11.1
- @iloveagents/foundry-web-primitives@0.11.1

## 0.11.0

### Patch Changes

- @iloveagents/foundry-agent@0.11.0
- @iloveagents/foundry-web-primitives@0.11.0

## 0.10.1

### Patch Changes

- 7593378: Composer: text on its own row, controls in a bottom row

  The input and the trailing controls shared one flex row, so the picker and Send sat vertically centred beside the text. Fine on one line; in a narrow window the text wrapped into a tall block with the controls floating at its mid-height, and the controls also stole horizontal space, causing text to wrap sooner than it needed to.

  Text now spans the full width on its own row, with attach / effort picker / Send on a dedicated line beneath — the layout ChatGPT uses. Verified at 620px and 1280px, one line and three.
  - @iloveagents/foundry-agent@0.10.1
  - @iloveagents/foundry-web-primitives@0.10.1

## 0.10.0

### Minor Changes

- fb1c5e5: Bring back `Auto` — this time it says what it resolves to

  `Auto` was removed because it was opaque: it claimed the model picked a level per request, while actually sending nothing and letting the backend decide. You could believe you were on Extra High and be running Instant, for a control that determines cost and latency.

  It returns with the resolution visible. `reasoningDefaultStore` holds the level the backend applies when no effort is sent; the picker renders it in the trigger (`Auto · Medium`) and the menu (`Currently Medium`). The shell populates it from `GET /api/chat/config`.

  Never guesses: if the backend does not report a level — older backend, route absent, request failed, or reasoning switched off — the store stays unset and the picker says "uses the app's configured level" rather than naming one. The store is populated by the host app and never derived client-side, so the label cannot drift from the behaviour it describes.

  Explicit levels stay a pin: nothing moves them, including a change of context.

### Patch Changes

- 3bf4161: Remove the `Auto` reasoning level; default to `Medium`

  `Auto` read as "the model picks a level per request". It never did — it sent no effort at all, so the backend's own fallback applied uniformly. The picker now offers only real levels (Instant / Medium / High / Extra High) and always sends one.

  `DEFAULT_REASONING_EFFORT` is `medium`, matching the backend fallback that `Auto` used to resolve to, so nobody's answers change. A stored `"default"` from the old option migrates to `medium` rather than resetting the preference.

- Updated dependencies [fb1c5e5]
- Updated dependencies [3bf4161]
  - @iloveagents/foundry-agent@0.10.0
  - @iloveagents/foundry-web-primitives@0.10.0

## 0.9.0

### Patch Changes

- ef98785: Complete AG-UI protocol coverage in the runner.

  The runner previously subscribed to a subset of the protocol and silently
  dropped the rest. It now handles every event type the spec defines:
  - `STATE_SNAPSHOT` / `STATE_DELTA` — published as an `agent-state` runner event
    and exposed through a new `agentStateStore`, so pages can react to
    server-driven state instead of reaching into the transport. The AG-UI client
    already applied the JSON Patch; this forwards the result plus the patch.
  - `MESSAGES_SNAPSHOT` — server-authoritative history (e.g. after backend
    compaction), forwarded without disturbing the in-flight turn. Upstream saw
    mid-run snapshots truncate a streaming answer, so the streaming message is
    deliberately left alone.
  - `ACTIVITY_SNAPSHOT` / `ACTIVITY_DELTA` — generative-UI surfaces (MCP apps,
    A2UI), passed through verbatim for hosts that render them.
  - `RAW` — provider passthrough, never interpreted.
  - `REASONING_START` — the block-open boundary that was still missing.
    `reasoning-end` stays tied to the block terminal (`REASONING_END`): a block
    can contain several reasoning messages, so emitting it per message would let
    consumers close reasoning while the model is still thinking.

  The chunked and legacy variants (`TEXT_MESSAGE_CHUNK`, `TOOL_CALL_CHUNK`,
  `THINKING_*`) need no handlers: `@ag-ui/client` normalizes them onto the
  canonical events before the subscriber sees them.

  Also adds `autoCancelPendingToolCalls` (default on): a client-side tool that
  starts but never produces a result is settled with an error instead of being
  left dangling. An unanswered call makes the model re-issue the tool and then
  report that it "didn't complete", and the Responses API rejects a replayed
  history whose `function_call` has no matching output.

- fca0ede: Rename the reasoning levels and fix the picker's alignment.

  Levels now read **Auto / Instant / Medium / High / Extra High** under an
  "Intelligence" heading, matching the vocabulary users already know from other
  assistants instead of inventing a private one (Fast / Balanced / Thorough /
  Max). `Auto` stays ours — it means "no preference, use the app's configured
  level", which the protocol enum has no member for.

  Alignment: the check icon had no `shrink-0`, so on rows whose hint wrapped to
  two lines flexbox compressed it to 11px instead of 16px and shifted those
  titles left out of the column. Measured in the browser before and after — all
  five rows now sit at the same x.

- ef98785: Expose the `xhigh` reasoning level in the effort picker as **Max**.

  The protocol's effort enum runs `low | medium | high | xhigh`, but the picker
  stopped at `high`. That made "Thorough" the top choice while a higher level
  existed, so a user asking for the model's best effort could not get it.
  `xhigh` is confirmed working on the reference deployment (83 reasoning events,
  no run errors). Labelling `high` itself "Max" would have been inaccurate.

- Updated dependencies [ef98785]
- Updated dependencies [fca0ede]
- Updated dependencies [ef98785]
  - @iloveagents/foundry-agent@0.9.0
  - @iloveagents/foundry-web-primitives@0.9.0

## 0.8.0

### Minor Changes

- afb1f2a: Handle AG-UI reasoning and step events, which the runner previously dropped.

  The runner subscribed to 11 of the 33 protocol event types. Two of the gaps
  were costing real UX:
  - **Reasoning** (`REASONING_*`, plus the deprecated `THINKING_*` aliases that
    `@ag-ui/client` normalizes onto them) now surfaces as a `reasoning-delta` /
    `reasoning-end` `RunnerEvent`, and the adapter emits it as an assistant-ui
    `reasoning` part rendered in a collapsed panel above the answer. Reasoning
    models emit these today and the text was being thrown away. Reasoning
    accumulates across the whole run rather than per turn, so a tool-call
    follow-up doesn't erase what the model thought before it.
  - **Steps** (`STEP_STARTED` / `STEP_FINISHED`) now emit `step-started` /
    `step-finished` events, and `StreamingStatus` carries `stepName`. A long
    agentic run otherwise shows one opaque "thinking" state for minutes.

  `StreamingStatus.status` gains a `"reasoning"` member; it reverts to
  `"thinking"` when reasoning ends so the indicator can't stick.

- a33d66b: Upgrade @assistant-ui/react to 0.15.x. The 0.12-era pin existed because
  0.12.28's store/tap dependency graph was internally inconsistent; 0.15's
  graph (tap ^0.9, store ^0.3) is consistent again. Migration surface was the
  two `useComposerRuntime()` call sites (removed in 0.15) — now `useAui().composer`.
  Ships a pnpm patch for @assistant-ui/store 0.3.2 replicating the merged-but-
  unreleased upstream StrictMode fix (assistant-ui#5411): without it the
  composer silently drops all typed input under `<StrictMode>` in dev.
- a33d66b: Fix two chat defects, both pre-existing:
  - **Client-side tool results looked unanswered.** The AG-UI client folds the
    streamed assistant message (tool calls included) into its own history, and
    the runner appended a second copy — so the follow-up carried the same
    `toolCallId` twice against one tool result. The model saw an unanswered call,
    re-issued the tool (duplicate card in the UI) and then reported that it
    "didn't complete", even though the tool had succeeded. The runner now only
    synthesizes what the client hasn't already recorded.
  - **Attached documents lost their contents.** `FileAttachmentAdapter` sent
    PDFs/DOCX as a `[Attached file: ...]` text stub, so the model got a filename
    and no bytes — it would then hunt for the document in the backend and report
    that it couldn't read it. Documents are now sent as file parts like images.
    Pass `{ documentMode: "metadata" }` to restore the old behaviour for models
    that cannot accept file input.

- afb1f2a: Let the user choose how hard the model thinks, per conversation.

  Adds a `ReasoningEffortPicker` to the composer (Auto / Fast / Balanced /
  Thorough) backed by a persisted `reasoningEffortStore`. The choice rides on
  every turn as an AG-UI `forwardedProps.reasoningEffort` and is read at send
  time, so switching mid-conversation applies from the next message. `Auto`
  sends nothing, leaving whatever the backend is configured for.

  Effort is worth exposing because it is not a free knob: on the deployment
  this was measured against, low effort often produced no reasoning summary at
  all, while high effort cost noticeably more latency and tokens. That is a
  judgement only the person asking the question can make.

### Patch Changes

- Updated dependencies [afb1f2a]
- Updated dependencies [a33d66b]
- Updated dependencies [afb1f2a]
  - @iloveagents/foundry-agent@0.8.0
  - @iloveagents/foundry-web-primitives@0.8.0

## 0.7.1

### Patch Changes

- 0d4f73b: Docs + packaging polish: restore the `__PROJECT_NAME__` sentinel in the scaffold template README (Prettier had normalized it to `**PROJECT_NAME**`, breaking every generated app's title) and guard it with a test + `.prettierignore`; bump template foundry pins to the current release and enforce parity in `pack:check`; add npm metadata (description, keywords, repository, homepage, bugs) to the four runtime packages; extend the open-core guard to ban `@ltwlf/*` downstream imports; sync web-shell/agent AGENTS.md with the actual public API; add CONTRIBUTING.md + SECURITY.md and README badges/prerequisites.
- Updated dependencies [0d4f73b]
  - @iloveagents/foundry-agent@0.7.1
  - @iloveagents/foundry-web-primitives@0.7.1

## 0.7.0

### Minor Changes

- fb1ede2: Branding: `iconUrl` / `darkIconUrl`, so a tenant can show "<mark> Product Name".

  `AppBrand` suppressed the app name whenever a logo was set, which is right for a wordmark — it already spells the brand out, so printing `appName` beside it stutters ("Acme Acme"). It left no way to express the other common lockup: a compact mark next to a product name that differs from the company name.

  Adds `iconUrl`/`darkIconUrl` to `ThemeBranding`. An icon renders _with_ `appName`; a wordmark still renders alone; an icon wins when both are set, since supplying one is an explicit request for the lockup. Both lock height and let width follow the aspect ratio — sizing an icon into a square box silently shrinks any mark that is not 1:1, and marks rarely are. Light/dark selection falls back across modes so a tenant supplying one variant never gets a blank header.

  Backwards compatible: themes setting only `logoUrl` render exactly as before. Exports `_resolveBrandLockup` for unit testing.

- 591a815: Tool panel: drag-to-resize the chat/content split, persisted per user.

  The navigation sidebar was resizable but the tool-panel divider was not, so the split was fixed at whatever the viewport dictated. Adds a pointer- and keyboard-driven separator on the panel's left edge (arrows nudge, Shift jumps, Home/End to the extremes), clamped so neither side collapses (panel ≥ 360px, sibling ≥ 420px), persisted to `localStorage` and re-clamped against the current viewport on load. Inert in overlay and fullscreen modes. Exports `clampPanelWidth` and `MIN_PANEL_WIDTH`.

### Patch Changes

- @iloveagents/foundry-agent@0.7.0
- @iloveagents/foundry-web-primitives@0.7.0

## 0.6.0

### Minor Changes

- 512560d: Chat extension slots: `registerChatSlots({ composerBanner, launcherBadge })` lets modules render a persistent strip above the composer (full chat + bubble panel) and a badge over the collapsed chat launcher (wrapped in a positioned `group` anchor for hover flyouts). Used by Spaces for always-visible background-task progress.

### Patch Changes

- @iloveagents/foundry-agent@0.6.0
- @iloveagents/foundry-web-primitives@0.6.0

## 0.5.0

### Minor Changes

- f843885: Chat stream integrity + trustworthy working indicator.

  A stream that closed without a terminal `RUN_FINISHED`/`RUN_ERROR` (proxy
  idle-timeout, dropped connection, dead replica) previously looked like a
  clean completion: the AG-UI client resolves `runAgent()` normally, so a
  truncated answer rendered as final with no error and no indicator — the
  silent-wedge bug.
  - `AGUIRunner` now detects the protocol violation and emits an explicit
    `run-error` ("Connection to the agent was lost…"), and normalizes
    transport-level rejections onto the same `run-error` surface instead of
    throwing through the event stream.
  - New `heartbeat` runner event: AG-UI `CUSTOM` events named `heartbeat`
    (emitted by the backend during long tool calls / thinking) refresh the
    client's liveness clock.
  - New `stalled` streaming status with a configurable watchdog
    (`AGUIRunnerOptions.stallAfterMs`, default 45s): no event or heartbeat
    for that long flips the indicator to a distinct "still working — no
    signal" state, recovering automatically on the next event.
  - `streamingStatusStore` gains `lastSignalAt` / `runStartedAt` +
    `touchSignal` / `markRunStarted` / `markRunEnded` so UIs can render
    elapsed time and staleness.
  - `LoadingIndicator` shows the current phase with an amber stalled
    treatment; message action rows reveal a send/receive timestamp on hover.
    (The store's `runStartedAt`/`lastSignalAt` are available for hosts that
    want their own elapsed/staleness displays.)

### Patch Changes

- Updated dependencies [f843885]
  - @iloveagents/foundry-agent@0.5.0
  - @iloveagents/foundry-web-primitives@0.5.0

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
