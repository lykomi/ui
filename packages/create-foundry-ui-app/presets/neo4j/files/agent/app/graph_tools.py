"""Graph tools for the agent.

Every tool returns the ``foundry.graph`` payload that
``@iloveagents/foundry-web-graph`` renders, so any result the agent produces can
be drawn as a graph rather than read as JSON.

Read and write are separate tools, and the write tool is only registered when
``NEO4J_ALLOW_WRITES`` is set — see the note on ``graph_write_cypher``.
"""

from __future__ import annotations

import logging
import os
import time
from typing import Annotated, Any

from agent_framework import tool
from pydantic import Field

from . import graph_db
from .graph_payload import (
    empty_payload,
    node_to_graph_node,
    records_to_graph_payload,
    relationship_to_graph_edge,
    to_json_value,
)

logger = logging.getLogger(__name__)


def _meta(cypher: str | None, started: float) -> dict[str, Any]:
    # Deliberately no `parameters`: they carry the user's own values, and this
    # travels back into the conversation and any transcript store.
    meta: dict[str, Any] = {
        "elapsedMs": int((time.monotonic() - started) * 1000),
        "database": graph_db.database(),
    }
    if cypher:
        meta["query"] = cypher
    return meta


def _failure(message: str) -> dict[str, Any]:
    """A failed tool call. The `error` key is what marks it failed in the UI —
    which is exactly why a successful payload must never carry one."""
    return {"error": message}


@tool(approval_mode="never_require")
async def graph_schema() -> dict[str, Any]:
    """Inspect the graph's structure: node labels, relationship types, and the properties on each.

    Call this before writing any Cypher, so the query uses labels and property
    names that actually exist.
    """
    started = time.monotonic()
    try:
        # db.schema.visualization() returns the schema AS A GRAPH — nodes for
        # labels, relationships for types — so the very first thing the user
        # sees renders in the graph view instead of as a wall of JSON.
        records = await graph_db.run_read("CALL db.schema.visualization()")
        payload = records_to_graph_payload(
            records,
            max_nodes=graph_db.max_nodes(),
            max_edges=graph_db.max_edges(),
            meta=_meta("CALL db.schema.visualization()", started),
        )
        # The visualization gives shape but not property names; those are what
        # the model actually needs to write a working query.
        try:
            props = await graph_db.run_read(
                "CALL db.schema.nodeTypeProperties() "
                "YIELD nodeLabels, propertyName, propertyTypes "
                "RETURN nodeLabels, propertyName, propertyTypes"
            )
            payload["meta"]["properties"] = [
                {
                    "labels": record["nodeLabels"],
                    "property": record["propertyName"],
                    "types": record["propertyTypes"],
                }
                for record in props
            ]
        except Exception:  # noqa: BLE001 - property detail is a bonus, not the point
            logger.debug("nodeTypeProperties unavailable", exc_info=True)
        return payload
    except Exception as exc:  # noqa: BLE001
        return _failure(f"Could not read the graph schema. {graph_db.safe_error(exc)}")


@tool(approval_mode="never_require")
async def graph_read_cypher(
    cypher: Annotated[
        str,
        Field(
            description=(
                "A read-only Cypher statement. Return nodes and relationships "
                "(for example `MATCH p=(a)-[r]->(b) RETURN p`) so the result can be "
                "drawn as a graph. Put every value in `parameters` rather than "
                "writing it into the statement."
            )
        ),
    ],
    parameters: Annotated[
        dict[str, Any] | None,
        Field(description="Query parameters, referenced as $name in the statement."),
    ] = None,
) -> dict[str, Any]:
    """Run a read-only Cypher query and return the matching subgraph."""
    started = time.monotonic()
    try:
        records = await graph_db.run_read(cypher, parameters)
    except graph_db.WriteNotAllowed as exc:
        return _failure(str(exc))
    except Exception as exc:  # noqa: BLE001
        return _failure(f"The query failed. {graph_db.safe_error(exc)}")

    payload = records_to_graph_payload(
        records,
        max_nodes=graph_db.max_nodes(),
        max_edges=graph_db.max_edges(),
        meta=_meta(cypher, started),
    )
    if not payload["nodes"]:
        # A query that returned scalars is legitimate; hand the values back so
        # the agent can still answer, and let the empty graph render as empty.
        payload["meta"]["rows"] = [
            {key: to_json_value(value) for key, value in record.items()} for record in records[:25]
        ]
    return payload


@tool(approval_mode="never_require")
async def graph_write_cypher(
    cypher: Annotated[str, Field(description="A Cypher statement that modifies the graph.")],
    parameters: Annotated[
        dict[str, Any] | None,
        Field(description="Query parameters, referenced as $name in the statement."),
    ] = None,
) -> dict[str, Any]:
    """Modify the graph. Only available when the deployment has enabled writes."""
    if not graph_db.writes_enabled():
        return _failure("Writes are disabled for this deployment (NEO4J_ALLOW_WRITES is not set).")
    try:
        counters = await graph_db.run_write(cypher, parameters)
    except Exception as exc:  # noqa: BLE001
        return _failure(f"The write failed. {graph_db.safe_error(exc)}")
    return {"applied": True, "counters": counters}


