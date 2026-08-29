---
"@iloveagents/foundry-web-graph": minor
"@iloveagents/foundry-web-ui": minor
"create-foundry-ui-app": minor
---

Graph visualization, and a Neo4j starter that turns the side panel into a workspace

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
