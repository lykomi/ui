`@iloveagents/foundry-web-graph` — the graph visualization package. A force-directed `GraphView`, a source-neutral payload contract, and an optional assistant-ui card + panel renderer.

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
- **Sibling `@iloveagents/foundry-*` deps go in `dependencies` with `workspace:^`, never `peerDependencies`** — see the changesets `shouldBumpMajor` cascade note in the root `AGENTS.md`.
- **The tooltip must return an `HTMLElement`, never a string.** `force-graph`'s tooltip assigns a string via `innerHTML` (`float-tooltip` calls d3's `.html()`), and captions come out of a database. `graph-tooltip.ts` builds DOM with `textContent`. Do not "simplify" it into a template literal.

# The panel is a workspace, and that shapes the API

- **A result about what is on screen is folded into what is on screen.** `mergeIntoOpenGraph` runs from the tool card and merges when the new payload SHARES a node id with the open graph — that overlap is the evidence the two are about the same thing. Without it an unrelated query grafts itself onto someone's workspace; with it, expanding a node and watching a write land both read as the graph growing.
- **That is also why it is not the model's job.** Asking the agent to call `graph_show` after every read makes the main interaction depend on it remembering, and puts two tool calls in one turn — which is where the AG-UI client-tool replay gets into trouble (a duplicate `TOOL_CALL_START`, seen live). One tool call per turn, and the panel keeps itself current.
- **`graph_show` updates in place.** It calls `setContent` when a graph panel is already open rather than `openPanel`, because this is the same workspace changing. The renderer instance is reused and `reconcileGraphModel` keeps positions by node id, so a refined query reads as a change.
- **Expansion goes through the conversation.** The panel cannot query — the Cypher tools are server-side — so a double-click submits a chat turn naming the node and its id. The turn is visible, and the answer merges. `GraphView` itself still just takes `onExpandNode`; it never queries anything.
- **The drawer is not modal.** No scrim, no click-catcher, `pointer-events-none` on the overlay and `auto` on the drawer. A greyed-out graph you cannot click, pan, or zoom is the opposite of what an inspector is for.
- **Framing knows what is covered.** `insetRight` tells the canvas how much of its right edge the drawer takes, and `graph_select_node` calls `reveal`, not `centerOn`: the smallest pan that brings a node clear, and none if it is already visible. Both are deferred a frame, because the selection that opens the drawer has not rendered yet when the caller frames.

# Things that look like details and are not

- **Node object identity is the layout.** force-graph writes `x`/`y`/`vx`/`vy` onto the node objects it is given. `reconcileGraphModel` reuses the object for any id it has seen, so an unrelated re-render — a hover, a search keystroke — does not throw away every position and re-settle the graph. `payload.nodes.map(...)` inside the render is the bug this exists to prevent.
- **Capping picks the connected core, not a prefix.** `selectConnectedCore` seeds at the biggest hub and expands through neighbours. Ranking by degree alone is not enough: on a bipartite-ish graph the hubs are all on one side and none are adjacent, so a small cap yields zero edges (measured: top-5-by-degree on an 8-film demo graph gave five films and no relationships). It is mirrored by `select_connected_core` in the `neo4j` starter preset's `graph_payload.py` — both sides cap, so both must agree on what the important part of a graph is.
- **Canvas cannot read CSS variables.** `resolveGraphTheme` reads tokens off a mounted element with `getComputedStyle`, and `useGraphTheme` re-reads them when a `class` or `data-theme` attribute changes anywhere up the tree. Watching only the container is not enough — the theme class usually sits on `<html>`.
- **`GraphPayload.error` is declared `never`.** The AG-UI runner marks a tool call failed when the parsed result has a top-level `error` key, so a payload using one for partial trouble would render red however good the data was.
- **`react-force-graph-2d` has no double-click event.** Expand-on-double-click is reconstructed in `graph-canvas.tsx` from click timing, because that is the gesture people bring from other graph explorers.
- **Its `onEngineTick` / `onEngineStop` callbacks do not fire through the React wrapper.** Verified in a browser: the imperative `zoomToFit` works, the callbacks never run. Anything hung off them silently never happens, which is why the framing loop in `graph-canvas.tsx` is a React interval.
- **`onRenderFramePre` DOES fire, though.** Also verified in a browser, because the two facts above make it the kind of thing nobody would assume. It is what drives caption placement: the layout settling, a pan, a zoom and a node being dragged all show up as a rendered frame, and no other signal reports all four.
- **Label colours are hashed, not assigned in first-seen order.** Colour has to mean the same thing across queries or the legend must be re-read every time; first-seen order made `Person` blue in one result and red in the next. Linear probing keeps them distinct within one graph.
- **Captions are placed, not ranked.** Choosing them by rank — top N by degree, or everything above some zoom — is position-blind, and in a force layout the important nodes are exactly the ones that end up next to each other, so their labels overprint. `caption-placement.ts` walks candidates in priority order (selected and hovered first, then search hits, then by degree) and keeps the ones whose label rectangle is still free. Density then handles itself, and two magic numbers went away with it.
- **Caption widths are measured once per string, not per frame.** `paintNode` sets the font in GRAPH units (`11 / globalScale`), which is a constant 11 pixels on screen at every zoom — so a caption's rendered width never changes.
- **The panel fills its box with `absolute inset-0`, not `h-full`.** The tool panel's content wrapper is a scroll container, so a percentage height resolves against the content box and the canvas grows past the fold.
- **`graphWorkspaceStore.disconnect` checks handle identity.** React mounts a replacement panel before unmounting the old one, so a stale cleanup would otherwise blank the live workspace.
- **A change callback fires when the value changes.** Hosts pass `onSelectionChange` as an inline arrow, so an effect listing it as a dependency runs every render. Harmless until a listener writes a store the host reads — then the notification causes the render that causes the notification. Selecting a node deadlocked the panel with "Maximum update depth exceeded" exactly this way.
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
