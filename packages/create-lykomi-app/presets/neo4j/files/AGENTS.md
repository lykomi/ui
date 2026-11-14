This is a LYKOMI UI starter that gives an agent a Neo4j graph: React chat UI, AG-UI transport, Microsoft Agent Framework, and graph tools whose results render as an interactive graph.

# Architecture

```text
src/main.tsx                 LYKOMI UI shell bootstrap
src/pages/chat-page.tsx      Chat screen and graph starter prompts
src/index.css                Tailwind v4 + web-ui and web-graph styles
src/tools/graph-module.tsx   Binds tool names to the graph card; registers the panel renderer
vite.config.ts               manualChunks — the vendor-graph rule MUST stay above the react rule
agent/app/main.py            FastAPI app, AG-UI endpoint, driver lifespan
agent/app/agent.py           FoundryChatClient + Agent configuration and instructions
agent/app/graph_db.py        Connection, read/write separation, caps, timeouts
agent/app/graph_payload.py   Driver records -> the graph payload the UI renders
agent/app/graph_tools.py     The agent's graph tools; update build_graph_tools() here
agent/app/tools.py           Local Agent Framework tools; update AGENT_TOOLS here
scripts/seed_graph.py        Demo graph, and optional embeddings + vector index
docker-compose.yml           Local Neo4j for development
```

# Run

```bash
pnpm install
cp agent/.env.example agent/.env   # fill in FOUNDRY_PROJECT_ENDPOINT + FOUNDRY_MODEL
az login
pnpm graph:up && pnpm graph:seed
pnpm dev
```

The UI runs on `http://localhost:8010`, the agent service on `http://localhost:8020`; Vite proxies `/api/agent` to it. Neo4j Browser is on `http://localhost:7474`.

```bash
pnpm test:agent      # the graph tools, in `agent/tests/`
```

Two halves. The pure tests — payload coercion, connected-core capping, the
per-hit budget, the write-keyword scan — run anywhere. The live tests need a
database and SKIP without one, so `pnpm test:agent` is green and meaningful
before you have started anything; point `NEO4J_URI` at a server (a `.env` is
enough) and they run. They are what pins the two claims a mock cannot: that a
`READ`-mode session is refused a write BY THE SERVER, and what the driver
really hydrates for the endpoints of a bare relationship.

Aura instead of local: change `NEO4J_URI` to `neo4j+s://<instance-id>.databases.neo4j.io` and the credentials. No code is Aura-specific.

# Conventions that are easy to break

- **A graph tool returns the payload, never prose.** `records_to_graph_payload` in `graph_payload.py` builds it. A result that does not match the `foundry.graph` contract renders as an ordinary tool card with no graph.
- **Never put a top-level `error` key on a successful payload.** The AG-UI runner marks a tool call failed when the parsed result has one, so the whole card turns red no matter how good the data is. Report partial results with `truncated` instead. `_failure()` is for genuine failures.
- **Read-only is enforced by the server**, via `READ` access mode in `graph_db.run_read`. The keyword scan is a friendlier error message, not the boundary. Do not weaken the access mode on the assumption that the regex has it covered.
- **Writes are gated by registration, not approval.** There is no human-approval round trip in this stack — `approval_mode="always_require"` would emit a request nothing answers and the run would stall. `build_graph_tools()` therefore omits the write tool entirely unless `NEO4J_ALLOW_WRITES` is set. Same for vector search when it is not configured.
- **Neo4j 5.23 or newer.** `graph_vector_search` uses the scoped subquery `CALL (n) { … }` to cap neighbours PER HIT; the pre-5.23 spelling still works but is deprecated on every server this preset targets. `neo4j:5-community` and Aura are both well past it.
- **JSON cannot carry every number Neo4j can.** `to_json_value` narrows both
  ends: an integer outside ±(2^53−1) goes over as a string, because
  `JSON.parse` reads every number as a double and would silently round it; a
  non-finite float goes over as `"NaN"`/`"Infinity"`, because `json.dumps`
  emits those as bare tokens the browser REJECTS — an otherwise successful
  query then dies at the transport boundary rather than in the query. Both
  keep ordinary numbers as numbers.
- **The local database listens on loopback only.** `docker-compose.yml` binds
  `127.0.0.1:7474` and `127.0.0.1:7687` deliberately. The password is
  published in that file so the quickstart has no setup step, which is exactly
  why the port must not be: the default `"7687:7687"` form listens on every
  interface, so on a shared network anyone routable could read and rewrite the
  graph.
- **Parameters, never string interpolation.** Cypher is built as a constant with `$name` placeholders. No f-strings, no `.format()`, no `%`.
- **`vite.config.ts` chunk order.** `react-force-graph-2d`, `react-kapsule` and `web-graph` all contain "react"; the `vendor-graph` rule has to come before `id.includes("react")` or the whole force engine lands in `vendor-react`.
- **`src/index.css` needs the `@source` line for `web-graph/dist`.** Tailwind v4 cannot infer classes from package output without it, and the graph chrome renders unstyled.

# Adding a graph tool

1. Write it in `graph_tools.py`, returning `records_to_graph_payload(...)`.
2. Add it in `build_graph_tools()`, gated on config if it needs any.
3. Bind a card in `src/tools/graph-module.tsx`:
   ```tsx
   const MyToolUI = makeGraphToolUI({ toolName: "my_tool", title: "My query" });
   ```
   and render it inside `toolUIs`.

Step 3 is not cosmetic. The card is what folds a result into the graph already
open, so a graph-returning tool with no card comes back as a generic result and
the panel never hears about it — the agent narrates an expansion that never
arrives, and nothing reports a failure.

The agent can also call `show_graph` with a payload to put any graph in the side panel — that card is registered already.

# Where the visualization lives

`@lykomi/web-graph`, an npm package. It is source-neutral: it takes the payload contract and knows nothing about Neo4j or Cypher. Its `@lykomi/web-graph/adapters/neo4j` entry point converts driver-shaped records in the browser, for apps that query a graph directly rather than through an agent.
