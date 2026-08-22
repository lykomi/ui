# @iloveagents/foundry-web-ui

## 0.20.0

### Minor Changes

- b24949c: Dates become things you can tick. `ageBuckets` (the filter keys — nested, because ranges are: something touched today is also within the last 7 days), `ageBucket` ("today", "last 7 days", …), `dueState` ("overdue", "soon", "later", "undated") and `relativeAge` ("6 d ago") turn a timestamp into the words a person filters by — feed them to `meta.facetBuckets` and counts, OR-within, AND-across, the URL and the agent tools work on them unchanged. `parseDateish` reads only shapes whose meaning is not in doubt — ISO (with an optional time and zone), the dotted European `d.m.yyyy`, and year-first `yyyy/m/d` — and validates the calendar day. Everything else is `null`, including `03/04/2026` and `03-04-2026` (March in one country, April in another) and the shorthand a lenient parser invents dates from (`Date.parse("1")` is the year 2001). A field where people write "Contract signature (May)" needs a parser that says no. A day is a CALENDAR day in the reader's own zone throughout: 23:30 last night and 00:30 this morning are a day apart though barely an hour passed, a bare date means that day where the reader is rather than in UTC, and a date-only deadline runs out at the end of THEIR day — not at 17:00 for anyone in UTC−7.
- b24949c: Numbers and dates become things you can tick: a column's `meta.facetBuckets` turns its raw value into facet keys ("≥ 50 %", "overdue", "this week"), and the rest of the machinery — counts, OR within a facet, AND across facets, the URL, the agent tools — works on those keys unchanged.
- b24949c: Wide lists keep their bearings. `meta.pinned: "left"` freezes leading columns against the left edge (offsets measured from the rendered header cells, an edge border on the last pinned one). `onActiveRowChange` walks the active row with ↑/↓/Home/End, clears it with Escape and keeps it scrolled into view — the master-list keyboard flow beside a detail pane. And `meta.breakpoint` is measured against the _list's own width_ rather than the window, so a list narrowed by an open detail pane sheds exactly the columns a narrow window would and focus mode brings them back — no CSS wiring in the host. Two facet options clicked in quick succession now both stick (the toggle is a functional update, so it no longer reads a value the pending render has not applied). `DataTable` also takes `maxHeight`, giving a list its own scroll viewport (sticky header, both axes) instead of running down the page, and `DataTableFrame` forwards a ref so a host can measure it.

  Rules the components need but a host's CSS scanner cannot infer — frozen-column stickiness and its opaque row tints, and a long menu capped to the room it has and scrollable inside — now ship in this package's `styles.css`, so importing that stylesheet (as the README says) is all a host has to do.

  The grid itself reads like a spreadsheet: columns keep their natural width with the slack at the end (`spacer`), a group header's label and total stay put while the columns scroll, the frozen edge carries a seam, and the Columns menu shows each column's own label rather than title-casing it.

  Selecting and opening are separate acts, the way a desktop list behaves: a click selects (`onRowClick`), Enter or a double click opens (`onRowOpen`), and the tick boxes of `selectionColumn` are the selection a chat agent reads. `DataTableSelectionBar` gives every list one place for bulk actions on that selection. The frozen seam only appears once the list is scrolled sideways, and list scrollbars stay visible instead of relying on the overlay ones macOS hides.

  Context that tracks the UI now has a home: `useAppStore.setContextItem(key, item | null)` keeps one item per key, so a list can keep the chat in step with its selection — replacing the chip as the selection changes and taking it away when it empties — without piling up stale ones next to the user's own pins.

  A column says where it earns its place: `meta.breakpoint` is the narrowest list width it needs, and `meta.showIn: "focus"` keeps it for when the list has the screen to itself — so an embedded list stays scannable and going fullscreen genuinely shows more. Focus mode also shows every facet, and `DataTableFrame` reports focus changes to its host.

### Patch Changes

