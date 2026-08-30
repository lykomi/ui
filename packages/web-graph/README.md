# @iloveagents/foundry-web-graph

Interactive graph visualization for [Foundry UI](https://github.com/iLoveAgents/foundry-ui).

A force-directed graph view with the interactions people expect from a graph
explorer — colour and caption by type, a filtering legend, hover, select,
expand, search, pin, zoom-to-fit — plus an optional assistant-ui tool card and
side-panel renderer so an agent can put a graph in front of the user.

**Source-neutral by construction.** The root export takes a plain payload and
knows nothing about where the data came from. Neo4j is one adapter, in its own
entry point; the chat integration is in another. Import only what you use.

```bash
pnpm add @iloveagents/foundry-web-graph
```

### Tailwind v4 hosts: point Tailwind at this package

`styles.css` carries the `--graph-1..8` palette and the rules Tailwind cannot
express — it is **not** the component styling. `GraphView` is built from
utility classes, and Tailwind v4 does not scan `node_modules`, so without a
`@source` directive the graph renders with no spacing, borders or typography:

```css
@import "tailwindcss";
@source "../node_modules/@iloveagents/foundry-web-graph/dist";

@import "@iloveagents/foundry-web-graph/styles.css";
```

(Adjust the relative path to your stylesheet\'s location. Apps scaffolded by
`create-foundry-ui-app --preset neo4j` already have this.)

## Drawing a graph

```tsx
import { GraphView } from "@iloveagents/foundry-web-graph";
import "@iloveagents/foundry-web-graph/styles.css";

const data = {
  kind: "foundry.graph",
  version: 1,
  nodes: [
    { id: "1", labels: ["Person"], properties: { name: "Ada" } },
    { id: "2", labels: ["Project"], properties: { name: "Analytical Engine" } },
  ],
  edges: [{ id: "e1", source: "1", target: "2", type: "WORKED_ON" }],
} as const;

<GraphView data={data} height={480} onExpandNode={(node) => loadNeighbours(node.id)} />;
```

`onExpandNode` is a callback: the view never issues a query of its own. Feed a
larger payload back through `data` and the layout keeps the positions of nodes
that were already there.

Colours come from your app's design tokens, so light and dark mode work without
configuration. The stylesheet is optional — without it the graph falls back to
the host's `--chart-*` tokens, and then to a built-in palette.

## In a chat

```tsx
import { defineChatModule } from "@iloveagents/foundry-web-shell";
import {
  makeGraphToolUI,
  registerGraphPanelRenderer,
} from "@iloveagents/foundry-web-graph/assistant-ui";

const CypherToolUI = makeGraphToolUI({ toolName: "graph_read_cypher" });

export const graphModule = defineChatModule({
  name: "graph",
  useInit: registerGraphPanelRenderer,
  toolUIs: <CypherToolUI />,
});
```

`makeGraphToolUI` is a factory because assistant-ui binds a literal tool name at
construction — so the card works for any tool that returns the payload, whatever
it is called. A result that is not graph-shaped degrades to an ordinary tool
card rather than throwing.

`registerGraphPanelRenderer()` teaches the tool panel to render
`type: "graph"` content, which is what the card's **Open in panel** action
produces. It is idempotent.

## Letting the agent work in the graph

The panel can be a workspace the agent and the user share rather than a picture
the agent hands over. `registerGraphClientTools()` adds four browser-executed
tools:

| Tool                | What the agent can do                                                                                          |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `graph_get_view`    | Read what is on screen: counts, types, the selected node, the active search                                    |
| `graph_show`        | Put a new graph in the panel — positions of nodes already there are kept, so a refined query reads as a change |
| `graph_select_node` | Select and centre a node, by id or by caption                                                                  |
| `graph_search`      | Highlight matches and dim the rest                                                                             |

```tsx
import {
  registerGraphClientTools,
  registerGraphPanelRenderer,
} from "@iloveagents/foundry-web-graph/assistant-ui";

export const graphModule = defineChatModule({
  name: "graph",
  useInit: () => {
    registerGraphPanelRenderer();
    registerGraphClientTools();
  },
  toolUIs: <CypherToolUI />,
});
```

The user's own clicks land in the same state, so "tell me about this node"
works without either side restating which node. Read `graphWorkspaceStore`
directly if you want to build your own UI on top of it.

## From Neo4j

```ts
import { graphFromNeo4j } from "@iloveagents/foundry-web-graph/adapters/neo4j";

const payload = graphFromNeo4j(records);
```

Structurally typed — it does not import `neo4j-driver`, so a visualization
package never drags a database client into your bundle. It walks arbitrary
result rows and collects anything node- or relationship-shaped, so `RETURN *`
works as well as a careful projection.

Most apps will not need this: a backend that emits the payload directly is the
better arrangement. See the `neo4j` starter — `npm create foundry-ui-app my-app -- --preset neo4j`.

## The payload

```ts
interface GraphPayload {
  kind: "foundry.graph";
  version: 1;
  nodes: {
    id: string;
    labels?: string[];
    caption?: string;
    properties?: Record<string, unknown>;
  }[];
  edges: {
    id: string;
    source: string;
    target: string;
    type?: string;
    properties?: Record<string, unknown>;
  }[];
  truncated?: boolean;
  stats?: { nodeCount?: number; edgeCount?: number };
  legend?: Record<string, { color?: string; captionKey?: string }>;
}
```

`kind` and `version` are what let a tool card look at an arbitrary result and
decide whether to render it. `isGraphPayload` checks both strictly;
`coerceGraphPayload` is the tolerant version that also accepts a JSON string or
a `{ graph: … }` envelope.

A payload must never carry a top-level `error` key — the AG-UI runner treats
that as a failed tool call. Report partial results with `truncated`. The type
declares `error?: never` so this fails at compile time rather than in a demo.

## Large graphs

`GraphView` caps what it draws (1,500 nodes / 3,000 relationships by default,
via `limits`). When a payload overflows it keeps the **connected core** — seeded
at the best-connected node and expanded through its neighbours — rather than an
arbitrary prefix, and reports what was withheld. Taking the first N instead
produces a screen of unconnected dots, which reads as "there is nothing here"
rather than "there is too much here".

The canvas is not readable by assistive technology, so the same graph is always
available as a table (`GraphTable`, or `forceTable` on `GraphView`).

## Peer dependencies

`react`, `react-dom` and `lucide-react` are required. `@assistant-ui/react` is
optional and only needed for the `/assistant-ui` entry point.

## License

MIT
