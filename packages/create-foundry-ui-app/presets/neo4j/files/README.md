# __PROJECT_NAME__

A Foundry UI starter that gives an agent a Neo4j graph: it reads the schema,
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
relationship counts. Expand it for an inline graph, or **Open in panel** for
the full-size view.

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
| `graph_vector_search` | Nodes closest in meaning to a phrase, plus neighbours  | When `NEO4J_VECTOR_INDEX` and `FOUNDRY_EMBEDDING_MODEL` are set |
| `graph_write_cypher`  | Modifies the graph                                     | Only when `NEO4J_ALLOW_WRITES=true` |

They live in `agent/app/graph_tools.py`. Add your own alongside them: return
the payload `graph_payload.py` builds and it renders as a graph for free.

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

The visualization itself is `@iloveagents/foundry-web-graph`, which knows
nothing about Neo4j — it takes a source-neutral payload. You can point it at
any graph data you have.