- 2141de2: The column-visibility menu is called "Columns" (was "View"), and its heading reads "Show columns" — what it does, in the user's words.
- 2141de2: Focus mode scrolls. The fullscreen layer no longer scrolls itself; inside it the table becomes the scroll region on both axes with a sticky header, so the toolbar stays put while long, wide lists scroll. Entering and leaving focus only swaps the frame's classes, so the list keeps its state and its theme scope. `DataTable` gains `fill` to request that layout outside a frame.
- b24949c: Frozen columns stay under the sticky header while a list scrolls (the cell's `z-index` outranked the header row's, so the header was painted over), and they restate the row's focus tint like its other states.

  What the table actually draws is now one list, derived once: the frozen run never includes a column the width gate dropped (no seam on an invisible column), a grouping header narrows to the leaves that survive and disappears when none do, and `onRenderedColumnsChange` tells the host which columns are on screen — render-time gating is not TanStack visibility, so anything that must agree with the user's view (a chat agent reading the list) has something truthful to read.

  The active row also scrolls into view when it _moves_ — a late-arriving page or a re-sort — not only when its id changes, and the facet filter resolves a column once per row instead of scanning every cell on every pass.

- b24949c: A round of review findings on the list family, each of which a user would eventually have hit.

  Frozen columns: the run is measured from every column in it (a selection checkbox leading a pinned identity column left the next one stacked at zero, overlapping it), the cells take an opaque form of the table's own surface instead of the page background (a visibly different strip in dark mode), and their hover tint is limited to rows that actually respond to a hover.

  Keyboard and pointer: Escape on an active row no longer also leaves focus mode, arrow keys carry DOM focus with the active row (Enter used to open the row the keyboard had left), and a double click performs one selection and one open rather than two clicks and an open.

  Toolbar and selection: the selection bar appears only while rows are selected — passing the component is not the same as having a selection, and the filter row was disappearing behind an empty one — it renders in inline layouts too, counts every selected row (a filter that hides them no longer hides the only way to clear them), and "Clear" clears rather than restoring a caller's `initialState`. Focus mode shows every facet even when some declare `pinned`.

  Also: `meta.defaultHidden` now actually starts a column hidden (it was documented and inert), `facetBuckets` keys are deduplicated so a facet cannot count one row twice, `showIn: "focus"` follows real focus mode rather than the `fill` layout prop, `useElementWidth` re-observes when the ref's element is replaced, and `DataTableFrame` reports focus changes made with Escape.

  A second pass closed four more: rendered-column reports keep ids that contain a comma, Escape falls through to the frame when no row is active, `meta.defaultHidden` reaches leaves nested under a grouping header, and `parseDateish` no longer lets `Date.parse` make the country-dependent guess it exists to refuse.

  A third pass closed three more: `meta.defaultHidden` resolves ids the way TanStack does (a dotted `accessorKey`, a string header) and is left to the owner of a controlled list — `defaultHiddenColumns(columns)` is exported for that layer's defaults, since re-applying it every render undid the user the moment they brought a column out — and a date-only deadline now runs out at the END of its day rather than at midnight, so nothing is "overdue" for most of the day it is due.

  A fifth pass: a date-only deadline ends at the next LOCAL midnight (a day is 23 or 25 hours long twice a year, so adding 86,400,000 ms ended it an hour early each autumn), pinned row tints composite over the table's own surface rather than the page background so a frozen strip does not diverge on hover or selection, the row keyboard handler leaves arrows and space to ARIA widgets (`role="slider"`, `switch`, `checkbox`, `combobox`, `contenteditable`) instead of only native controls, and keyed context is cleared on navigation whatever its persistence — it tracks a piece of UI, and that UI is gone.

  A sixth pass: tree and grid widgets keep their arrows, focus follows the active row only when it is ON a row (never out of a control someone is using inside one), the frozen strip stops tinting for a focused descendant the rest of the row does not tint for, and an empty-string context key counts as a key. The DST regression test also runs in a zone that observes daylight saving — CI runs in UTC, where every day is 24 hours and the test could not have failed.

  A seventh pass: a partially gated grouping header is sized by the leaves that survived (its own `getSize()` still counted the dropped ones, holding space for a column nobody can see), `role="button"` and `role="link"` count as controls so a div-button's click no longer opens the row behind it, `addContextItem` no longer accepts a tracking `key` it would not replace by, and the README's facet example is valid TypeScript rather than an object literal with a semicolon in it.
  - @iloveagents/foundry-agent@0.20.0
  - @iloveagents/foundry-web-primitives@0.20.0

