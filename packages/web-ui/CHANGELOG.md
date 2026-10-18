# @iloveagents/foundry-web-ui

## 0.42.3

### Patch Changes

- 0d2e87f: Publish the app starter as `create-lykomi-app` (`npm create lykomi-app`) and point package repository metadata at `lykomi/ui` after the GitHub transfer.
- Updated dependencies [0d2e87f]
  - @iloveagents/foundry-agent@0.42.3
  - @iloveagents/foundry-web-primitives@0.42.3

## 0.42.2

### Patch Changes

- 516d771: Preserve registered document URLs in chat Markdown so source links open through the host application at their cited location. Re-evaluate links when handlers are registered after history loads, while retaining the default safety rules for unhandled URLs and images.
  - @iloveagents/foundry-agent@0.42.2
  - @iloveagents/foundry-web-primitives@0.42.2

## 0.42.1

### Patch Changes

- 4c9d55b: Keep horizontal column navigation within the sticky table header on narrow page-scrolling lists.
  - @iloveagents/foundry-agent@0.42.1
  - @iloveagents/foundry-web-primitives@0.42.1

## 0.42.0

### Minor Changes

- d9cb710: Add a page scroll mode for dedicated list views. The containing page can own vertical scrolling while the table header stays below its sticky navigation; focus mode retains its bounded, virtualized layout.

### Patch Changes

- @iloveagents/foundry-agent@0.42.0
- @iloveagents/foundry-web-primitives@0.42.0

## 0.41.1

### Patch Changes

- a0264ae: Show a dashed-circle marker for optional process steps before they start, while preserving status markers after they run or complete.
  - @iloveagents/foundry-agent@0.41.1
  - @iloveagents/foundry-web-primitives@0.41.1

## 0.41.0

### Minor Changes

- 78637b7: Add opt-in live process context to ProcessGuide. The With control and AG-UI share actual and inspected steps, statuses and blockers, with client tools to read current context and inspect selectable steps through the host callback.

### Patch Changes

- @iloveagents/foundry-agent@0.41.0
- @iloveagents/foundry-web-primitives@0.41.0

## 0.40.1

### Patch Changes

- 4609ef7: Align vertical process steps with their guidance and use the available width for each step, including responsive mobile layouts.
  - @iloveagents/foundry-agent@0.40.1
  - @iloveagents/foundry-web-primitives@0.40.1

## 0.40.0

### Minor Changes

- 83e34f0: Add an optional compact step disclosure: guidance can start collapsed, explicit step selection opens it, and an independent chevron folds it without changing process state or discarding input.

### Patch Changes

- @iloveagents/foundry-agent@0.40.0
- @iloveagents/foundry-web-primitives@0.40.0

## 0.39.0

### Minor Changes

- 0d9d424: Add ProcessSteps and ProcessGuide for accessible, themed wizard progress and resumable process guidance, with explicit navigation, running and blocked states, and responsive layouts.

  Provide a slim compact rail and optional accessible guidance disclosure that keeps forms mounted.

### Patch Changes

- 5d17d5d: Add optional theme-based chevron separators to horizontal compact process navigation, sized for comfortable and compact density. Expose showChevrons on ProcessSteps and ProcessGuide, off by default.
- db9fcf2: Keep process steps readable in overflowing rails, with accessible scroll controls, edge hints, contained selection reveal and an optional horizontal mobile layout.
- 042c963: Use consistent status icons for process rails, distinguish waiting from ready, and support independent, localized optional-step labels. Selected ready steps use a centered dot; other states retain their own symbols.
- 87b3a7e: Refine compact process guidance with a continuous primary progress track, outlined completion markers, subtle step surfaces and an unfilled guidance header. Keep unfinished vertical connections neutral and remove the redundant Ready marker ring.

  Add compact density for standalone host-controlled progress navigation and make numeric guidance position opt-in.
  - @iloveagents/foundry-agent@0.39.0
  - @iloveagents/foundry-web-primitives@0.39.0

## 0.38.0

### Minor Changes

- a43dcda: Window large table row sets within a bounded scroll viewport, preserving continuous hierarchy, measured row heights, pinned columns, keyboard navigation, focused controls and print output. Large unbounded lists receive a bounded viewport automatically.

### Patch Changes

- @iloveagents/foundry-agent@0.38.0
- @iloveagents/foundry-web-primitives@0.38.0

## 0.37.0

### Minor Changes

- 1743d39: Add bounded, keyboard-accessible column resizing and persisted user widths to DataTable. Use fixed column tracks so long titles cannot consume the table, keep declared column bounds, and offer one native horizontal scrollport with reachable arrow controls. Preserve horizontal position during vertical row navigation and allow shared column defaults through useDataTable.

### Patch Changes

- Updated dependencies [a404c05]
  - @iloveagents/foundry-web-primitives@0.37.0
  - @iloveagents/foundry-agent@0.37.0

## 0.36.0

### Minor Changes

- 1ab5ae9: Render Mermaid fences as themed diagrams in chat and Markdown panels, with source view, copy, streaming fallback, and isolated rendering. Export the shared MermaidDiagram component for document surfaces.

### Patch Changes

- 28ab214: Use the neutral theme border for workbench chrome so it does not look like an active selection frame.

  Constrain form-dialog grid tracks so lookup controls fit narrow viewports.

- Updated dependencies [28ab214]
  - @iloveagents/foundry-web-primitives@0.36.0
  - @iloveagents/foundry-agent@0.36.0

## 0.35.1

### Patch Changes

- 38a3c7f: Align collapsed chat history and navigation shortcuts on a shared header and icon-row grid.
  - @iloveagents/foundry-agent@0.35.1
  - @iloveagents/foundry-web-primitives@0.35.1

## 0.35.0

### Minor Changes

- ef38375: Make the workbench the only shell layout and remove the classic UI switch.

### Patch Changes

- @iloveagents/foundry-agent@0.35.0
- @iloveagents/foundry-web-primitives@0.35.0

## 0.34.0

### Minor Changes

- 797920a: Apps can add their own settings to the user menu. `useNavStore().setUserMenuToggle({ id, label, checked, onCheckedChange })` registers a checkbox item that `UserMenu` shows in every shell; `removeUserMenuToggle(id)` takes it out again. It is the place for a preference about the whole interface, such as showing hidden items: footer actions are hidden inside a workspace in the workbench.

