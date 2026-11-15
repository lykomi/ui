# __PROJECT_NAME__

A LYKOMI UI starter that gives an agent a Neo4j graph: it reads the schema,
writes its own Cypher, and every result comes back as an interactive graph
rather than a wall of JSON.

Works against a local database or Neo4j Aura. Only `NEO4J_URI` differs.

## Quickstart

Two things are needed: a graph, and a chat model. The graph can be local; the
model is Azure AI Foundry either way.

```bash
cp agent/.env.example agent/.env      # fill in FOUNDRY_PROJECT_ENDPOINT + FOUNDRY_MODEL
az login                              # or set AZURE_CLIENT_ID/SECRET/TENANT_ID

pnpm graph:up                         # Neo4j in Docker, credentials already in .env.example
pnpm graph:seed                       # a small demo graph: films, the people who made them, genres
pnpm dev                              # http://localhost:8010
pnpm test:agent                       # the graph tools (live tests skip without a database)
```

Then ask it something:

- **"What's in this graph?"** — calls `graph_schema` and draws the shape of the
  data: which labels exist and how they connect.
- **"Show me everything connected to Metropolis"** — a Cypher query, rendered
  as a graph you can drag, expand and search.
- **"Which people worked on more than one film?"** — the agent writes the
  query; you see the answer and the subgraph behind it.

Browse the raw database at <http://localhost:7474> if you want to check its
work. `pnpm graph:reset` reseeds from scratch; `pnpm graph:down` stops it.

## Using Neo4j Aura instead

Create an instance at <https://console.neo4j.io>, then point `agent/.env` at it:

```bash
NEO4J_URI=neo4j+s://<instance-id>.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=<the password shown when the instance was created>
```

Nothing else changes — no code path is Aura-specific. `pnpm graph:seed` will
seed a fresh Aura instance too, if you want the same demo data there.

## Exploring the graph

Every graph-returning tool renders as a card in the chat with the node and
relationship counts. The card is **provenance**: expand it for the Cypher that
ran, the result summary and the raw payload. The graph itself goes to the side
panel — **Open in panel**, or just ask, since the agent puts results there
itself.

| Gesture              | What it does                                        |
| -------------------- | --------------------------------------------------- |
| Click a node         | Selects it and opens the property inspector         |
| Double-click a node  | Expands its neighbourhood                           |
| Drag a node          | Pins it in place — drag again to move, right-click to unpin |
| Right-click a node   | Toggles the pin                                     |
| Click a legend chip  | Hides that label; click again to bring it back      |
| Search box           | Highlights matching nodes and dims the rest         |

The graph is themed from your app's design tokens, so it follows light and
dark mode without configuration.

## The tools

| Tool                  | What it does                                           | Enabled |
| --------------------- | ------------------------------------------------------ | ------- |
| `graph_schema`        | Labels, relationship types and property names          | Always  |
| `graph_read_cypher`   | Read-only Cypher, returned as a subgraph               | Always  |
| `graph_expand_node`   | A node's neighbourhood — the "expand" of a graph explorer | Always  |
| `graph_vector_search` | Nodes closest in meaning to a phrase, plus neighbours  | When `NEO4J_VECTOR_INDEX` and `FOUNDRY_EMBEDDING_MODEL` are set |
| `graph_write_cypher`  | Creates and changes nodes and relationships, and returns what it wrote | Only when `NEO4J_ALLOW_WRITES=true` |

They live in `agent/app/graph_tools.py`. Add your own alongside them: return
the payload `graph_payload.py` builds and it renders as a graph for free.

## The panel is a shared workspace

The graph card in the chat is provenance — most people never open it. The
interaction is the side panel, and both of you can work in it.

The agent reads it (`graph_get_view` reports what is on screen and what is
selected) and drives it (`graph_show`, `graph_select_node`, `graph_search`).
Selecting a node — by hand or by the agent — puts it in the chat context, so
"tell me about this" needs no restating on either side, and the drawer's pin
keeps it there after you select something else.

Results that touch what is already on screen are **folded into the open
graph** rather than replacing it, so expanding a node or watching a write land
reads as the workspace growing. The agent does not have to ask for that, and
it is why `graph_write_cypher` is worth ending with a `RETURN`: what it
returns is what appears.