## 0.19.0

### Minor Changes

- a7dcd3d: `DataTableToolbar` reads as two bands instead of one ragged wrap: row 1 is search plus a fixed right group (Filters toggle · actions · View · focus), row 2 is the filter row (facets · + Filter · Reset). The filter row collapses behind the "Filters" toggle — which keeps the active count visible — for dense, spreadsheet-like screens. `layout="inline"` restores the single wrapping row.

### Patch Changes

- @iloveagents/foundry-agent@0.19.0
- @iloveagents/foundry-web-primitives@0.19.0

## 0.18.0

### Minor Changes

- 1e90612: Lists compose: `clientToolRegistry.addPageTools` / `removePageTools` let a component (a list, a panel) contribute page tools next to the page's own instead of replacing them, and the DataTable URL codec takes a `prefix` (`risks.q`, `risks.f_status`) so several lists can share one page URL.
- 6651005: Lists stay calm and fit the screen: `DataTableToolbar` pins only the first facets (explicit `pinned`, else `pinnedFacets`, default 3) and parks the rest behind a "+ Filter" menu until chosen or active, with short truncated selection badges; a column's `meta.breakpoint` ("sm" | "md" | "lg" | "xl" | "2xl") hides it below that viewport; `DataTableFrame` adds a focus (fullscreen) mode with a toolbar button and Escape to leave. `visibleFacets()` exposes the facet split.

### Patch Changes

- Updated dependencies [1e90612]
  - @iloveagents/foundry-agent@0.18.0
  - @iloveagents/foundry-web-primitives@0.18.0

## 0.17.0

### Minor Changes

- 8d75303: Add the DataTable family: `useDataTable` + `DataTable`, `DataTableToolbar` with faceted filters that carry live counts (OR within a facet, AND across facets, array-aware, "None" for empty cells), AND-of-tokens search, `DataTableColumnHeader` (sort / hide), `DataTableViewOptions` (column visibility), `DataTablePagination`, `DataTableRowActions`, `selectionColumn`, single-level grouping with declared group order, and a URL codec (`serializeDataTableState` / `parseDataTableState` / `mergeDataTableUrlState`) that keeps the existing `q` / `sort` / `f_<id>` keys. Also adds `DropdownMenuCheckboxItem`. Built on `@tanstack/react-table` 8.

### Patch Changes

- @iloveagents/foundry-agent@0.17.0
- @iloveagents/foundry-web-primitives@0.17.0

## 0.16.0

### Minor Changes

- 4513512: A nav row no longer claims to be a leaf when its children were never fetched.

  A tree row shows a chevron if it branches and a dot if it is a leaf — two
  markers for a question with three answers, the third being "nobody has
  looked". A nav that loads subtrees lazily leaves every unvisited row with an
  empty `children`, and the row then asserted "nothing under this one" on the
  strength of a request that was never sent. Selecting it turned the dot into a
  chevron.

  `NavItem` gains `childrenUnloaded`. While it is set, the row shows neither
  marker — no dot asserting an emptiness nobody checked, no chevron opening onto
  nothing — and the cell still holds its column so labels stay aligned and no
  marker jumps sideways when the answer arrives. Loaded children still win: the
  flag describes ignorance, not a display mode.

### Patch Changes

