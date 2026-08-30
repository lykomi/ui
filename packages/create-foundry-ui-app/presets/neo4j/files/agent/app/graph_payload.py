"""Neo4j driver records -> the ``foundry.graph`` payload the UI renders.

The contract is defined by ``@iloveagents/foundry-web-graph`` and is
deliberately source-neutral: the visualizer never learns that Neo4j exists.
Keep the field names here in step with ``GraphPayload`` in that package.
"""

from __future__ import annotations

import datetime as _dt
import math
from collections.abc import Iterable, Mapping
from typing import Any

import neo4j
import neo4j.graph
import neo4j.time

GRAPH_PAYLOAD_KIND = "foundry.graph"
GRAPH_PAYLOAD_VERSION = 1

# Long text (a document body, an embedding rendered as a string) is useless in a
# property table and expensive in a chat context window, so it is clipped here
# rather than at the UI.
MAX_PROPERTY_CHARS = 500

# How deep to walk a record value looking for graph entities.
_MAX_DEPTH = 12

# JavaScript has no integer type: `JSON.parse` reads every number as an IEEE-754
# double and silently rounds anything past 2**53-1. Neo4j integers are signed
# 64-bit, so a counter, a hash or an epoch in microseconds can land beyond that
# — and the browser would then display a neighbouring number, with nothing
# anywhere reporting a problem. Out-of-range values go over as strings, which is
# lossless and reads correctly in the property table; in-range ones stay numbers
# so ordinary counts still behave like counts.
JS_MAX_SAFE_INTEGER = 2**53 - 1


def _clip(text: str) -> str:
    if len(text) <= MAX_PROPERTY_CHARS:
        return text
    return f"{text[: MAX_PROPERTY_CHARS - 1]}…"


def to_json_value(value: Any) -> Any:
    """Coerce a driver value into something ``json.dumps`` accepts.

    Neo4j returns its own temporal, spatial and integer types. Left alone they
    blow up serialization at the FastAPI boundary — a failure that surfaces as
    an opaque 500 long after the query succeeded.
    """
    if value is None or isinstance(value, bool):
        return value
    if isinstance(value, float):
        # `NaN` and `+/-Infinity` are real float values that Cypher can both
        # compute (`0.0/0.0`, `toFloat('Infinity')`) and return. JSON has no
        # spelling for them: `json.dumps` emits the bare tokens `NaN` and
        # `Infinity`, which `JSON.parse` REJECTS, and strict mode raises
        # instead — so either way a query that succeeded dies at the transport
        # boundary as an opaque failure, which is the exact thing this
        # function exists to prevent.
        if math.isfinite(value):
            return value
        # Spelled the way Cypher and JavaScript spell them, not the way Python
        # does (`nan`, `inf`), so the property table reads back what the
        # database would show.
        if math.isnan(value):
            return "NaN"
        return "Infinity" if value > 0 else "-Infinity"
    if isinstance(value, int):
        if -JS_MAX_SAFE_INTEGER <= value <= JS_MAX_SAFE_INTEGER:
            return value
        return str(value)
    if isinstance(value, str):
        return _clip(value)
    if isinstance(value, (bytes, bytearray)):
        return f"<{len(value)} bytes>"
    if isinstance(value, (neo4j.time.DateTime, neo4j.time.Date, neo4j.time.Time)):
        return str(value)
    if isinstance(value, neo4j.time.Duration):
        return str(value)
    if isinstance(value, _dt.datetime | _dt.date | _dt.time):
        return value.isoformat()
    if isinstance(value, neo4j.spatial.Point):
        return {"srid": value.srid, "coordinates": list(value)}
    if isinstance(value, Mapping):
        return {str(k): to_json_value(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set, frozenset)):
        # A vector property is thousands of floats — summarise instead of
        # shipping it into the chat context.
        items = list(value)
        if len(items) > 32 and all(isinstance(i, (int, float)) for i in items):
            return f"<{len(items)}-dimension vector>"
        return [to_json_value(v) for v in items]
    return _clip(str(value))


def _properties(entity: Any) -> dict[str, Any]:
    return {str(k): to_json_value(v) for k, v in dict(entity).items()}