### Patch Changes

- Updated dependencies [9d32ad7]
  - @iloveagents/foundry-agent@0.34.0
  - @iloveagents/foundry-web-primitives@0.34.0

## 0.33.4

### Patch Changes

- 9189ee1: Keep frozen table cells highlighted with the rest of an active or selected row during hover and keyboard focus.
  - @iloveagents/foundry-agent@0.33.4
  - @iloveagents/foundry-web-primitives@0.33.4

## 0.33.3

### Patch Changes

- ab82b2e: Polish the theme-aware connected navigation selection and show more useful conversation context on chat home.
  - @iloveagents/foundry-agent@0.33.3
  - @iloveagents/foundry-web-primitives@0.33.3

## 0.33.2

### Patch Changes

- d212699: The sidebar's container drop zone no longer moves the rows beneath it, nor
  answers for the rows beside it.

  The 4px strip inside an expanded container grew to a 28px labelled band when a
  drag arrived over it, and growing on hover is wrong in both available shapes.
  In flow, every row below jumped 24px at the moment the pointer crossed the
  strip — which is the moment the user is aiming at one of those rows, so the
  destination walked away from the cursor and the drop landed on whatever had
  slid underneath. Out of flow, nothing moves, but the expanded band covers
  about 12px of the rows on either side and takes their drops instead.

  So the space is reserved for the whole drag rather than on hover. The zone
  stays in flow, and the band fills exactly the strip it reserved, so what is
  painted is what accepts.

  "For the whole drag" has to mean it, so the reservation opens instantly and
  only the collapse animates — an animated opening is a moving target for as
  long as it runs, and 150ms is inside the time a short drag to a nearby row
  takes.

  It also has to mean "before the user has aimed", which is as much a
  precondition as it is the point. Only a drag that starts in this document has
  a moment before the aim: `dragstart` fires before any movement, so the layout
  settles while the pointer is still on the row being picked up. A drag arriving
  from outside — the desktop, or another window — has no such moment; the
  browser hit-tests whatever is under the pointer before any script runs, so the
  first `dragenter` the document sees is already aimed at something. Opening the
  zones from it would move that something out from under a stationary pointer —
  the very failure this change exists to remove, arriving by a different road.
  So outside drags get no reservation: the strips stay 4px and nothing moves.
  They are not left without a target, because container rows accept and
  highlight file drops themselves.

  Because the zone is open before the pointer reaches it, nothing about the drag
  can be read off the zone's own hover state any more, so the drag publishes the
  set of MIME types it carries, and whether a zone opens at all follows that:
  reserving space and painting a label is a promise that a drop will land, so a
  container that takes entity moves but not files stays shut for a file drag,
  and a module's zones no longer open for another module's `dnd.type`.

  A set rather than one type, because `dragstart` bubbles and a draggable row
  sits inside a draggable container — both handlers run, and tracking one would
  track whichever ran last, leaving zones that match the child's payload shut.

  The set is read directly and never serialised: a MIME token may legally
  contain any separator one might join them with (`|` is not one of RFC 2045's
  tspecials), and a split on it turns one type into two — the zone that owns
  it staying shut while a zone matching a fragment opens for data it cannot
  read. What components subscribe to is a version counter instead.

  A drag also ends when a nav refresh removes the row it started from. Such a
  source still receives its own `dragend`, but a detached node's event reaches
  no window listener — so the reservation would otherwise stay open, every zone
  expanded, until some later drag happened to finish elsewhere.
  - @iloveagents/foundry-agent@0.33.2
  - @iloveagents/foundry-web-primitives@0.33.2

## 0.33.1

### Patch Changes

- @iloveagents/foundry-agent@0.33.1
- @iloveagents/foundry-web-primitives@0.33.1

## 0.33.0

### Minor Changes

- d25c6e3: Show how full a conversation is. The runner now surfaces the server's per-call `usage` CUSTOM event as a `usage` runner event, and the chat adapter records it per thread in the new `contextUsageStore`. The chat context card ("With …") gains a "Conversation memory" section: a bar with the fill and its ceiling, and a plain sentence about what happens as it fills. When the fill passes 90% the bar turns amber and the context row shows a small dot. The section prefers `context_used_tokens` / `context_limit_tokens` from the usage event, which are in the server's own units and exclude the system prompt and tool declarations. Otherwise it uses the latest call's input size against a window the host states via `/api/chat/config` as `context.windowTokens`. `useConversationMemory()` and `ConversationMemory` are exported. The adapter's React context moved to `ag-ui-adapter-context.ts`, which exports `useCurrentThreadId()`, so components can read the current thread without importing the runtime provider.

### Patch Changes

- f81e285: Keep components and handlers out of the agent state projection. A nav group's `meta` may hold what a panel renders (items with icon components and action handlers); once such a group was active, the adapter's `structuredClone` of the projection threw and every message in that chat failed in the browser before a request was made. `getAgentState()` now projects nav meta, page meta and content to plain data: an object holding a component or a handler is left out whole, and anything a clone already accepted passes through unchanged.
- Updated dependencies [d25c6e3]
  - @iloveagents/foundry-agent@0.33.0
  - @iloveagents/foundry-web-primitives@0.33.0

## 0.32.4

### Patch Changes

- 58f5850: Show recent and pinned chats in separate responsive columns below the start-page composer, make the composer and create action easier to spot, and center the context control in the empty full chat view. Use "chat" consistently in visible history and navigation labels.
  - @iloveagents/foundry-agent@0.32.4
  - @iloveagents/foundry-web-primitives@0.32.4

## 0.32.3

### Patch Changes

- a531c39: Keep the chat and content divider visible when a custom thread surface, such as a live voice stage, covers the chat viewport.
  - @iloveagents/foundry-agent@0.32.3
  - @iloveagents/foundry-web-primitives@0.32.3

## 0.32.2

### Patch Changes

- f6d50d9: Keep custom conversation surfaces full-height on the empty chat home, with an
  optional composer takeover that preserves the speech-to-composer bridge and drafts.
  Add opt-in relay acknowledgements for long agent runs, serialized with answer
  speech and cancelled when answer text arrives, on interruption, completion or
  disconnect. Hosts can leave the opening reply free of waiting acknowledgements.
  Optional tool-activity descriptions provide spaced, deduplicated updates from the
  current turn, with a maximum of three updates and no raw tool-result narration.
  Keep the latest speaker's caption through playback pauses and empty transcript events.
  - @iloveagents/foundry-agent@0.32.2
  - @iloveagents/foundry-web-primitives@0.32.2