- @iloveagents/foundry-agent@0.16.0
- @iloveagents/foundry-web-primitives@0.16.0

## 0.15.0

### Minor Changes

- 2737557: Fold everything an assistant turn did into ONE activity row.

  A turn that searched a corpus eleven times rendered eleven "2 tools · done"
  rows — one per adjacent run of tool calls — plus a reasoning row of its own,
  with the answer somewhere underneath. Each row was individually reasonable;
  stacked, they were a ladder the reader had to climb past to reach the point.

  The machinery now folds once, at the turn: `Worked · 20 tools · reasoning`.
  Inside the fold, order is chronological — reasoning explains the calls that
  follow it, so it renders in place, captioned rather than behind a second
  disclosure. The answer never goes inside the fold and still comes last.

  `ToolRunGroup` (internal, never exported) is superseded by `TurnActivity`.

### Patch Changes

- 2737557: Two fixes to the running state of a chat turn.

  The activity row said "Thinking…" while the status indicator two lines below
  said "Thinking" — the same word twice on one screen, reading as a stutter
  rather than as two facts. The row now names its CONTENTS ("Reasoning") and
  leaves the run phase to the indicator, which knows things the row cannot:
  which tool is in flight, and whether the stream has stalled. Ellipses dropped
  with it; the row's spinner already carries "still going".

  The message column had `pt-8` and no bottom padding, so whatever came last in
  the thread sat flush against the composer. Most visible on the running status
  line, which read as part of the input rather than part of the conversation —
  but the last message had the same problem, quietly.

- 2737557: Stop hoisting the model's prose to the bottom of an assistant message.

  Text carried a flex `order-2` so every prose part floated below the
  machinery — added when the only machinery was a reasoning row, to keep it
  from sitting above a one-line answer.

  Multi-step agent turns emit prose BETWEEN steps, and the hoist stripped it
  out from between the work and stacked the bare summary rows into a column:
  the exact ladder the activity row removes. It also glued consecutive prose
  parts into one run-on paragraph.

  Nothing reorders now. Parts render where the model put them, so a multi-step
  turn reads as work, what it learned, work, what it learned, answer. The
  `placement`/`after-tools` option on `MessageDisclosure` is removed with it.

- 2737557: Four fixes from review of the turn-activity work.

  Markdown parts get a wrapper element again. `MarkdownText` renders
  `<ReactMarkdown>` directly, which emits its top-level blocks into a fragment —
  without an element to hold them, every paragraph and list became a direct
  child of the message's `gap-4` flex container and picked up 16px of
  message-part spacing on top of its own margins.

  The activity row's summary is now its accessible name. An `aria-label`
  replaces the name a button derives from its contents, so a generic one
  announced the row while hiding the call count, the failure count, and whether
  there was reasoning to read.

  The all-failed alarm waits for the turn to settle. A run whose only calls so
  far had failed went red mid-turn, while the model was still working toward one
  that succeeds.

  The effort gauge only replaces the words when it has a level to show. With no
  resolved level a narrow composer showed four faint bars and a caret, with the
  explaining tooltip out of reach on touch.

- 2737557: Message foldaway rows and the reasoning-effort trigger, tightened.

  Rows now line up with the message text instead of sitting 6px inside it — the
  pill's own padding was shifting its contents right of the prose above and
  below it. A negative margin cancels it, so the hover pill keeps its padding
  and the icon still starts on the text's left edge. The pill also hugs its
  label now rather than spanning the whole message width.

  The disclosure caret moved from the head of the row to the tail. Leading it
  put two glyphs in front of every row and pushed the status icon — the one
  that carries meaning — into second place. A trailing caret rests pointing
  DOWN and flips up when open, the opposite of the leading convention, so the
  glyph changed with the position.

  The effort trigger shows the level as four rising bars when — and only when —
  there is no room for the words. They are the same fact, so exactly one of them
  renders: wide, the words name the level outright and need no decoding; narrow,
  they drop entirely and the bars carry it in 45px instead of ~75px. Dropping
  just the mode was not enough, since "Medium" still cost more width than a chat
  bubble's input could spare next to Send. The gauge shows an empty track when
  the app has not said what `Auto` resolves to, for the same reason the menu
  hint refuses to name a level it does not know.
  - @iloveagents/foundry-agent@0.15.0
  - @iloveagents/foundry-web-primitives@0.15.0