@tool(approval_mode="never_require")
async def graph_vector_search(
    query: Annotated[str, Field(description="Natural-language text to find semantically similar nodes for.")],
    limit: Annotated[int, Field(description="How many nodes to return (1-50).")] = 10,
) -> dict[str, Any]:
    """Find nodes whose embedding is closest to the query text, with their neighbours.

    Use this when the question is about meaning rather than structure — "which
    documents discuss termination rights" rather than "who reports to Ada".
    """
    started = time.monotonic()
    index_name = os.getenv("NEO4J_VECTOR_INDEX")
    if not index_name:
        return _failure(
            "Vector search is not configured. Set NEO4J_VECTOR_INDEX (and an embedding model) "
            "to enable it, or use graph_read_cypher instead."
        )

    try:
        embedding = await embed_query(query)
    except Exception as exc:  # noqa: BLE001
        return _failure(f"Could not embed the query. {graph_db.safe_error(exc)}")

    k = max(1, min(int(limit), 50))
    fanout = graph_db._env_int("NEO4J_MAX_NEIGHBOURS", 15)
    try:
        # Two statements rather than one: OPTIONAL MATCH on a supernode inside
        # the same query multiplies rows by its degree, and the hit list is
        # what the score belongs to.
        hits = await graph_db.run_read(
            "CALL db.index.vector.queryNodes($index, $k, $embedding) "
            "YIELD node, score RETURN node, score",
            {"index": index_name, "k": k, "embedding": embedding},
            row_limit=k,
        )
        nodes: dict[str, Any] = {}
        edges: dict[str, Any] = {}
        scores: list[dict[str, Any]] = []
        for record in hits:
            node = record["node"]
            nodes.setdefault(node.element_id, node_to_graph_node(node))
            scores.append({"id": node.element_id, "score": float(record["score"])})

        if nodes:
            neighbours = await graph_db.run_read(
                "MATCH (n)-[r]-(m) WHERE elementId(n) IN $ids "
                "RETURN r, m LIMIT $cap",
                {"ids": list(nodes), "cap": fanout * len(nodes)},
                row_limit=fanout * len(nodes),
            )
            for record in neighbours:
                neighbour = record["m"]
                nodes.setdefault(neighbour.element_id, node_to_graph_node(neighbour))
                edge = relationship_to_graph_edge(record["r"])
                if edge is not None:
                    edges.setdefault(edge["id"], edge)
    except Exception as exc:  # noqa: BLE001
        return _failure(f"Vector search failed. {graph_db.safe_error(exc)}")

    kept_nodes = dict(list(nodes.items())[: graph_db.max_nodes()])
    kept_edges = [
        edge
        for edge in edges.values()
        if edge["source"] in kept_nodes and edge["target"] in kept_nodes
    ][: graph_db.max_edges()]

    meta = _meta(None, started)
    meta["scores"] = scores
    meta["index"] = index_name
    payload = {
        "kind": "foundry.graph",
        "version": 1,
        "nodes": list(kept_nodes.values()),
        "edges": kept_edges,
        "stats": {"nodeCount": len(nodes), "edgeCount": len(edges)},
        "meta": meta,
    }
    if len(nodes) > len(kept_nodes) or len(edges) > len(kept_edges):
        payload["truncated"] = True
    return payload if kept_nodes else empty_payload(meta)


async def embed_query(text: str) -> list[float]:
    """Embed one string with the Foundry embedding model.

    Uses ``agent_framework_foundry``'s embedding client, so this shares the
    endpoint and credential the chat model already uses — no second SDK and no
    second auth story.
    """
    from agent_framework_foundry import FoundryEmbeddingClient
    from azure.identity import DefaultAzureCredential

    client = FoundryEmbeddingClient(
        model=os.getenv("FOUNDRY_EMBEDDING_MODEL"),
        endpoint=os.getenv("FOUNDRY_MODELS_ENDPOINT"),
        credential=None if os.getenv("FOUNDRY_MODELS_API_KEY") else DefaultAzureCredential(),  # type: ignore[arg-type]
    )
    result = await client.get_embeddings([text])
    return list(result[0].vector)


def build_graph_tools() -> list[Any]:
    """The tools to hand the agent, given this deployment's configuration.

    Two capabilities are registered conditionally rather than returning "not
    available" at call time:

    * The write tool is absent unless ``NEO4J_ALLOW_WRITES`` is set. There is no
      human-approval round trip in this stack — an ``always_require`` approval
      would emit a request nothing answers and the run would stall — so the
      gate has to be whether the tool exists at all.
    * Vector search is absent unless an index and an embedding model are
      configured, so the local-database quickstart does not offer a tool that
      can only fail.
    """
    tools: list[Any] = [graph_schema, graph_read_cypher]
    if os.getenv("NEO4J_VECTOR_INDEX") and os.getenv("FOUNDRY_EMBEDDING_MODEL"):
        tools.append(graph_vector_search)
    if graph_db.writes_enabled():
        tools.append(graph_write_cypher)
    return tools


GRAPH_TOOLS = build_graph_tools()