## 0.32.1

### Patch Changes

- 8a65702: Wrap long tool-card descriptions within narrow chat panes, including unbroken error details.
  - @iloveagents/foundry-agent@0.32.1
  - @iloveagents/foundry-web-primitives@0.32.1

## 0.32.0

### Minor Changes

- e4ee172: Let themes set browser favicons and mobile bookmark icons, with dark-mode favicon variants and compact-icon fallback.

### Patch Changes

- @iloveagents/foundry-agent@0.32.0
- @iloveagents/foundry-web-primitives@0.32.0

## 0.31.0

### Minor Changes

- 46fe6c1: Expose a complete authoring catalogue for supported theme slots, add a semantic heading colour, and derive workflow glow colours from the active palette.

### Patch Changes

- @iloveagents/foundry-agent@0.31.0
- @iloveagents/foundry-web-primitives@0.31.0

## 0.30.0

### Minor Changes

- a8f766d: Keep running conversations alive when starting or opening another chat, expose their status in conversation history, and warn before leaving during active work. Add support ID copying and refine compact navigation spacing.

  Unify composer context in the With menu, including selected items, removable references, and pins. Preserve scoped navigation context when list filters change.

  Citation writes and clears now require the emitting conversation ID. The shell retains visited conversation configurations and supports configured conversation URLs.

  Conversation deletion handlers should call `removeChatRun(threadId)` after successful deletion to remove retained browser-session activity.

### Patch Changes

- Updated dependencies [a8f766d]
  - @iloveagents/foundry-agent@0.30.0
  - @iloveagents/foundry-web-primitives@0.30.0

## 0.29.1

### Patch Changes

- f790326: Align compact chat homes with content panels, simplify recent conversations, and tighten desktop navigation trees.
  - @iloveagents/foundry-agent@0.29.1
  - @iloveagents/foundry-web-primitives@0.29.1

## 0.29.0

### Minor Changes

- 7ac54a2: Show a short, context-aware recent conversation list in empty workbench chats and align the empty state with the top of the working panes.
- 863a2c2: Add a module-owned chat home starter slot across workbench, full chat and bubble surfaces. Align the conversation history shortcut with the chat home content.

### Patch Changes

- 863a2c2: Use the same compact conversation home in workbench and focus chat panes, including contextual starters.
- 863a2c2: Distinguish unpinned items with a tilted, lightly filled pin. Indicate pinned state through the glyph tint without a persistent button background.
  - @iloveagents/foundry-agent@0.29.0
  - @iloveagents/foundry-web-primitives@0.29.0

## 0.28.1

### Patch Changes

- d54f225: Show ongoing AI activity in the collapsed chat rail and compact chat selector.
  - @iloveagents/foundry-agent@0.28.1
  - @iloveagents/foundry-web-primitives@0.28.1

## 0.28.0

### Minor Changes

- 40a3137: Offer the workbench preview switch in production as well as local development.

### Patch Changes

- @iloveagents/foundry-agent@0.28.0
- @iloveagents/foundry-web-primitives@0.28.0

## 0.27.1

### Patch Changes

- 7a516c1: Use “Do anything” consistently as the default chat composer placeholder.
  - @iloveagents/foundry-agent@0.27.1
  - @iloveagents/foundry-web-primitives@0.27.1

## 0.27.0

### Minor Changes

- 64ef94c: Add group-only collapsed navigation and a centered welcome composer. Refine preview navigation with recent chats, static section labels, consistent spacing, and recognizable panel reopening icons. Show recent history in empty side chats while preserving the composer.
- 64ef94c: Show current request context beside the composer and replace duplicated workbench history with an explicit conversation history view. Keep empty chat layouts bounded and preserve the conversation while browsing content.

  Keep hidden list descendants in the navigation context model via `NavItem.childrenHidden`, selecting the visible list owner without rendering its rows. Show the last-location subline consistently for workspace and non-workspace conversations.

  Add an optional `contextDetails` chat slot for grouped capabilities in the context flyout. Make conversation history discoverable from the chat home, default its filter to the current workspace, and support last-entity sublines.

- 64ef94c: Add a reversible development preview that connects navigation, chat, and content in one adjustable workbench. Include chat history, collapsible panes, a compact composer, and optional sidebar and contained-panel presentation controls while preserving the classic layout.
- 64ef94c: Expose the shared workbench presentation through a lazy-loadable web-ui/workbench entry point. Keep the shell responsible only for opt-in/runtime wiring, and split navigation, pane controls, resize handling, welcome content, and layout state into focused UI components and hooks. Preserve entity-field retargeting and sidebar contour updates.

  Export the shared themed PinToggle and reuse the pin state glyph across content controls.

### Patch Changes

- 64ef94c: Make overflowing table columns discoverable with themed previous/next controls and a keyboard-focusable scroll region.
- 64ef94c: Refine preview chat history with pinned groups and row actions, preserve document context when resuming same-space chats, and simplify the global welcome header.
- 64ef94c: Align conversation and composer typography with themed interface text, and keep live status close to activity by removing unused action spacing during generation.
- 64ef94c: Standardize context pin state with upright outline and filled icons, theme-based contrast, and pressed-state semantics on toggle buttons.
- 64ef94c: Separate focused dialog/chat/source presentation from the stable table frame. Route tool results into the topmost focused source pane and make Escape close that layer without closing the underlying tool panel. Active folder drop targets reserve their own row instead of covering the final child.
- 64ef94c: Preserve focused renderer ownership while updating source results, keep graph context tied to visible surfaces, and improve focus-pane and pinned-context accessibility. Route client draft updates to an active form when it handles the request.
- 64ef94c: Preserve folder expansion across navigation and tree refreshes, including creation of nested items.
- 64ef94c: Allow resizing chat and source panes in table focus mode with pointer and keyboard controls, including reset to automatic sizing.
- 64ef94c: Preserve stable tool-result identities across updates and restored surfaces, while keeping separate results with the same title distinct.
- 64ef94c: Use an accessible full-screen dialog for table focus mode, retaining the mounted table and restoring keyboard focus when closing. The dialog escapes narrow containers and retains theme context.

  When an assistant runtime is available, focus mode offers the existing conversation in a collapsed chat pane. Source references open beside the focused content. Agent state includes the focused surface and bounded table contents.

  Unify workbench list typography and navigation behavior. Recalculate composer height on pane resizing and keep an empty composer compact.

