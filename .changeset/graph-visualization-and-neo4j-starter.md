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

Its `/assistant-ui` entry adds the chat glue: a tool-card factory that renders
any graph-shaped tool result, a panel renderer, and four client tools
(`graph_get_view`, `graph_show`, `graph_select_node`, `graph_search`) that let
the agent work IN the open graph — read what the user has selected, put a new
result in the panel keeping the positions of nodes already there, and point at
what it is describing. `/adapters/neo4j` maps driver records onto the payload.

`create-foundry-ui-app --preset neo4j` scaffolds an agent over a graph:
schema, read-only Cypher and semantic-search tools, a local database via
`pnpm graph:up && pnpm graph:seed`, and the same code against Neo4j Aura by
changing one URI. Read-only is enforced by the server's READ access mode;
the write tool is not registered at all unless the deployment opts in.

In `@iloveagents/foundry-web-ui`, `ToolPanelContent` gains `"graph"` and an
optional `data` field, `PanelRendererEntry` gains an optional `id` so
re-registering replaces rather than appends, and `ToolCallCard` accepts
`open`/`defaultOpen`/`onOpenChange` so a card with an expensive body can defer
mounting it. All additive.

Also fixes the foundry-iq preset's README, whose `__PROJECT_NAME__` title had
been rewritten to `**PROJECT_NAME**` by Prettier — every app scaffolded from
that preset shipped the corrupted title. `.prettierignore` now covers every
preset README and a test checks all of them, not just the base template.
