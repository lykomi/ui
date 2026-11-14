`@lykomi/web-graph` — the graph visualization package. A force-directed `GraphView`, a source-neutral payload contract, and an optional assistant-ui card + panel renderer.

# Entry points, and why they are split

| Entry              | Contains                                                                                          | Extra cost to the consumer            |
| ------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `.`                | `GraphView` and everything it needs, the payload contract                                         | `react-force-graph-2d`                |
| `./adapters/neo4j` | Driver records -> payload                                                                         | nothing                               |
| `./assistant-ui`   | `makeGraphToolUI`, `registerGraphPanelRenderer`, `registerGraphClientTools`, `mergeIntoOpenGraph` | `@assistant-ui/react` (optional peer) |
| `./styles.css`     | The `--graph-1..8` palette                                                                        | nothing                               |

The split is the point. A dashboard that only draws a graph must not load the chat runtime, and a host that only wants the payload types must not load the force engine.

# Non-negotiable rules

- **`react-force-graph-2d` is imported by `graph-canvas.tsx` and nowhere else.** It is loaded through `React.lazy`, so the engine and the d3 force/zoom/drag stack stay out of the bundle until a graph is actually rendered. A guard test enforces the single import site.
- **Nothing outside `adapters/` may mention Neo4j.** The visualizer is source-neutral or it is not reusable. A guard test enforces this too.
- **`web-ui` must never depend on this package.** The dependency runs one way — `web-graph` -> `web-ui` — or `react-force-graph-2d` lands in the install of every consumer that only wants a chat. Encoded in `OPEN_CORE_GRAPH` in `packages/web-ui/src/__tests__/open-core-guards.test.ts`.
- **Sibling `@lykomi/*` deps go in `dependencies` with `workspace:^`, never `peerDependencies`** — see the changesets `shouldBumpMajor` cascade note in the root `AGENTS.md`.
- **The tooltip must return an `HTMLElement`, never a string.** `force-graph`'s tooltip assigns a string via `innerHTML` (`float-tooltip` calls d3's `.html()`), and captions come out of a database. `graph-tooltip.ts` builds DOM with `textContent`. Do not "simplify" it into a template literal.

# The panel is a workspace, and that shapes the API