def node_to_graph_node(node: neo4j.graph.Node) -> dict[str, Any]:
    return {
        "id": node.element_id,
        "labels": list(node.labels),
        "properties": _properties(node),
    }


def relationship_to_graph_edge(rel: neo4j.graph.Relationship) -> dict[str, Any] | None:
    # A relationship detached from its endpoints cannot be drawn; the UI would
    # drop it anyway, so it is dropped here where the reason is knowable.
    if rel.start_node is None or rel.end_node is None:
        return None
    return {
        "id": rel.element_id,
        "source": rel.start_node.element_id,
        "target": rel.end_node.element_id,
        "type": rel.type,
        "properties": _properties(rel),
    }


def _collect(
    value: Any,
    nodes: dict[str, Any],
    edges: dict[str, Any],
    depth: int,
    stubs: set[str] | None = None,
) -> None:
    """Walk a record value, picking out every node and relationship.

    Recursive rather than shape-matched on purpose: the tool takes arbitrary
    Cypher, so the result might be bare entities, a path, a ``collect()`` list,
    or a map projection. Recursion makes ``RETURN *`` work as well as a careful
    projection, which is what an agent-written query usually is.

    ``stubs`` records ids that so far exist only because a relationship named
    them. Measured against a live server: a relationship returned on its own
    (``MATCH ()-[r]->() RETURN r``) hands back endpoints with NO labels and NO
    properties. When the same node also appears in the record, the driver
    hydrates one object and there is nothing to choose between — but across
    ROWS the stub can land first, and plain ``setdefault`` would then keep it
    and discard the full node the query actually returned, drawing a nameless
    circle with an empty inspector.
    """
    if stubs is None:
        stubs = set()
    if depth > _MAX_DEPTH or value is None:
        return
    if isinstance(value, neo4j.graph.Node):
        # A real node always wins over an endpoint stub; two real nodes with
        # the same id are the same node, so first-wins still holds there.
        if value.element_id not in nodes or value.element_id in stubs:
            nodes[value.element_id] = node_to_graph_node(value)
            stubs.discard(value.element_id)
        return
    if isinstance(value, neo4j.graph.Relationship):
        edge = relationship_to_graph_edge(value)
        if edge is not None:
            edges.setdefault(edge["id"], edge)
        # A relationship carries its endpoints, and a query that returns only
        # relationships still needs to render the nodes at both ends.
        for end in (value.start_node, value.end_node):
            if end is None or end.element_id in nodes:
                continue
            nodes[end.element_id] = node_to_graph_node(end)
            # Only a bare endpoint is replaceable. One that arrived carrying
            # its labels or properties is as good as the node itself.
            if not end.labels and not dict(end):
                stubs.add(end.element_id)
        return
    if isinstance(value, neo4j.graph.Path):
        for node in value.nodes:
            _collect(node, nodes, edges, depth + 1, stubs)
        for rel in value.relationships:
            _collect(rel, nodes, edges, depth + 1, stubs)
        return
    if isinstance(value, Mapping):
        for nested in value.values():
            _collect(nested, nodes, edges, depth + 1, stubs)
        return
    if isinstance(value, (list, tuple, set, frozenset)):
        for nested in value:
            _collect(nested, nodes, edges, depth + 1, stubs)