Double-clicking a node (or the drawer's **Expand**) asks the agent, in the
chat, to expand it. The panel cannot query the database — the Cypher tools are
server-side, as they must be — so the request goes through the conversation:
the turn is visible, the agent picks the traversal, and the answer merges into
the graph you are looking at.

### Semantic search

Set an embedding deployment and an index name in `agent/.env`:

```bash
FOUNDRY_MODELS_ENDPOINT=https://<your-project>.services.ai.azure.com/models
FOUNDRY_EMBEDDING_MODEL=<your-embedding-model-deployment>
NEO4J_VECTOR_INDEX=movie_embeddings
```

Re-run `pnpm graph:seed` and it will embed the demo data and create the index.
Then "which films are about machines and cities?" finds *Metropolis* without
either word appearing in it.

## Guardrails

`graph_read_cypher` is read-only, and the server is what enforces it: the
session opens in `READ` access mode, so a write is rejected with
`Neo.ClientError.Statement.AccessMode` before anything is committed. The
keyword scan in `graph_db.py` runs first only to give the model a clearer
message than a driver stack trace — a regex is not a Cypher parser and is not
what makes this safe.

Every query is bounded: a server-side timeout, a row cap, and node and
relationship caps on the payload. When a result overflows, the graph keeps the
best-connected core rather than an arbitrary prefix, and the UI says so instead
of quietly showing you part of an answer.

Values go through the `parameters` argument; the agent is instructed never to
concatenate them into the statement.

### Letting the agent write

`NEO4J_ALLOW_WRITES` is off by default, and when it is off `graph_write_cypher`
is **not registered at all** — the model cannot call a tool that was never
offered to it.

With writes on, the agent can author graph content: "add a Person named X and
connect her to Y" becomes a `MERGE` that returns the nodes and relationship it
touched, and those appear in the open graph. `MERGE` over `CREATE` is what the
agent is instructed to use, so asking twice does not produce two of everything.

Read this before turning it on: **there is no human-approval step.** This stack
has no round trip for approving a tool call, so an approval gate would emit a
request nothing answers and the run would hang. With writes enabled, the agent
can modify or delete data unattended. If you want it, point it at a database
you can afford to lose, or give it a user with only the grants it needs.

For a genuinely read-only deployment, create a dedicated database user:

```cypher
CREATE USER readonly SET PASSWORD 'change-me' CHANGE NOT REQUIRED;
GRANT ROLE reader TO readonly;
```

**`GRANT ROLE` needs Neo4j Enterprise.** Role-based access control is not in
Community — which is what `docker-compose.yml` here runs. `CREATE USER`
succeeds, then `GRANT ROLE` fails with `Unsupported administration command`,
and the new user has the same full access as every other. Verified on both
editions; do not assume the recipe took effect because its first line did.

On Community the boundary is the one this code already gives you: leave
`NEO4J_ALLOW_WRITES` unset and `build_graph_tools()` never registers the write
tool, so the agent has no way to ask for one — and point it at data you can
afford to lose. On Enterprise or Aura, grant the role and let the database
enforce it.

Database permissions are the only guarantee that survives a bug in this code.

## Project layout

```
agent/app/graph_db.py       connection, read/write separation, caps, timeouts
agent/app/graph_payload.py  driver records -> the graph payload the UI renders
agent/app/graph_tools.py    the agent's tools
src/tools/graph-module.tsx  binds tool names to the graph card + panel renderer
scripts/seed_graph.py       the demo graph
docker-compose.yml          local Neo4j (development only)
```

The visualization itself is `@lykomi/web-graph`, which knows
nothing about Neo4j — it takes a source-neutral payload. You can point it at
any graph data you have.

## Component showcase

Run `pnpm dev:web` and open `/showcase` to explore six interactive examples without Azure credentials: forms, collections, dashboards, processes, workbench windows and feedback. The live inspector reads the framework’s actual AG-UI state and available client tools. Select text in a field, filter a table, or change the active window to see the context change. Source panels contain the exact example code, ready to copy.

Connect the agent service with `pnpm dev` to ask about that context or request a guarded draft edit. The inspector works offline; agent replies require your configured backend. Examples use local, disposable data. Saving a form accepts it only in this example; leaving the example resets it. The feedback example explicitly simulates outcomes.

The showcase is a lazy `ChatModule` in `src/showcase/module.tsx`. Remove `showcaseModule` from the imports and `modules` list in `src/main.tsx` to remove its route and navigation; you can then delete `src/showcase/`. Your own app keeps using the same framework components.

## Bundled coding skills

Five repository-local skills ship in both `.agents/skills/` (Codex and compatible tools) and `.claude/skills/` (Claude Code):

- `lykomi-verify-agent-apis`: verify current framework and library APIs.
- `lykomi-author-chat-module`: compose pages, navigation and agent tools.
- `lykomi-build-agent-forms`: build consistent read/edit forms with automatic field context and guarded edits.
- `lykomi-build-workbench`: connect windows, tables and processes to visible context.
- `lykomi-verify-ui`: verify real browser behavior, context and package boundaries.

These guide your coding assistant; they are not runtime tools for the chat agent. They install only in this project and do not change global configuration. The optional Claude Code plugin adds documentation MCP servers; it is not required for these bundled skills. Keep project-specific adaptations in your generated app.


## Authentication

This local preset declares `single_user=True` on the AG-UI endpoint and has no user sign-in. Before serving multiple users, validate bearer tokens on the backend and replace that setting with an `authorization_scope_resolver` derived from the authenticated tenant and user. Browser authentication alone does not protect the endpoint or isolate thread state.