- 64ef94c: Refine the workbench preview with recent chats above the empty composer, compact history rows, accessible icon tooltips, aligned dropdown chevrons, and matching hover-only resize grips. Add navigation width reset on double-click.
- 64ef94c: Allow the workbench to host tool results in retained windows while keeping graph updates connected to the tool panel store.
- 64ef94c: Remove accumulated blank space after expanded navigation folders without removing their drop targets.
- 64ef94c: Keep the development workbench behind a lazy boundary and separate navigation, layout state, chat controls, and resizing. Preserve live thread surfaces, accessible pin controls, browser API fallbacks, and truncation metadata in shared UI components.
  - @iloveagents/foundry-agent@0.27.0
  - @iloveagents/foundry-web-primitives@0.27.0

## 0.26.0

### Minor Changes

- 8c1093d: Sidebar groups can focus on one item without the tree jumping. `NavGroup.focusOn` names the item's `to`: the header keeps its label, typography and height and leads back to the group's `to` (a back chevron in the collapse chevron's column), the item is drawn as a flat, emphasised heading with its children beneath it — one indent step left of a branch's children, at their usual row size — and its siblings are not drawn. The new shape fades in briefly when the focus changes, in either direction. Rows under a visible group header now indent under the header label like tree rows do, and the header's hover surface spans the row like an item row's. Before this a downstream app drew a focused group from the existing primitives and every part of it looked wrong on screen: a back row sat in the twisty column with a leaf dot, the subject sat level with its own children, promoted children grew to top-level row metrics, and the whole nav jumped.

### Patch Changes

- @iloveagents/foundry-agent@0.26.0
- @iloveagents/foundry-web-primitives@0.26.0

## 0.25.0

### Minor Changes

- ae6be4b: Graph visualization, and a Neo4j starter that turns the side panel into a workspace

  A new package, `@iloveagents/foundry-web-graph`, draws a force-directed graph
  from a source-neutral payload — it knows nothing about where the nodes came
  from. Colour and size by type, a filtering legend, hover, select, expand,
  search, pin, and a table fallback for assistive technology. Colours resolve
  from the host's design tokens, so it follows light and dark mode without
  configuration.

  Its `/assistant-ui` entry adds the chat glue that makes the side panel a shared
  workspace rather than a picture. A tool-card factory renders any graph-shaped
  tool result; four client tools (`graph_get_view`, `graph_show`,
  `graph_select_node`, `graph_search`) let the agent read what the user has
  selected and point at what it is describing; and a result that touches what is
  already on screen is folded into it, so expanding a node or watching a write
  land reads as the graph growing rather than as a new picture. The selected node
  joins the chat context automatically, keyed so selecting elsewhere swaps it,
  with a pin that promotes it to a lasting one. `/adapters/neo4j` maps driver
  records onto the payload.

  The details drawer is deliberately non-modal: no scrim and no click-catcher, so
  the graph stays clickable, pannable and zoomable while a node's properties are
  open — and framing knows how much of the canvas the drawer covers, so
  `graph_select_node` reveals a node with the smallest pan that clears it instead
  of re-centring and throwing away the view the user arranged.

  `create-foundry-ui-app --preset neo4j` scaffolds an agent over a graph: schema,
  read-only Cypher, node expansion and semantic-search tools, a local database
  via `pnpm graph:up && pnpm graph:seed`, and the same code against Neo4j Aura by
  changing one URI. Read-only is enforced by the server's READ access mode; the
  write tool is not registered at all unless the deployment opts in, and when it
  is, it returns the nodes and relationships it wrote so the change appears in
  the graph instead of being reported as a counter.

  Two ordering bugs in that scaffold are fixed with it. `load_dotenv()` ran in
  `main.py` _after_ `from .agent import get_agent`, so every setting that decides
  which tools exist was read before `.env` was loaded — writes and semantic
  search stayed off with the variables plainly set in the file. Loading now
  happens in the package initializer, and the tool list is built when the agent
  is created rather than at import.

  In `@iloveagents/foundry-web-ui`, `ToolPanelContent` gains `"graph"` and an
  optional `data` field, `PanelRendererEntry` gains an optional `id` so
  re-registering replaces rather than appends, and `ToolCallCard` accepts
  `open`/`defaultOpen`/`onOpenChange` so a card with an expensive body can defer
  mounting it. All additive.

  `setContextItem` is also now what its name says: given an item identical to the
  one already under that key it does nothing, where before it minted a fresh id
  and a fresh array every call. A UI mirroring a selection into context — the
  graph panel does exactly that — could otherwise churn the store on every
  re-render and drive itself into an update loop.

  Also fixes the foundry-iq preset's README, whose `__PROJECT_NAME__` title had
  been rewritten to `**PROJECT_NAME**` by Prettier — every app scaffolded from
  that preset shipped the corrupted title. `.prettierignore` now covers every
  preset README and a test checks all of them, not just the base template.

  Folding a result into the open graph is a headless watcher, `GraphResultSeeder`,
  rather than a side effect of rendering the tool card. It has to be: the card
  lives inside the turn's collapsed activity strip, which does not mount until
  the reader expands it, so the merge never ran — the agent would name four new
  relationships and the panel would sit unchanged, with nothing reporting a
  failure. Binding a card with `makeGraphToolUI` is what registers a tool as
  graph-shaped, so there is one registration rather than two, and the watcher
  only acts on results that arrive after the thread has settled, so reopening a
  saved conversation does not replay its history over what the user is doing.

  `graph_get_view` reports the graph as DRAWN rather than as queried — a label
  switched off in the legend takes its nodes and relationships out of the counts
  and is named in the result — and `graph_select_node` resolves captions with the
  same rule the canvas paints with, so a node is never visible on screen and
  unselectable by the text on it. The graph is also reachable as a table from the
  toolbar, with the canvas region labelled to say so, because a canvas is one
  opaque element to a screen reader.

  In the Neo4j preset: the scaffold keeps the base template's optional voice
  module (it was dropped when the preset replaced `main.tsx`, so a generated app
  installed `foundry-web-voice` and could never enable it); the embedding
  endpoint is derived from the resource rather than by appending `/models` to a
  project endpoint, which produced a path that does not exist; and a write that
  deletes says so in its result, because a deletion cannot be merged into the
  graph on screen.

  Serialisation goes through a `safeStringify` that survives what a graph
  actually carries: `properties` is whatever the database had, and the Neo4j
  driver returns native `bigint` under `useBigInt`, which `JSON.stringify`
  throws on — so an otherwise valid payload could fail before the panel
  rendered. The payload guard also checks the optional fields now, since it is
  what decides whether the graph card takes over a tool result; `labels: [42]`
  used to be accepted and then crash the first search.

  Smaller ones from the same pass: a relationship-only Neo4j result
  (`MATCH ()-[r]->() RETURN r`) gets endpoint nodes rather than rendering as an
  empty graph; a whitespace-only search no longer dims every node; Escape closes
  the details drawer without also closing the panel underneath it; unpinning the
  selected node returns it to the chat context instead of dropping it; reopening
  a closed panel republishes the selection and search the view still shows; the
  accessible table lists relationships, not just per-node degrees; and the
  `neo4j` preset appears in `create-foundry-ui-app --help`. On the agent side,
  `run_write`, the schema's property list and a scalar result's rows all report
  their own caps, and the expansion and write tools no longer tell the model to
  call `graph_show` for something that now happens on its own.

  Semantic search caps neighbours PER HIT rather than sharing one budget, so a
  single high-degree result can no longer spend the whole allowance and leave
  every other match with no context around it.

  `setContextItem`'s equality guard is bigint-safe. It compared structurally with
  a bare `JSON.stringify`, which throws on a bigint, and the catch reported "not
  equal" — so for a payload carrying one (a database row; the Neo4j driver
  returns them natively) the guard would have minted a fresh id and array on
  every call and re-opened the update loop it was added to close.

  What the agent is told is on screen is now read from the VIEW rather than the
  payload, so the render cap and the legend filter cannot make the two disagree:
  `graph_get_view` counts the drawn graph, reports a relationship selection as
  well as a node one, and folds the render cap into `truncated`. The readable
  table honours the legend filter through the same derivation, and a result that
  arrives while the panel is closed is held back and applied on reopen instead of
  being marked handled and lost.

  `create-foundry-ui-app` also substitutes `__PROJECT_NAME__` in Python files.
  `.py` was missing from the text-extension allowlist, so every scaffold from
  every preset shipped `FastAPI(title="__PROJECT_NAME__ Agent")` verbatim and
  served the placeholder as its own OpenAPI title.

  The readable table is also what actually renders where there is no canvas to
  draw on. The check was `typeof HTMLCanvasElement === "undefined"`, which jsdom
  satisfies while refusing to give a 2D context — so a consumer's test rendering
  `GraphView` took the engine path and hit unimplemented canvas APIs instead of
  the fallback. It asks for the context now.

  A result is now held back until a GRAPH panel is open, not just any panel.
  `isOpen` alone let one be consumed while a document was on screen: the merge
  rejected the non-graph content and the call was marked handled anyway, so
  opening the graph afterwards could never apply it — the same loss the
  closed-panel deferral exists to prevent.

  `graph_get_view` reports edge endpoints as ids. force-graph replaces a link's
  `source`/`target` with the node objects once the simulation has run, so handing
  the links out raw put whole simulation objects — mutable layout fields and all
  — where the caller reads an id. `select` searches the drawn nodes too, so
  asking for one the legend has hidden is refused rather than opening the drawer
  on something invisible.

  Both change-signature comparisons — the graph payload's and
  `setContextItem`'s — tag a `bigint` structurally rather than as a string.
  Rendering `10n` as `"10"` collided with the string `"10"`, and `"10n"` merely
  moved the collision to the string `"10n"`; no string encoding is unambiguous
  when the value it competes with is itself an arbitrary string. A real edit
  between the two therefore read as no change, leaving the drawer and the chat
  context on the old value.

  The Neo4j preset serialises integers outside JavaScript's safe range as
  strings. Neo4j integers are signed 64-bit and `JSON.parse` reads every number
  as a double, so a value past 2^53-1 arrived in the browser silently rounded to
  a neighbouring one.

  Serialising a value and comparing two are now separate functions, because they
  want opposite things. `safeStringify` is the display and transport form — the
  panel's Copy button, the card's raw result, the tool results the agent reads —
  and renders a `bigint` as its decimal string, which is lossy and right: a
  reader wants `10`. Comparisons go through a new `deepEqual`, which does not
  serialise at all. Three encodings had collided in turn (`10n` as `"10"` with
  the string `"10"`, as `"10n"` with `"10n"`, as `{__bigint:"10"}` with a
  property that IS that object), and none could not: `properties` is `unknown`,
  so any encoding can be imitated by data shaped like it. `setContextItem`'s
  guard moves to the same comparison. Both also stop reading a shared but
  acyclic sub-object as a cycle, which had made values differing only there
  compare equal.

  `mergeGraphPayloads` states `stats` only when neither side was truncated. The
  field means totals BEFORE truncation; publishing the client-side union's
  retained counts under it reported a merge of a 500-node truncated read as
  ~300 and called it a total. Once either producer capped, the union's real
  total is not derivable — how far the two full sets overlap is exactly what the
  capped rows would have said — so the field is omitted and `truncated` carries
  the signal.

  The readable table can open a relationship, not just list one. The drawer has
  always handled edges and only the canvas could reach them, so a keyboard or
  screen-reader user could read that a relationship exists and never see one of
  its properties. The search-match count is also read from the drawn graph, so
  it cannot report a match while every node on screen is dimmed, and it carries
  a label — a bare number beside a search box says nothing to a screen reader.

  Hiding a selected node's label no longer makes the view state contradict
  itself: the selection stays (a legend filter is a view toggle, not a deletion,
  and the drawer showing that node is itself on screen) and `graph_get_view`
  reports `selectedNodeHidden`. The graph panel also republishes its selection
  on navigation — the tool panel belongs to the shell and survives a route
  change, while `setCurrentPage` clears keyed context items, so the node the
  user was still looking at silently left the conversation.

  In the Neo4j preset: non-finite floats (`NaN`, `Infinity`) are serialised as
  strings. `json.dumps` emits them as bare tokens that `JSON.parse` rejects and
  strict mode refuses outright, so a query that succeeded died at the transport
  boundary. The local `docker-compose.yml` also binds Neo4j to `127.0.0.1`
  rather than every interface — the password is published in that file so the
  quickstart has no setup step, which is precisely why the port should not be.

  The view handle is one object for the life of the view. `GraphPanel` stores it
  in the workspace when it connects and reconnects only on a payload, title or
  visibility change, so a handle rebuilt whenever the view state changed left
  every client tool holding a closure over the view as it was when the panel
  opened — `graph_get_view` answering without the search the user had since
  typed, `graph_select_node` accepting a node hidden after connection. A merge
  changes the payload and so happens to reconnect, which is why nothing surfaced
  it.

  `safeStringify` tracks only the ancestors of the value it is writing, matching
  the change already made to `deepEqual`. A single visited-set called the second
  sighting of a shared object a cycle, and two nodes sharing one `properties`
  object is ordinary for a hand-built payload or a browser-side adapter — so the
  panel's copied content and the tool results the agent reads carried a literal
  `"[circular]"` where real data belonged. `deepEqual` also compares a `Date` by
  its time and treats other exotic objects as unequal unless identical; enumerable
  keys do not describe them, so two different dates compared equal.

  Keys taken from the payload are treated as untrusted throughout. Labels and
  relationship types are whatever the producer called them, so a graph with a
  label named `constructor` or `toString` read an inherited function out of an
  object literal where a count, a colour override or a caption key belonged.
  Counts accumulate into a `Map` and lookups go through an own-key check.

  Pins are pruned when their nodes leave the payload. A pin is an id, and an id
  outlives the node it named: `graph_show` replacing the graph kept a pin nothing
  shows, and a later graph carrying the same id had that node frozen on arrival
  by a pin made for a different graph.

  `graph_select_node` also distinguishes a legend-hidden node from a
  render-capped one, since narrowing the query cannot bring back a label the user
  switched off, and double-click expansion captions the node with the payload's
  own `legend.captionKey` — the rule the canvas paints by — so the turn names it
  what the user sees.

  The selected node's properties are copied into the chat context in JSON-safe
  form. That item rides along on every subsequent turn and is serialised by the
  HTTP agent, so one native `bigint` — what the Neo4j driver returns under
  `useBigInt` — threw inside someone else's `JSON.stringify` and stopped the
  user sending any message at all while that node stayed selected. The details
  drawer formats structured property values with the same serialiser, where raw
  `JSON.stringify` had been throwing and falling back to `[object Object]`,
  hiding the value in the panel whose whole job is showing it.

  Toolbar counts and the canvas `aria-label` report the drawn graph, so switching
  a label off no longer leaves "2 nodes · 1 rels" beside a canvas showing one
  node and nothing joining it. `graph_select_node` and `graph_get_view` caption
  nodes with the payload's own `legend.captionKey`, matching how the graph is
  matched and painted.

  A write that changed the database and returned nothing to draw is marked
  `view_stale`, as deletions already were: `MATCH … SET …` with no `RETURN` is
  ordinary for a model to generate, and the merge has no rows to apply, so the
  drawer went on showing the property at its old value with nothing saying so.

  The browser Neo4j adapter refuses a numeric identity outside JavaScript's safe
  integer range instead of stringifying an already-rounded value, where two
  distinct ids could collapse to one key and attach edges to the wrong nodes.

  A result held back for a closed panel is remembered as deferred, so it is no
  longer re-extracted on every streamed token for the rest of the turn.

  An ambiguous caption is answered as a question rather than a guess.
  `graph_select_node` matched by caption with `find`, so two nodes sharing a
  name — ordinary in a real graph — resolved to whichever the producer returned
  first, and the agent then described the wrong node with nothing on screen to
  show it had picked. Several matches now come back with their ids so the agent
  can select precisely or ask.

  A full node replaces a relationship-endpoint stub. Measured against a live
  server: a relationship returned on its own hands back endpoints with no labels
  and no properties, and `setdefault` kept that stub even when a later row
  returned the same node in full — drawing a nameless circle with an empty
  inspector for a node the query had actually returned.

  The selected-node chat context is captioned with the payload's
  `legend.captionKey`, like every other path that names a node, and is not
  recreated when the user has already pinned that node — a route change or a
  merge otherwise handed the agent the same node twice under entries whose
  properties could disagree.

  The read-only keyword scan no longer rejects legitimate reads. Neo4j
  identifiers are source-defined, so `Set` and `Call` are legal labels and
  `MATCH (n:Call) RETURN n` was refused as a write. The scan skips backtick-
  quoted identifiers and only matches keywords in clause position — never after
  `:`, `.` or a backtick. The server's READ access mode is what enforces
  read-only, so narrowing the friendly message costs no safety.

  The package README documents the Tailwind v4 `@source` directive. `styles.css`
  carries the palette, not the component styling, and Tailwind does not scan
  `node_modules` — so a consumer following the README got an unstyled graph.

  `prefers-reduced-motion` now means "do not animate the settle", not "do not
  settle". Setting the cooldown to zero stopped the simulation before it had
  arranged anything, so those users were shown the engine's initial placement —
  a scatter with edges crossing at random, which is not a graph. A bounded set
  of warmup ticks runs before the first paint instead: the same layout, arrived
  at without motion.

  The Neo4j preset registers its panel renderer and client tools in an effect
  rather than in the `useInit` body. `useInit` runs on every shell render and
  both registries replace their collection on each call, so registration was
  writing to two stores during render and notifying subscribers mid-render on
  every route change. It also omits `stats` when the row cap truncated a read:
  the field means totals before truncation, and the retained prefix is not that
  — a 500-node query under the default 200-row cap reported 200 as the database
  total.