## 0.14.2

### Patch Changes

- c12e3bc: Composer: the reasoning-effort picker stops crowding the message input in
  narrow composers. The trigger keeps the level ("High") and drops the mode
  prefix ("Auto · ") when its container is narrow, via a container query —
  the full label stays in `aria-label` and `title`. Also gives the running
  status ("Thinking") bottom padding in the chat bubble, where it sat on the
  composer's border.
  - @iloveagents/foundry-agent@0.14.2
  - @iloveagents/foundry-web-primitives@0.14.2

## 0.14.1

### Patch Changes

- e2122b3: Chat: reasoning and tool runs now share one row shape, and both start folded.

  The two foldaways in an assistant message had been built separately and
  drifted — one caret pointing down on the right of its label, the other
  pointing right on the left of its own, with different paddings and hover
  treatments — so stacked together they read as two unrelated widgets. Both now
  render through `MessageDisclosure`: caret first, then the part's icon, then
  the label, on one baseline with identical metrics.

  Tool runs are collapsed by default. The summary line already says how many
  calls ran and whether they worked; the cards otherwise bury the answer they
  were meant to support.

  The strip is also tighter: rows are 20px instead of 24px, and a row that
  directly follows another closes the message's 16px part gap to 4px — two
  foldaways used to put 64px of chrome above a one-line answer, now 44px. The
  in-progress status line loses its fixed 40px box (which left a hole under the
  last tool row) and pulses one dot rather than three.

  Reading order is fixed rather than chronological: tool runs, then the reasoning
  that explains them, then the answer. A model normally emits its thinking first,
  which put the least important row at the top of every message and pushed the
  answer down.

  The "Thinking" line also sits with the message it belongs to. An assistant
  message with no parts yet still rendered the row reserving its copy/retry
  buttons — `hideWhenRunning` hid the buttons but not their 32px of height — so
  an empty 36px block sat between the question and the indicator.

- 34e5bff: Sidebar: a flat group no longer renders the tree's leaf dot or reserves its
  disclosure column. Whether a row is "in a tree" is decided per group, from
  whether any item in it has children — so Workspaces keep the dot that lines
  their leaves up, while New Thread, Activity and the chat list sit flush at
  the sidebar's left edge.
  - @iloveagents/foundry-agent@0.14.1
  - @iloveagents/foundry-web-primitives@0.14.1

## 0.14.0

### Minor Changes

- d9e66ea: feat(chat): collapse tool runs to a status line, and give every chat surface the same controls

  **Tool calls no longer flood the transcript.** A run of adjacent tool calls
  folds into one row — "3 tools · done" — with the cards under it, one click from
  being folded away. A turn that called eight tools used to render eight bordered
  cards with no way to hide them; the run is now a single quiet line you can
  collapse when the machinery is in the way.

  The cards stay open by default: watching an agent work is the reason to look at
  them, and a transcript that hides every step reads as though nothing happened.
  The summary says how many calls failed, and turns red only when _every_ call
  failed — one failure among successes is a run that recovered, not a broken turn.

  **One renderer for every chat surface.** The bubble and the expanded chat each
  configured `MessagePrimitive.Parts` separately and had drifted — the expanded
  chat rendered full tool cards, the bubble rendered assistant-ui's default. Both
  now compose `ChatMessageParts`, so there is one place to drift from.

  **The bubble composer gets the reasoning-effort picker**, in the same slot the
  expanded composer uses — between the input and Send, the placement the rest of
  the industry has settled on. It carries the same label, so the two surfaces
  read identically.

  **New Thread no longer throws you out of the expanded chat.** In expanded mode
  the button navigated to `/`, which the shell treats as "collapse expanded
  chat" — so it dropped the mode and the page the user was reading. Expanded now
  starts the thread in place, the contract the bubble already used.

  Rows expose `data-tool-run-group` / `data-tool-run-trigger`, the bubble panel
  exposes `data-chat-surface`, and the effort trigger exposes
  `data-reasoning-effort-trigger` — stable handles for tests and downstream E2E.