def select_connected_core(
    node_ids: list[str], edges: Iterable[dict[str, Any]], limit: int
) -> list[str]:
    """Choose which nodes survive a cap: the connected core around the hubs.

    Which nodes survive decides whether the user sees a graph or confetti.

    Taking the first N in insertion order keeps whatever the database happened
    to return first — for an unbounded MATCH that is close to random, and the
    survivors are mostly unrelated, so the edges collapse with them.

    Taking the N highest-degree nodes is better but not enough. In a graph
    that is even loosely bipartite — films and people, orders and customers —
    the hubs are all on one side and none of them are adjacent, so a small cap
    still yields a set with no edges at all.

    So: seed at the biggest hub and expand outwards through its neighbours,
    preferring well-connected ones, then start again at the next unvisited hub.
    Every node after the first seed is adjacent to one already chosen, so the
    result is a handful of connected neighbourhoods rather than scattered dust.

    Mirrors ``selectConnectedCore`` in ``@iloveagents/foundry-web-graph``; both
    sides cap, and they have to agree on what the important part of a graph is.
    """
    if len(node_ids) <= limit:
        return node_ids

    degree: dict[str, int] = {}
    adjacency: dict[str, list[str]] = {}
    for edge in edges:
        source, target = edge["source"], edge["target"]
        degree[source] = degree.get(source, 0) + 1
        degree[target] = degree.get(target, 0) + 1
        adjacency.setdefault(source, []).append(target)
        adjacency.setdefault(target, []).append(source)

    # Insertion order breaks ties, so the same result caps the same way twice.
    order = {node_id: index for index, node_id in enumerate(node_ids)}
    rank = sorted(node_ids, key=lambda n: (-degree.get(n, 0), order[n]))

    chosen: list[str] = []
    seen: set[str] = set()
    for seed in rank:
        if len(chosen) >= limit:
            break
        if seed in seen:
            continue
        queue = [seed]
        seen.add(seed)
        while queue and len(chosen) < limit:
            current = queue.pop(0)
            chosen.append(current)
            neighbours = sorted(
                (n for n in adjacency.get(current, []) if n not in seen),
                key=lambda n: (-degree.get(n, 0), order[n]),
            )
            for neighbour in neighbours:
                seen.add(neighbour)
                queue.append(neighbour)
    return chosen[:limit]


def records_to_graph_payload(
    records: Iterable[neo4j.Record],
    *,
    max_nodes: int,
    max_edges: int,
    meta: dict[str, Any] | None = None,
    rows_truncated: bool = False,
) -> dict[str, Any]:
    """Build the payload. Never returns a top-level ``error`` key.

    The AG-UI runner marks a tool call failed when the parsed result has an
    ``error`` key, so a payload that used one to report partial trouble would
    render as a red failed call regardless of how much good data it carried.
    Partial results are reported through ``truncated`` instead.
    """
    nodes: dict[str, Any] = {}
    edges: dict[str, Any] = {}
    stubs: set[str] = set()
    for record in records:
        for value in record.values():
            _collect(value, nodes, edges, 0, stubs)

    total_nodes = len(nodes)
    total_edges = len(edges)

    if total_nodes <= max_nodes:
        kept_nodes = nodes
    else:
        keep = select_connected_core(list(nodes), edges.values(), max_nodes)
        kept_nodes = {node_id: nodes[node_id] for node_id in keep}
    # Re-filter edges against the nodes that survived: an edge whose endpoint
    # was just capped away would dangle.
    kept_edges = [
        edge
        for edge in edges.values()
        if edge["source"] in kept_nodes and edge["target"] in kept_nodes
    ][:max_edges]

    payload: dict[str, Any] = {
        "kind": GRAPH_PAYLOAD_KIND,
        "version": GRAPH_PAYLOAD_VERSION,
        "nodes": list(kept_nodes.values()),
        "edges": kept_edges,
    }
    # `stats` means totals BEFORE truncation, and these counts are only that
    # when every row reached us. Once the caller's row cap has cut the result,
    # `total_nodes` is the count of the RETAINED prefix — a 500-node query with
    # the default 200-row cap would report 200 and call it the database total.
    # The node/edge caps below are different: they drop from a complete count,
    # so the totals are still known and worth reporting.
    if not rows_truncated:
        payload["stats"] = {"nodeCount": total_nodes, "edgeCount": total_edges}
    # `rows_truncated` is the caller's row cap, which this function cannot see:
    # it only ever receives the rows that survived it, so without being told it
    # would call a half-answer complete.
    if rows_truncated or total_nodes > len(kept_nodes) or total_edges > len(kept_edges):
        payload["truncated"] = True
    if meta:
        payload["meta"] = meta
    return payload


def empty_payload(meta: dict[str, Any] | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {
        "kind": GRAPH_PAYLOAD_KIND,
        "version": GRAPH_PAYLOAD_VERSION,
        "nodes": [],
        "edges": [],
        "stats": {"nodeCount": 0, "edgeCount": 0},
    }
    if meta:
        payload["meta"] = meta
    return payload