### Patch Changes

- @iloveagents/foundry-agent@0.25.0
- @iloveagents/foundry-web-primitives@0.25.0

## 0.24.0

### Minor Changes

- e497727: Categorical charts tell the truth about which category is which.

  **Renames a documented public contract**, which is why this is a minor and
  not a patch: the per-series custom properties the container injects are now
  `--chart-color-<key>` (see below). A consumer that wrote
  `var(--color-<key>)` by hand in a custom mark must switch to `seriesVar(key)`
  — the exported helper, which cannot drift again.

  An adversarial review of the freshly-shipped chart family found the fold
  and the palette disagreeing with the discipline the family documents.
  - **The fold ranks before it folds.** `foldCategoryTail` kept the head of
    whatever order it was handed, and `DonutChart` handed it the raw data.
    Six small categories followed by a dominant one rendered as four slivers
    and an unlabeled 96% "Other" — the largest slice invisible. Ranking
    happens inside the fold now, so no caller can reintroduce it, including
    the agent-written renderers this library exists to serve.
  - **The palette has one rule now.** A DECLARED category owns its declared
    slot — reserved whether or not it is currently drawn, which is what keeps
    its color stable when a filter removes its neighbours — and undeclared
    drawn categories fill the slots no declaration claimed. Past the palette,
    or with every slot spoken for, a category takes the muted fold color
    rather than wrapping onto a color someone else owns. Declare the
    categories whose colors must not move; the rest sort themselves out.
  - **Distinct categories no longer share a color.** Identity resolution mixed
    two index spaces (declared config keys vs. row position), so two
    categories could both take slot 1; past five it wrapped modulo the palette
    onto colors other categories already owned. One resolver
    (`categoryColorResolver`) now orders declared keys first and undeclared
    categories after, and anything past the palette takes the muted fold color
    rather than a duplicate. A bar chart's measure entry is excluded from that
    order — it labels the value column and is not a category.
  - **`--chart-color-<key>`, not `--color-<key>`.** The old name shares a
    namespace with Tailwind's own color tokens, so a series called `white` or
    `primary` could repaint utilities inside the chart.
  - **An undeclared series stays visible.** `seriesVar` takes a fallback, so a
    key with no config renders its palette slot instead of falling through an
    undefined custom property to black.
  - Duplicate category values render without React key collisions; `Infinity`
    and `NaN` no longer reach the screen as `▲ ∞%` styled _good_, `NaN%`, or a
    `"NaN"` stat value; `maxBars={NaN}` no longer collapses a chart into one
    bucket; `ChartCard`'s tooltip loses its empty header row.

  Tests grew with the fixes, and closed gaps the review demonstrated: the
  whole `formatBucketLabel` formatter was passing assertions that the identity
  function also passed, the responsive render path (the one every real
  consumer uses) was never mounted, no test asserted a series color reaches a
  mark, and `chart-card.tsx` had no tests at all.

