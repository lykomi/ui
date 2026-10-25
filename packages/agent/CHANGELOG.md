# @iloveagents/foundry-agent

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

## 0.36.0

## 0.35.1

## 0.35.0

## 0.34.0

### Patch Changes

- 9d32ad7: A tool call the server answered is never replayed as a client continuation.

  A host can register a UI tool locally (open a panel, highlight a row) and still let the server answer it: the runner applies the effect at `tool-call-end`, and when a `TOOL_CALL_RESULT` for the same call arrives it no longer re-issues the run with the local result. This lets a server keep purely cosmetic UI tools off the browser's critical path. A background tab the browser has frozen cannot post a continuation, so a turn waiting on one would wait until somebody looked at the tab again.

## 0.33.4

## 0.33.3

## 0.33.2

## 0.33.1

## 0.33.0

### Minor Changes

- d25c6e3: Show how full a conversation is. The runner now surfaces the server's per-call `usage` CUSTOM event as a `usage` runner event, and the chat adapter records it per thread in the new `contextUsageStore`. The chat context card ("With …") gains a "Conversation memory" section: a bar with the fill and its ceiling, and a plain sentence about what happens as it fills. When the fill passes 90% the bar turns amber and the context row shows a small dot. The section prefers `context_used_tokens` / `context_limit_tokens` from the usage event, which are in the server's own units and exclude the system prompt and tool declarations. Otherwise it uses the latest call's input size against a window the host states via `/api/chat/config` as `context.windowTokens`. `useConversationMemory()` and `ConversationMemory` are exported. The adapter's React context moved to `ag-ui-adapter-context.ts`, which exports `useCurrentThreadId()`, so components can read the current thread without importing the runtime provider.

## 0.32.4

## 0.32.3

## 0.32.2

## 0.32.1

## 0.32.0

## 0.31.0

## 0.30.0

### Minor Changes

- a8f766d: Keep running conversations alive when starting or opening another chat, expose their status in conversation history, and warn before leaving during active work. Add support ID copying and refine compact navigation spacing.

  Unify composer context in the With menu, including selected items, removable references, and pins. Preserve scoped navigation context when list filters change.

  Citation writes and clears now require the emitting conversation ID. The shell retains visited conversation configurations and supports configured conversation URLs.

  Conversation deletion handlers should call `removeChatRun(threadId)` after successful deletion to remove retained browser-session activity.

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

## 0.20.0

## 0.19.0

## 0.18.0

### Minor Changes

- 1e90612: Lists compose: `clientToolRegistry.addPageTools` / `removePageTools` let a component (a list, a panel) contribute page tools next to the page's own instead of replacing them, and the DataTable URL codec takes a `prefix` (`risks.q`, `risks.f_status`) so several lists can share one page URL.

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

## 0.9.0

### Minor Changes

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

### Patch Changes

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

## 0.7.1

### Patch Changes

