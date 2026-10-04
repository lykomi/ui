# @iloveagents/foundry-web-graph

## 0.3.1

### Patch Changes

- fc469ea: Graph hover card follows the theme: an opaque `--popover` surface with `--popover-foreground` text, a muted kind line, a bold title and label/value rows. float-tooltip's injected translucent black sheet no longer wins the cascade, and the card carries no inline colours. The card follows the cursor and so cannot be clicked: in the full view its link rows stay out of it, and it ends with "Click for details", since the drawer a click opens carries the working links. An inline graph, with no drawer, keeps those rows as text and promises no click.

## 0.3.0

### Minor Changes

- 37b72d1: Graph nodes and edges can carry what people should read about them.
  - `GraphEdge.caption` — what the edge says, such as "replaces 9.1" — is drawn on the canvas, in the inspector and in the table in place of the relationship type, which still groups and filters it.
  - `details` on a node or edge — label, value, optional `href` — are shown first in the inspector, with links opening in a new tab (`http(s)` or same-origin paths only; `safeHref`). The raw properties and secondary labels move into a collapsed "Advanced" section. The hover shows the details instead of the first raw properties.

  Payloads without captions or details render exactly as before.
  - A detail's link that is the app's own address (`spaces://…`) is followed in place when the host registered a link handler that claims it (`linkStore`), so the app opens it in its own tab rather than a browser tab (`graphLink`).
  - A legend hint can carry a `name` — what people read for a label — shown in the legend, the inspector and the hover; the label itself still filters and queries.
  - An edge can carry an `emphasis` (`strong` | `muted`): strong edges are drawn in the accent, thicker, with a larger arrow and a stronger label; muted ones recede. Edge labels sit on a small plate and are larger.
  - A layout switcher in the toolbar: force, hierarchy (top-down), left to right and radial. A graph with a cycle falls back to force and says so.
  - Zooming by hand goes to 8x; framing (zoom to fit) stays capped at 2.2x so a small graph still looks small.
  - A frozen node is marked with a dashed ring instead of a dot on its rim.
  - Expanding without the agent: a host that can read its graph registers an expander (`registerGraphExpander` in `/assistant-ui`). "Expand" then loads the neighbours directly and merges them into the open graph, and the inspector offers "Ask AI" for the agent's take. With no expander, Expand asks the agent as before.

## 0.2.11

### Patch Changes

- Updated dependencies [ef38375]
  - @iloveagents/foundry-web-ui@0.35.0
  - @iloveagents/foundry-agent@0.35.0
  - @iloveagents/foundry-web-primitives@0.35.0

## 0.2.10

### Patch Changes

- Updated dependencies [9d32ad7]
- Updated dependencies [797920a]
  - @iloveagents/foundry-agent@0.34.0
  - @iloveagents/foundry-web-ui@0.34.0
  - @iloveagents/foundry-web-primitives@0.34.0

## 0.2.9

### Patch Changes

- c35f58b: Keep graph pan and zoom stable while chat output streams, stop automatic framing after direct canvas interaction, and clarify the automatic-layout control.

## 0.2.8

### Patch Changes

- Updated dependencies [f81e285]
- Updated dependencies [d25c6e3]
  - @iloveagents/foundry-web-ui@0.33.0
  - @iloveagents/foundry-agent@0.33.0
  - @iloveagents/foundry-web-primitives@0.33.0

## 0.2.7

### Patch Changes

- Updated dependencies [e4ee172]
  - @iloveagents/foundry-web-ui@0.32.0
  - @iloveagents/foundry-agent@0.32.0
  - @iloveagents/foundry-web-primitives@0.32.0

## 0.2.6

### Patch Changes

- Updated dependencies [46fe6c1]
  - @iloveagents/foundry-web-ui@0.31.0
  - @iloveagents/foundry-agent@0.31.0
  - @iloveagents/foundry-web-primitives@0.31.0

## 0.2.5

### Patch Changes

- a8f766d: Keep running conversations alive when starting or opening another chat, expose their status in conversation history, and warn before leaving during active work. Add support ID copying and refine compact navigation spacing.

  Unify composer context in the With menu, including selected items, removable references, and pins. Preserve scoped navigation context when list filters change.

  Citation writes and clears now require the emitting conversation ID. The shell retains visited conversation configurations and supports configured conversation URLs.

  Conversation deletion handlers should call `removeChatRun(threadId)` after successful deletion to remove retained browser-session activity.

- Updated dependencies [a8f766d]
  - @iloveagents/foundry-web-ui@0.30.0
  - @iloveagents/foundry-agent@0.30.0
  - @iloveagents/foundry-web-primitives@0.30.0

## 0.2.4

### Patch Changes

- Updated dependencies [7ac54a2]
- Updated dependencies [863a2c2]
- Updated dependencies [863a2c2]
- Updated dependencies [863a2c2]
  - @iloveagents/foundry-web-ui@0.29.0
  - @iloveagents/foundry-agent@0.29.0
  - @iloveagents/foundry-web-primitives@0.29.0

## 0.2.3

### Patch Changes

- Updated dependencies [40a3137]
  - @iloveagents/foundry-web-ui@0.28.0
  - @iloveagents/foundry-agent@0.28.0
  - @iloveagents/foundry-web-primitives@0.28.0

## 0.2.2

### Patch Changes

- 64ef94c: Preserve focused renderer ownership while updating source results, keep graph context tied to visible surfaces, and improve focus-pane and pinned-context accessibility. Route client draft updates to an active form when it handles the request.
- 64ef94c: Place clearer relationship arrows outside custom node circles and allow resizing the graph details drawer.
- 64ef94c: Use the shared focus layout with collapsible chat for graph panels, include selected relationship context in chat, distinguish zoom-to-fit from fullscreen, and add spacing above graph type filters.
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
- Updated dependencies [64ef94c]
  - @iloveagents/foundry-web-ui@0.27.0
  - @iloveagents/foundry-agent@0.27.0
  - @iloveagents/foundry-web-primitives@0.27.0

## 0.2.1

### Patch Changes

- Updated dependencies [8c1093d]
  - @iloveagents/foundry-web-ui@0.26.0
  - @iloveagents/foundry-agent@0.26.0
  - @iloveagents/foundry-web-primitives@0.26.0

## 0.2.0

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

- Updated dependencies [ae6be4b]
  - @iloveagents/foundry-web-ui@0.25.0
  - @iloveagents/foundry-agent@0.25.0
  - @iloveagents/foundry-web-primitives@0.25.0
