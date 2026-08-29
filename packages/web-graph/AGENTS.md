`@iloveagents/foundry-web-graph` — the graph visualization package. A force-directed `GraphView`, a source-neutral payload contract, and an optional assistant-ui card + panel renderer.

# Entry points, and why they are split

| Entry              | Contains                                                                    | Extra cost to the consumer            |
| ------------------ | --------------------------------------------------------------------------- | ------------------------------------- |
| `.`                | `GraphView` and everything it needs, the payload contract                   | `react-force-graph-2d`                |
| `./adapters/neo4j` | Driver records -> payload                                                   | nothing                               |
| `./assistant-ui`   | `makeGraphToolUI`, `registerGraphPanelRenderer`, `registerGraphClientTools` | `@assistant-ui/react` (optional peer) |
| `./styles.css`     | The `--graph-1..8` palette                                                  | nothing                               |

The split is the point. A dashboard that only draws a graph must not load the chat runtime, and a host that only wants the payload types must not load the force engine.

# Non-negotiable rules

- **`react-force-graph-2d` is imported by `graph-canvas.tsx` and nowhere else.** It is loaded through `React.lazy`, so the engine and the d3 force/zoom/drag stack stay out of the bundle until a graph is actually rendered. A guard test enforces the single import site.
- **Nothing outside `adapters/` may mention Neo4j.** The visualizer is source-neutral or it is not reusable. A guard test enforces this too.
- **`web-ui` must never depend on this package.** The dependency runs one way — `web-graph` -> `web-ui` — or `react-force-graph-2d` lands in the install of every consumer that only wants a chat. Encoded in `OPEN_CORE_GRAPH` in `packages/web-ui/src/__tests__/open-core-guards.test.ts`.
- **Sibling `@iloveagents/foundry-*` deps go in `dependencies` with `workspace:^`, never `peerDependencies`** — see the changesets `shouldBumpMajor` cascade note in the root `AGENTS.md`.
- **The tooltip must return an `HTMLElement`, never a string.** `force-graph`'s tooltip assigns a string via `innerHTML` (`float-tooltip` calls d3's `.html()`), and captions come out of a database. `graph-tooltip.ts` builds DOM with `textContent`. Do not "simplify" it into a template literal.

# Things that look like details and are not

- **Node object identity is the layout.** force-graph writes `x`/`y`/`vx`/`vy` onto the node objects it is given. `reconcileGraphModel` reuses the object for any id it has seen, so an unrelated re-render — a hover, a search keystroke — does not throw away every position and re-settle the graph. `payload.nodes.map(...)` inside the render is the bug this exists to prevent.
- **Capping picks the connected core, not a prefix.** `selectConnectedCore` seeds at the biggest hub and expands through neighbours. Ranking by degree alone is not enough: on a bipartite-ish graph the hubs are all on one side and none are adjacent, so a small cap yields zero edges (measured: top-5-by-degree on an 8-film demo graph gave five films and no relationships). It is mirrored by `select_connected_core` in the `neo4j` starter preset's `graph_payload.py` — both sides cap, so both must agree on what the important part of a graph is.
- **Canvas cannot read CSS variables.** `resolveGraphTheme` reads tokens off a mounted element with `getComputedStyle`, and `useGraphTheme` re-reads them when a `class` or `data-theme` attribute changes anywhere up the tree. Watching only the container is not enough — the theme class usually sits on `<html>`.
- **`GraphPayload.error` is declared `never`.** The AG-UI runner marks a tool call failed when the parsed result has a top-level `error` key, so a payload using one for partial trouble would render red however good the data was.
- **`react-force-graph-2d` has no double-click event.** Expand-on-double-click is reconstructed in `graph-canvas.tsx` from click timing, because that is the gesture people bring from other graph explorers.
- **Its `onEngineTick` / `onEngineStop` callbacks do not fire through the React wrapper.** Verified in a browser: the imperative `zoomToFit` works, the callbacks never run. Anything hung off them silently never happens, which is why the framing loop in `graph-canvas.tsx` is a React interval.
- **Label colours are hashed, not assigned in first-seen order.** Colour has to mean the same thing across queries or the legend must be re-read every time; first-seen order made `Person` blue in one result and red in the next. Linear probing keeps them distinct within one graph.
- **Captions are budgeted per node, not gated by one zoom threshold.** A single threshold forces a choice between an unreadable smear in dense clusters and an anonymous constellation when zoomed out.
- **The panel fills its box with `absolute inset-0`, not `h-full`.** The tool panel's content wrapper is a scroll container, so a percentage height resolves against the content box and the canvas grows past the fold.
- **`graphWorkspaceStore.disconnect` checks handle identity.** React mounts a replacement panel before unmounting the old one, so a stale cleanup would otherwise blank the live workspace.

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
