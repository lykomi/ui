This is a Foundry UI starter that gives an agent a Neo4j graph: React chat UI, AG-UI transport, Microsoft Agent Framework, and graph tools whose results render as an interactive graph.

# Architecture

```text
src/main.tsx                 Foundry UI shell bootstrap
src/pages/chat-page.tsx      Chat screen and graph starter prompts
src/index.css                Tailwind v4 + foundry-web-ui and foundry-web-graph styles
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

Aura instead of local: change `NEO4J_URI` to `neo4j+s://<instance-id>.databases.neo4j.io` and the credentials. No code is Aura-specific.

# Conventions that are easy to break

- **A graph tool returns the payload, never prose.** `records_to_graph_payload` in `graph_payload.py` builds it. A result that does not match the `foundry.graph` contract renders as an ordinary tool card with no graph.
- **Never put a top-level `error` key on a successful payload.** The AG-UI runner marks a tool call failed when the parsed result has one, so the whole card turns red no matter how good the data is. Report partial results with `truncated` instead. `_failure()` is for genuine failures.
- **Read-only is enforced by the server**, via `READ` access mode in `graph_db.run_read`. The keyword scan is a friendlier error message, not the boundary. Do not weaken the access mode on the assumption that the regex has it covered.
- **Writes are gated by registration, not approval.** There is no human-approval round trip in this stack — `approval_mode="always_require"` would emit a request nothing answers and the run would stall. `build_graph_tools()` therefore omits the write tool entirely unless `NEO4J_ALLOW_WRITES` is set. Same for vector search when it is not configured.
- **Parameters, never string interpolation.** Cypher is built as a constant with `$name` placeholders. No f-strings, no `.format()`, no `%`.
- **`vite.config.ts` chunk order.** `react-force-graph-2d`, `react-kapsule` and `foundry-web-graph` all contain "react"; the `vendor-graph` rule has to come before `id.includes("react")` or the whole force engine lands in `vendor-react`.
- **`src/index.css` needs the `@source` line for `foundry-web-graph/dist`.** Tailwind v4 cannot infer classes from package output without it, and the graph chrome renders unstyled.

# Adding a graph tool

1. Write it in `graph_tools.py`, returning `records_to_graph_payload(...)`.
2. Add it in `build_graph_tools()`, gated on config if it needs any.
3. Bind a card in `src/tools/graph-module.tsx`:
   ```tsx
   const MyToolUI = makeGraphToolUI({ toolName: "my_tool", title: "My query" });
   ```
   and render it inside `toolUIs`.

The agent can also call `show_graph` with a payload to put any graph in the side panel — that card is registered already.

# Where the visualization lives

`@iloveagents/foundry-web-graph`, an npm package. It is source-neutral: it takes the payload contract and knows nothing about Neo4j or Cypher. Its `@iloveagents/foundry-web-graph/adapters/neo4j` entry point converts driver-shaped records in the browser, for apps that query a graph directly rather than through an agent.