- **A result about what is on screen is folded into what is on screen.** `mergeIntoOpenGraph` runs from the tool card and merges when the new payload SHARES a node id with the open graph — that overlap is the evidence the two are about the same thing. Without it an unrelated query grafts itself onto someone's workspace; with it, expanding a node and watching a write land both read as the graph growing.
- **The merge is a headless watcher, not a side effect of the card.** `GraphResultSeeder` reads the thread's own parts. It has to be: the card lives inside the turn's collapsed "Worked · 3 tools" strip, which does not mount until the reader expands it — so a merge hung off rendering never ran. Seen live: the agent named four new relationships and the panel stayed at three nodes, with nothing reporting a failure. Same failure, same shape and same answer as `CitationSeeder`/`TaskSeeder` in `@ltwlf/spaces-web-ui` (ltwlf/lastspace#650). Force-mounting the strip instead was tried and rejected — it makes a disclosure's contents cost something in every transcript, and replays every historical result on a reopened chat.
- **Binding a card is what makes a tool graph-shaped.** `makeGraphToolUI` registers the tool name, `extract` and `panelTitle` in `graph-tool-registry.ts`; the watcher reads that. A graph-returning tool with no card is a tool nothing reads — the Neo4j preset shipped `graph_expand_node` and `graph_write_cypher` that way. One registration, not two, so there is nothing separate to forget.
- **The watcher takes a baseline, and takes it late.** Only results appearing after the thread has settled are acted on, or reopening a saved conversation would throw its last graph over whatever the user was doing. The baseline is taken on the first NON-EMPTY view (a resumed thread mounts empty and fills in later, so an early baseline makes the whole history look new) and re-taken when the thread identity changes.
- **A deferral needs a reason knowable WITHOUT the payload.** A result waits
  when no valid merge target exists yet — the panel is closed, or what is open
  is not a graph. Both are decidable from the panel alone, so nothing is
  consumed and nothing is retried. A merge that ran and returned `false` is a
  DECISION and counts as handled, even though that means a result deferred for
  graph A is spent if the user opens unrelated graph B first. That case is
  known and left alone: "unrelated result" and "right result, wrong graph" are
  the same signal — a rejected overlap — so telling them apart would mean
  retaining every rejected result and re-attempting it on each panel change,
  i.e. an unbounded queue and a re-attempt loop, to save something the tool
  card's "Open in panel" action already recovers.
- **That is also why it is not the model's job.** Asking the agent to call `graph_show` after every read makes the main interaction depend on it remembering, and puts two tool calls in one turn — which is where the AG-UI client-tool replay gets into trouble (a duplicate `TOOL_CALL_START`, seen live). One tool call per turn, and the panel keeps itself current.
- **`graph_show` updates in place.** It calls `setContent` when a graph panel is already open rather than `openPanel`, because this is the same workspace changing. The renderer instance is reused and `reconcileGraphModel` keeps positions by node id, so a refined query reads as a change.
- **Expansion goes through the conversation.** The panel cannot query — the Cypher tools are server-side — so a double-click submits a chat turn naming the node and its id. The turn is visible, and the answer merges. `GraphView` itself still just takes `onExpandNode`; it never queries anything.
- **The drawer is not modal.** No scrim, no click-catcher, `pointer-events-none` on the overlay and `auto` on the drawer. A greyed-out graph you cannot click, pan, or zoom is the opposite of what an inspector is for.
- **Framing knows what is covered.** `insetRight` tells the canvas how much of its right edge the drawer takes, and `graph_select_node` calls `reveal`, not `centerOn`: the smallest pan that brings a node clear, and none if it is already visible. Both are deferred a frame, because the selection that opens the drawer has not rendered yet when the caller frames. Every fit goes through `fit()` for the same reason — `zoomToFit` alone frames into the whole canvas, so a merge (which changes the model and restarts the fit loop) would settle the graph back under the drawer and undo the reveal that had just cleared it. `fit()` reads the inset from a ref, so opening the drawer does NOT restart the loop: the click that means "tell me about this node" must not re-frame the graph the user arranged.

# Things that look like details and are not

- **Node object identity is the layout.** force-graph writes `x`/`y`/`vx`/`vy` onto the node objects it is given. `reconcileGraphModel` reuses the object for any id it has seen, so an unrelated re-render — a hover, a search keystroke — does not throw away every position and re-settle the graph. `payload.nodes.map(...)` inside the render is the bug this exists to prevent.
- **Capping picks the connected core, not a prefix.** `selectConnectedCore` seeds at the biggest hub and expands through neighbours. Ranking by degree alone is not enough: on a bipartite-ish graph the hubs are all on one side and none are adjacent, so a small cap yields zero edges (measured: top-5-by-degree on an 8-film demo graph gave five films and no relationships). It is mirrored by `select_connected_core` in the `neo4j` starter preset's `graph_payload.py` — both sides cap, so both must agree on what the important part of a graph is.
- **Canvas cannot read CSS variables.** `resolveGraphTheme` reads tokens off a mounted element with `getComputedStyle`, and `useGraphTheme` re-reads them when a `class` or `data-theme` attribute changes anywhere up the tree. Watching only the container is not enough — the theme class usually sits on `<html>`.
- **`GraphPayload.error` is declared `never`.** The AG-UI runner marks a tool call failed when the parsed result has a top-level `error` key, so a payload using one for partial trouble would render red however good the data was.
- **`react-force-graph-2d` has no double-click event.** Expand-on-double-click is reconstructed in `graph-canvas.tsx` from click timing, because that is the gesture people bring from other graph explorers.
- **Its `onEngineTick` / `onEngineStop` callbacks do not fire through the React wrapper.** Verified in a browser: the imperative `zoomToFit` works, the callbacks never run. Anything hung off them silently never happens, which is why the framing loop in `graph-canvas.tsx` is a React interval.
- **`onRenderFramePre` DOES fire, though.** Also verified in a browser, because the two facts above make it the kind of thing nobody would assume. It is what drives caption placement: the layout settling, a pan, a zoom and a node being dragged all show up as a rendered frame, and no other signal reports all four.
- **Label colours are hashed, not assigned in first-seen order.** First-seen order made `Person` blue in one result and red in the next — a colour should not depend on which row the producer happened to return first. Linear probing then keeps two labels that hash to the same slot distinct, which with eight colours and a handful of labels is likelier than not. The trade-off is real and unavoidable at a fixed palette size: probing makes a label's colour depend on which OTHER labels are present, so it can change between queries and even mid-session as a merge grows the graph. Distinctness within one graph wins, because a swatch is only ever read beside the label's own name.
- **Captions are placed, not ranked.** Choosing them by rank — top N by degree, or everything above some zoom — is position-blind, and in a force layout the important nodes are exactly the ones that end up next to each other, so their labels overprint. `caption-placement.ts` walks candidates in priority order (selected and hovered first, then search hits, then by degree) and keeps the ones whose label rectangle is still free. Density then handles itself, and two magic numbers went away with it.
- **Hiding a label hides its relationships too.** `nodeVisibility` alone leaves the links drawn, so filtering a type out of the legend left arrows pointing at nothing — which reads as missing nodes rather than as a filter working. `linkVisibility` has to agree with it.
- **Caption widths are measured once per string, not per frame.** `paintNode` sets the font in GRAPH units (`11 / globalScale`), which is a constant 11 pixels on screen at every zoom — so a caption's rendered width never changes.
- **The panel fills its box with `absolute inset-0`, not `h-full`.** The tool panel's content wrapper is a scroll container, so a percentage height resolves against the content box and the canvas grows past the fold.
- **Closing the tool panel does not unmount it.** It slides away with `translate-x-full` and stays in the tree, so `GraphPanel` reads `isOpen` to decide when to connect and when to take the selected node out of the chat context. Tying either to unmount left the agent describing a graph the user had closed.
- **Freezing is engine state, not a React `Set`.** force-graph reads `fx`/`fy` off the node objects; `pinnedIds` is only what the UI draws. An effect reconciles the two in both directions — otherwise Freeze marked a node that carried on drifting, and Unpin All cleared the markers while leaving every dragged node nailed down.
- **The canvas is opaque to assistive technology.** `GraphTable` is the readable form, and it is reachable from the toolbar rather than mounted alongside — a capped graph is still 1,500 rows nobody asked for. The canvas region carries `role="img"` and a label that says so.
- **`graphWorkspaceStore.disconnect` checks handle identity.** React mounts a replacement panel before unmounting the old one, so a stale cleanup would otherwise blank the live workspace.
- **A legend filter is a view toggle, not a deletion.** Hiding a selected
  node's label does not clear the selection — the drawer stays open and its
  properties are what the user is reading, and clearing would throw away a
  choice one click restores. But `select` refuses a hidden node (reporting
  success would open the drawer on something invisible) and `graph_get_view`
  says `selectedNodeHidden`, so the result never claims a node is both
  selected and absent from its own `nodes` list.
- **The readable table has to reach everything the canvas does.** Relationship
  rows carry a control on the type, not just text: the drawer has always
  handled edges, and without it a keyboard or screen-reader user could read
  that a relationship exists and never see one of its properties while a mouse
  user clicks the same line and gets all of them.
- **What the agent reports must be what the user sees.** `graph_get_view` counts over the DRAWN graph, not the payload: a label switched off in the legend takes its nodes and their relationships off the canvas, and the hidden labels are named in the result so the agent can say "Person is hidden" rather than quietly reporting a smaller graph than the query returned. `graph_select_node` resolves captions with `resolveCaption` and the payload's own `legend.captionKey` — the same rule the canvas paints with — or a node would be visible on screen and unselectable by the text on it.
- **A deletion cannot be merged.** Merging adds and updates; there is no row for a node that no longer exists, and nothing on the client can know which ids went. `graph_write_cypher` therefore marks a deleting write `view_stale` and tells the agent to re-read and `graph_show` WITHOUT merge. Treating an empty write payload as "no change" is what would leave the panel drawing a node the database no longer has.
- **Displaying a value and comparing two are different jobs.** `safeStringify`
  is the DISPLAY and transport form — the panel's Copy button, the card's raw
  result, the tool results the agent reads — and it renders a `bigint` as its
  decimal string, which is lossy and right: a reader wants `10`. `deepEqual` is
  the COMPARISON form, and it does not serialise at all. Three review rounds
  found three collisions trying to serve both from one string: `10n` as `"10"`
  collides with the string `"10"`, as `"10n"` with `"10n"`, as
  `{__bigint:"10"}` with a property that IS that object. `properties` is
  `unknown`, so every encoding can be imitated by data shaped like the
  encoding; comparing types has nothing to imitate. Do not merge them back
  together, and do not reach for a fourth tag.
- **A repeat is not a cycle.** Both functions track only the ANCESTORS of the
  value in hand — `safeStringify` by walking the container chain `JSON.stringify`
  binds as `this`, `deepEqual` by remembering PAIRS. A single visited-set calls
  the second sighting of a shared object circular, and two nodes sharing one
  `properties` object is ordinary for a hand-built payload or a browser-side
  adapter: values differing only there compared equal, and the panel\'s copied
  content and the tool results the agent reads carried a literal `"[circular]"`
  where real data belonged.
- **Enumerable keys only describe a PLAIN object.** `deepEqual` compares a
  `Date` by its time and treats every other exotic object as unequal unless
  identical. Comparing key sets said two different dates were the same value —
  and a missed change loses data silently, where a spurious one costs a
  redundant update.
- **`stats` means totals BEFORE truncation, so a merge can rarely state it.**
  With nothing capped, the union's retained counts are those totals. Once
  either producer truncated, the union's real total is not derivable here at
  all — each side knows its own pre-cap count, and how far the two full sets
  overlap is exactly what the capped rows would have said. `mergeGraphPayloads`
  omits the field there rather than passing retained counts off as totals;
  `truncated` carries the signal on its own.
- **The handle is ONE object for the life of the view.** `GraphPanel` stores
  `handleRef.current` in the workspace when it connects, and reconnects only on
  a payload, title or visibility change — so a `useImperativeHandle` whose
  dependency list includes the view state (`useGraphViewState` returns a fresh
  object literal every render, so that means _every_ render) leaves the
  workspace, and every client tool through it, holding a closure over the view
  as it was when the panel opened. `graph_get_view` answered without the search
  the user had since typed. Nothing surfaced it, because a merge changes the
  payload and so happens to reconnect. The deps are `[]` and the methods read a
  `live` ref, refreshed each render.
- **Keys that come from the payload are untrusted.** Labels and relationship
  types are whatever the producer called them, and a graph may perfectly well
  have a label named `constructor` or `toString`. `counts[label]`,
  `overrides?.[label]` and `captionKeys[label]` on an object literal then find
  an inherited function instead of reporting the key absent — a legend chip
  showing a stringified function, a caption key that is a method. Accumulate
  into a `Map`, and read with `hasOwn` (in `model.ts`, because the repo targets
  ES2020 and `Object.hasOwn` is not available).
- **A pin is an id, and an id outlives its node.** `pinnedIds` is pruned
  against the incoming payload on every reconciliation. Left alone, `graph_show`
  replacing the graph kept a pin nothing shows — and a LATER graph carrying the
  same id got that node frozen on arrival, by a pin made for a different graph.
- **A change callback fires when the value changes.** Hosts pass `onSelectionChange` as an inline arrow, so an effect listing it as a dependency runs every render. Harmless until a listener writes a store the host reads — then the notification causes the render that causes the notification. Selecting a node deadlocked the panel with "Maximum update depth exceeded" exactly this way.
- **…and identity is not the value.** `reconcileGraphModel` refreshes a node's `labels`/`caption`/`properties` IN PLACE so the simulation keeps its position, so after a merge the selected node is the same object with different data. An identity check therefore said "unchanged", the drawer showed the new values, and the chat context — which snapshots `properties` — kept answering from the old ones. The guard compares the VALUE, with `deepEqual`.
- **The drawer slides with a CSS keyframe, not a mount effect.** The obvious version (mount at `translate-x-full`, flip in an effect) needs a state write per selection change, and a selection change is what re-renders the graph around it.

# Layout

```text
model.ts                 contract, guards, coercion, caption resolution   (no React)
adapters/neo4j.ts        driver records -> payload                        (no React)
theme.ts                 design tokens -> canvas colours
use-graph-theme.ts       re-resolve on theme change
use-graph-model.ts       reconciliation + connected-core capping (pure fn + hook)
use-graph-styling.ts     label -> colour / caption / size
use-graph-view-state.ts  selection, hover, search, legend filter, pins
use-element-size.ts      ResizeObserver; the canvas needs numeric width/height
graph-view.tsx           composition; lazy-loads the engine
graph-canvas.tsx         the only react-force-graph-2d import site
graph-canvas-paint.ts    canvas painters (pure)
graph-tooltip.ts         DOM tooltips — see the XSS note above
graph-{legend,inspector,toolbar,table,notice}.tsx   chrome
graph-workspace.ts       the live panel as shared agent/user state (vanilla zustand)
assistant-ui/            tool card, provenance body, panel renderer, client tools
```

# Commands

```bash
pnpm build        # tsc -> dist, then fix-dts-extensions, then cp styles.css
pnpm test:unit    # vitest
pnpm typecheck
```

The reconciliation and capping logic is pure and tested without a renderer; the canvas is not unit-tested (there is no canvas in jsdom) — `GraphView` falls back to `GraphTable` when `HTMLCanvasElement` is undefined, which is also the accessibility surface.