- d9e66ea: fix(tools): let a page withdraw a tool it can no longer perform

  `usePageTools` registered once on mount and never looked again, so the tool
  catalogue described the page as it was at mount rather than as it is. A page
  whose capabilities are state — a document open read-only, a form with nothing
  to submit — advertised tools that could only fail, and the model, correctly
  trusting the catalogue, spent turns calling them and reporting the error back
  to the user.

  The set is now re-registered when the schema the model sees changes (names,
  descriptions, parameters), so conditional tools work:

  ```tsx
  usePageTools([infoTool, ...(canEdit ? [editTool] : [])]);
  ```

  A fresh array literal with identical schemas does not re-register, and
  `execute` always dispatches to the current render's closure — so tool bodies
  read live state directly instead of through the refs the mount-time
  registration used to force.

### Patch Changes

- @iloveagents/foundry-agent@0.14.0
- @iloveagents/foundry-web-primitives@0.14.0

## 0.13.0

### Minor Changes

- 7734c28: feat(sidebar): Confluence-style branch/leaf chevrons in the nav tree

  Every nav row now leads with a fixed-width disclosure cell: a chevron when the
  item has children, a small dot when it is a leaf. The chevron is visible at
  rest and rotates on expand, so the shape of the tree — which rows go deeper,
  which are terminal, which are open — is readable without hovering a single row.

  Previously expand/collapse lived in the hover-only right-hand row controls,
  which meant a nav at rest carried no branch/leaf information at all. That slot
  now holds the item's actions menu only.
  - Row indent moved from the inner navigate button to the row wrapper, one
    8px rung per depth, so the disclosure cells stack in one column that also
    lines up with the collapsible group-header chevron.
  - Rows expose `data-nav-depth`, and branch chevrons expose `data-nav-twisty`
    plus `aria-expanded`, giving tests and downstream E2E a stable handle on the
    tree structure.
  - Clicking a chevron toggles without navigating; clicking the row still
    navigates and expands as before.
  - The chevron draws in a 16px cell but takes clicks in 24px (WCAG 2.2 target
    size), and rows expose `data-sidebar-surface` so a test or E2E selector can
    address the desktop rail and the mobile drawer separately.
  - The disclosure cell is absolutely positioned over the row's own padding, so
    the entire row — indent strip and cell included — stays a live navigation
    target while the branch chevron still catches its own clicks.

### Patch Changes

- @iloveagents/foundry-agent@0.13.0
- @iloveagents/foundry-web-primitives@0.13.0

## 0.12.1

### Patch Changes

- e008d2f: Shell: render the page in ONE tree so expanding chat can't remount it

  `ShellLayout` rendered `{page}` in two different JSX branches
  (`isExpanded ? … : …`), so every chat expand/collapse unmounted the
  entire page subtree and mounted a fresh one. Pages holding live state
  lost it — the embedded Office editor tore down its WOPI session and the
  user's text selection vanished on the very gesture (expanding chat) used
  to ask the agent about that selection.

  The page column now renders at one fixed slot; only its classes change
  between layouts, and the conditional siblings collapse to `false` in
  fixed JSX slots so the page's fiber identity survives.

  Also: the chat launcher now carries the sparkles (AI) mark instead of a
  speech bubble, and its accessible name is "Ask the AI".
  - @iloveagents/foundry-agent@0.12.1
  - @iloveagents/foundry-web-primitives@0.12.1

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