- 0d4f73b: Docs + packaging polish: restore the `__PROJECT_NAME__` sentinel in the scaffold template README (Prettier had normalized it to `**PROJECT_NAME**`, breaking every generated app's title) and guard it with a test + `.prettierignore`; bump template foundry pins to the current release and enforce parity in `pack:check`; add npm metadata (description, keywords, repository, homepage, bugs) to the four runtime packages; extend the open-core guard to ban `@ltwlf/*` downstream imports; sync web-shell/agent AGENTS.md with the actual public API; add CONTRIBUTING.md + SECURITY.md and README badges/prerequisites.

## 0.7.0

## 0.6.0

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

- No source changes. The 0.2.0 publish for `@iloveagents/foundry-agent` and
  `@iloveagents/foundry-web-primitives` failed because npm had `0.2.0`
  reserved for those two packages from an older publish-then-unpublish
  cycle (the version was reserved before the recent v1 incident — see
  git tag history). `@iloveagents/foundry-web-shell@0.2.0` and
  `@iloveagents/foundry-web-ui@0.2.0` published cleanly. Bumping the
  whole fixed group to 0.2.1 so all four publish together at a version
  number that's free across all four packages.

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

  UI: collapsible nav groups in `sidebar.tsx` with persisted state via
  `useSyncExternalStore` + localStorage, plus stable group ordering via
  new `priority` field in `nav-config.ts`.

  `ag-ui-runtime-provider.tsx` accepts an external `threadId` and
  `historyAdapterFactory` so the consuming app can wire its own
  persistence (e.g. `ThreadHistoryAdapter` → REST `/api/conversations`).

### Patch Changes

- Fix `citationStore.clear()` so the registered handler survives per-conversation resets.

  The previous implementation wiped both `results` AND `handler`. `useNewConversation` calls `clear()` on every "New Thread" click. Combined with the `registerOnce`-style handler registration in feature modules (e.g. SPACES' `registerSpacesCitationHandler`), the result was that all `[n]` citation markers in chat became inert non-clickable spans for the rest of the session after the first new-thread click. `clear()` now resets `results` only — the handler is module-level state and must persist.

- Move sibling `@iloveagents/foundry-*` declarations from `peerDependencies`
  to `dependencies` in `foundry-web-shell` and `foundry-web-ui`. These four
  packages always ship together as a coordinated fixed group from the same
  monorepo — they were never independently-versioned peers, so declaring
  them as peerDeps caused changesets' `shouldBumpMajor` cascade to promote
  the entire group to a major version on every minor changeset (a single
  minor on any of the four would exit the sibling's `^0.x.y` peerDep range
  → all dependents promoted to major → fixed group synced all four to
  major → 0.1.5 unexpectedly jumped to 1.0.0). Moving to `dependencies`
  eliminates the cascade entirely; `dependencies` never trigger
  `shouldBumpMajor`. Consumers that already install each foundry-\* package
  directly are unaffected — pnpm hoists by name, so a single instance
  resolves across the dep graph regardless of declaration site.

### NOTE: 1.0.0 / 1.0.1 were accidental

These version numbers were published briefly on 2026-05-27 due to the
peerDep cascade bug described above, then unpublished. The version
numbers themselves are now permanently reserved on npm and CANNOT be
re-published. This 0.2.0 release captures all the work that was in
the accidental 1.0.x releases. Do not depend on 1.0.x.

## 0.1.5

## 0.1.4

### Patch Changes

- 07ace7e: fix(agent): canonical MSAL.js recovery — acquireTokenRedirect-first, orphaned-state cleanup, dedup

  Closes the production "stuck on 401 forever" bug observed on a customer dev deployment after the 0.1.2 / 0.1.3 fixes. Diagnostic on the live tab showed `getAllAccounts() === []` despite localStorage holding 3 access tokens + 1 refresh token — the orphaned-state signature.

  **Root cause:** The previous recovery code did `setActiveAccount(null) + clearCache({account}) + loginRedirect()`. When `loginRedirect()` silently failed to navigate (caught by our try/catch — popup blocker, browser policy, async race), the account record was already gone but the tokens lingered. Every subsequent API call hit `getAllAccounts() === []` and silently returned `null` — no Bearer header, endless 401s, only manual `localStorage.clear()` recovered.

  **Canonical 2026 fix per Microsoft Learn `entra/msal/javascript/browser/errors`** + linked GitHub issues + msal-react samples:
  1. **`acquireTokenRedirect` first, not `loginRedirect`.** It's the documented primitive for refreshing a known account's tokens — preserves the account record across the navigation. `loginRedirect` is only the fallback when `acquireTokenRedirect` itself fails to navigate.
  2. **Never `clearCache` before redirect.** The redirect navigation IS the recovery signal; if it succeeds, MSAL handles state cleanup; if it fails, leave state intact for the next attempt rather than orphaning the cache.
  3. **Detect + repair orphaned state.** When `getAllAccounts() === []` but localStorage has MSAL token entries, nuke ALL `msal.*` keys (localStorage + sessionStorage) and force a fresh `loginRedirect`. Without this, the SPA renders authenticated UI but every API call goes anonymous.
  4. **Module-level recovery deduplication.** Multiple parallel API calls all hitting the recovery path simultaneously now share a single in-flight redirect promise instead of each issuing their own (which would cascade `interaction_in_progress` errors).

  The previous `recoverFromHardAuthFailure` callback now uses the same primitive — single recovery path for both "MSAL silent failed" and "API rejected refreshed token".

  68/68 agent tests pass (was 65) — the new tests assert the no-clearCache invariant, the acquireTokenRedirect-first ordering, the loginRedirect fallback path, and the orphaned-state nuke + redirect. Pair: lastspace bump to ^0.1.4.

## 0.1.3

### Patch Changes

- d9b0460: fix(agent): escalate to loginRedirect after second 401

  Follow-up to the auth-stale-token-401-retry fix in 0.1.2. The first version retried with `forceRefresh: true` and bounced to `loginRedirect` only when MSAL itself reported `InteractionRequiredAuthError`. But there's a more common production failure mode the silent path can't recover: the resource server rejects the **freshly-refreshed** token too — server-side policy drift, audience mismatch, conditional-access re-evaluation, claims challenge, tenant-policy change. MSAL has no way to know about any of this; it produces a clean refreshed token and calls it a day. The user is left in an endless silent 401 loop because nothing kicks them to `loginRedirect`.

  Adds `recoverFromHardAuthFailure(reason)` on `authStore`. The fetch interceptor calls it when a SECOND consecutive 401 fires (i.e. even the force-refresh retry didn't help). It clears the MSAL cache and starts `loginRedirect` so a brand-new session mints a token bound to current server policy.

  `createServiceFetch` now accepts an optional `recoverFromHardAuthFailure` callback. The default consumer (`@iloveagents/foundry-web-shell`) wires it to the new method on `authStore`. Same pattern in `tokenFetch`.

  Pair: `lastspace#TBD` (forwards the new option through `spacesFetch`).

## 0.1.2

### Patch Changes

- 30a4346: fix(agent): retry protected fetch with `forceRefresh` on 401

  Closes the long-lived-tab 401 loop where the only recovery the user had was logging out or clearing localStorage.

  The token-fetch wrapper used to ask MSAL for a cached token and never retry. If the resource server rejected that token (claims challenge, conditional-access re-eval, audience drift, or staleness MSAL's clock-offset check missed), every subsequent request kept re-sending the same token.

  Fix: on 401 from a protected API, retry once with `acquireTokenSilent({ forceRefresh: true })`. If that also fails, the existing `InteractionRequiredAuthError` path bounces the user through Entra ID. Single-retry cap so we never loop. Request bodies are cloned per-attempt (ReadableStream is single-consume) so POST/PUT payloads survive the retry intact.

  The `acquireToken` callback type now accepts an optional `{ forceRefresh? }` argument — non-breaking; existing callbacks continue to work, but they should forward the option to their token source so the retry path actually reaches the auth backend.

  Pair: `lastspace#205` (forwards the option through `spacesFetch.acquireToken`).

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