### Patch Changes

- @iloveagents/foundry-agent@0.24.0
- @iloveagents/foundry-web-primitives@0.24.0

## 0.23.0

### Minor Changes

- c580d35: A chart family, sibling to the DataTable family — imported from the new
  `@iloveagents/foundry-web-ui/chart` subpath (same reasoning as
  `foundry-agent/msal`): charts are an optional tier, recharts is a real
  dependency, and a host that never draws one keeps it out of its module
  graph entirely. The family: `ChartContainer` /
  `ChartTooltipContent` / `ChartLegendContent` (the shadcn-style layer over
  recharts), declarative `TimeSeriesChart` / `CategoryBarChart` / `DonutChart`,
  and the dashboard anatomy around them — `StatCard` (KPI tile with a
  trend badge), `ChartCard`, `DashboardGrid`/`DashboardTile`.

  Dashboards were the one surface hosts still hand-rolled: KPI tiles from bare
  divs, bar charts from width-percentage flexboxes with `color-mix` — every
  consumer re-inventing tooltip, legend, palette, and dark-mode behavior, and
  none of it themeable. The theme runtime has carried five categorical slots
  (`--chart-1..5`, light and dark, tenant-overridable) since its first release;
  nothing in the library ever drew with them.

  The layering mirrors the data-table split deliberately: `chart-config.ts`
  owns semantics (a `ChartConfig` names each series once; colors resolve from
  the declared order into the theme slots, so identity follows the series and a
  filter never repaints the survivors), `chart.tsx` owns what is drawn.
  Discipline the components enforce rather than document: a sixth category is
  folded into "Other" (`foldCategoryTail`, `DonutChart.maxSlices`,
  `CategoryBarChart.maxBars`), never a sixth color; the hover layer is on by
  default; a single series gets no legend box; one y-axis, always.

  recharts (^3) enters `dependencies` exactly the way `@tanstack/react-table`
  did for tables. Nothing existing moves: every export is additive, and the
  five chart slots keep their meaning for themes that predate this release.

