---
"@iloveagents/foundry-web-graph": minor
---

Graph nodes and edges can carry what people should read about them.

- `GraphEdge.caption` — what the edge says, such as "replaces 9.1" — is drawn on the canvas, in the inspector and in the table in place of the relationship type, which still groups and filters it.
- `details` on a node or edge — label, value, optional `href` — are shown first in the inspector, with links opening in a new tab (`http(s)` or same-origin paths only; `safeHref`). The raw properties and secondary labels move into a collapsed "Advanced" section. The hover shows the details instead of the first raw properties.

Payloads without captions or details render exactly as before.
