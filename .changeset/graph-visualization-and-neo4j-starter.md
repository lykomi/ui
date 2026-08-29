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