### Patch Changes

- @iloveagents/foundry-agent@0.23.0
- @iloveagents/foundry-web-primitives@0.23.0

## 0.22.0

### Minor Changes

- 9c434f3: Add a `sidebarIcon` theme slot

  The sidebar's idle-row icons were hardcoded to `text-sidebar-foreground/60`,
  so the only way to colour them from a theme was `sidebarForeground` — which is
  the LABEL colour. Reaching the icons through it turned every sidebar label the
  brand colour too, which is why a brand whose mark is a colour could not match
  its own product.

  `sidebar.sidebarIcon` colours those icons on their own, in the expanded rows
  and the collapsed rail alike. Unset, it resolves to the previous value (the
  label colour at 60%), so no existing theme moves. Active rows keep using
  `primary`, so the active/idle distinction the component encodes is untouched.

- 9c434f3: Let a theme set the brand mark's height (`branding.logoHeight`)

  The lockup pinned every mark to 20px. That is fine for an icon and wrong for
  a wordmark that carries a tagline under the name — a common wordmark shape —
  where 20px turns the tagline into a smear and the whole lockup reads as
  undersized beside the product name. The tenant supplying the asset is the only
  one who knows how much height it needs.

  `branding.logoHeight` takes a CSS length (`"2rem"`, `"32px"`); unset keeps the
  previous 20px, so no existing theme changes. Setting it also lifts the
  max-width guard, since a taller mark is proportionally wider and the old 7rem
  cap would letterbox exactly the marks that asked for more room.

  The value reaches an inline style and themes are tenant-authored, so it is
  allowlisted to a plain non-negative length in px/rem/em. Anything else —
  `calc()`, `var()`, a url, a second declaration behind a `;` — is ignored in
  favour of the default.

### Patch Changes

- @iloveagents/foundry-agent@0.22.0
- @iloveagents/foundry-web-primitives@0.22.0

## 0.21.1

### Patch Changes

- f61f4cd: `DataTableToolbar`: a selection bar now takes toolbar space in the
  non-stacked layout too, instead of adding a row. A list with no facets grew
  by one row the moment the first row was ticked, shoving the table down under
  the cursor mid-click — the jump the stacked layout already avoided by
  swapping its filter row for the selection bar. Search stays put in both
  layouts; only the filter controls give way.
- a0d2401: Theme variables now reach portalled UI. `ThemeScope` put them on a div, but
  Radix portals mount into `document.body` — outside it — so dropdowns,
  popovers, selects and tooltips fell back to `:root` and rendered in the base
  preset while the page around them wore the customer's theme. The outermost
  scope now publishes to the document element as well; nested scopes keep the
  div only, so a subtree can still be themed differently without repainting
  the page when it mounts.
  - @iloveagents/foundry-agent@0.21.1
  - @iloveagents/foundry-web-primitives@0.21.1

## 0.21.0

### Minor Changes

- 8132205: Add two host-injectable seams that nothing in this package uses on its own.

  `registerVoiceAdapter()` / `registerSpeechAdapter()` (mirroring `registerAttachmentAdapter`) let a
  host supply assistant-ui's `RealtimeVoiceAdapter` and `SpeechSynthesisAdapter`; the AG-UI runtime
  provider passes them through to `useLocalRuntime` only when registered, so a runtime without them
  is byte-for-byte the runtime that existed before and assistant-ui keeps reporting the capability as
  unavailable.

  `registerChatSlots({ composerActions })` adds a third chat slot, rendered in the trailing control
  row of both the full composer and the floating bubble — for controls that are an alternative _way
  to send_ rather than content about the thread.

- eaecd13: New `threadSurface` chat slot: a module can render _instead of_ the message
  viewport, for a mode that replaces the conversation rather than adding to it.
  A live voice call is the case it exists for — while you are talking, the
  transcript scrolling past is not what you are looking at, and "How can I help
  you today?" is the wrong question once the answer is "say it out loud".

  Unlike the other slots it is set and cleared at runtime: registering the
  component IS the takeover, clearing it hands the thread back, so there is no
  second "is it active" flag to keep in step. The thread is hidden rather than
  unmounted, so its scroll position and any in-flight run survive the round trip.

- 908023d: Rework the composer: one row, one "+", and a corner that Send can hand over.

  The leading controls were a row of single-purpose icons that grew every time
  the product learned a trick, and each one cost the user a guess. They are now
  one `ComposerAddMenu` — a labelled menu holding Attach file and Pin this page.
  Pinning in particular is a power feature that did not deserve permanent
  residency next to the text field; `ContextPins` still shows what _is_ pinned.

  The composer is a single row when it has the width for one and two rows when
  it does not, decided by wrapping rather than a breakpoint: the input keeps
  `w-full` while narrow, which pushes it onto its own line and leaves `+` and
  the trailing controls below it. The old always-two-rows layout existed to stop
  controls floating mid-height beside tall wrapped text — that only ever happened
  narrow, which still gets two rows.

  `registerChatSlots({ composerActionsReplaceSend: true })` lets a module's
  `composerActions` stand in for Send while the composer is empty, so a voice
  button can hold the corner until there is something to send. Opt-in: a slot
  holding something unrelated must not make Send disappear. Exposed as
  `useComposerActionsOwnSend()`.

  Placeholder default is now `DEFAULT_COMPOSER_PLACEHOLDER` ("Ask anything") and
  overridable via `<ChatContent placeholder>`. "Message Assistant..." named the
  machine and told the user nothing.

  Also exports `usePagePin()`, so the pin badge and the add-menu cannot drift
  apart on what "pinned" means.

### Patch Changes

- c1fa592: Don't send the user's draft with a submitted turn.

  `ComposerSubmitBridge` sends through the ordinary composer, and the composer
  stays editable while a module is using it. A voice call is the case: the
  transcript replaced a half-written message and sent it. The text is saved and
  restored around the send.

  Attachments are deliberately NOT preserved. There is no way to send without
  them, so preserving them means lifting them out and adding them back —
  asynchronous work through a host adapter, which produced four distinct defects
  in short order (a cancellation check that dropped them, two turns interleaving
  their save/restore, a stalled upload wedging every later turn, and a timed-out
  operation landing on a later turn). Keeping this synchronous is what makes it
  easy to be sure about, so a file attached but not yet sent still goes with the
  spoken turn, as it did before. Worth revisiting if the composer grows a way to
  send without attachments.

- 88004d2: A registered `threadSurface` now owns the whole viewport, scroll controls
  included.

  The transcript underneath keeps its scroll position — deliberate, so it comes
  back untouched — but its scroll-to-bottom button stayed mounted, carried the
  same `z-10` as the surface overlay, and rendered after it. DOM order put a
  chevron on top of whatever the surface was showing, and clicking it scrolled a
  viewport nobody could see. Both composers suppress it while a surface is set.

- 27c6414: Make the floating chat bubble a full peer of the expanded chat.

  `ChatBubble` renders a registered `threadSurface`, which only `ChatContent` did
  before. Since the bubble also carries the composer action slots, a module could
  be STARTED there and then ran with the ordinary transcript on screen — while
  the module, seeing its surface registered, correctly stood its own UI down.
  `composer-surface-parity.test.ts` now guards the general shape, because a
  capability added to one composer and forgotten in the other is the recurring
  failure rather than this one instance of it.

  `ComposerSubmitBridge` is also mounted for the whole life of the bubble instead
  of only while the panel is open. A module can keep working after the panel
  closes — a voice call does exactly that — and its submitted text was landing in
  the pending store with nothing left mounted to send it, each new submission
  overwriting the last. Because that makes several bridges legitimately mountable
  at once, the store now hands out an atomic claim so exactly one sends, which
  also closes a StrictMode double-send.
  - @iloveagents/foundry-agent@0.21.0
  - @iloveagents/foundry-web-primitives@0.21.0

## 0.20.1

### Patch Changes

- Updated dependencies [c1bd1c1]
  - @iloveagents/foundry-web-primitives@0.20.1
  - @iloveagents/foundry-agent@0.20.1

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
