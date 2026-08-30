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


# Counter keys that mean the database actually changed. `contains_updates` is
# the driver's own summary flag; the rest are named because a server may omit
# it, and a write that changed nothing must not be reported as stale.
_CHANGE_COUNTERS = (
    "contains_updates",
    "nodes_created",
    "nodes_deleted",
    "relationships_created",
    "relationships_deleted",
    "properties_set",
    "labels_added",
    "labels_removed",
)


def _changed(counters: dict[str, Any]) -> bool:
    return any(counters.get(key) for key in _CHANGE_COUNTERS)


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
        records, rows_truncated = await graph_db.run_read(
            "CALL db.schema.visualization()"
        )
        payload = records_to_graph_payload(
            records,
            max_nodes=graph_db.max_nodes(),
            max_edges=graph_db.max_edges(),
            meta=_meta("CALL db.schema.visualization()", started),
            rows_truncated=rows_truncated,
        )
        # The visualization gives shape but not property names; those are what
        # the model actually needs to write a working query.
        try:
            props, props_truncated = await graph_db.run_read(
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
            # Property names are what the model authors its next query from, so
            # a prefix of them presented as the whole schema is worse than a
            # smaller graph: it invents a database that does not exist.
            if props_truncated:
                payload["truncated"] = True
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
        records, rows_truncated = await graph_db.run_read(cypher, parameters)
    except graph_db.WriteNotAllowed as exc:
        return _failure(str(exc))
    except Exception as exc:  # noqa: BLE001
        return _failure(f"The query failed. {graph_db.safe_error(exc)}")

    payload = records_to_graph_payload(
        records,
        max_nodes=graph_db.max_nodes(),
        max_edges=graph_db.max_edges(),
        meta=_meta(cypher, started),
        rows_truncated=rows_truncated,
    )
    if not payload["nodes"]:
        # A query that returned scalars is legitimate; hand the values back so
        # the agent can still answer, and let the empty graph render as empty.
        scalar_cap = 25
        payload["meta"]["rows"] = [
            {key: to_json_value(value) for key, value in record.items()}
            for record in records[:scalar_cap]
        ]
        # A SECOND cap, under the row cap, and it needs saying too: a scalar
        # answer is the whole answer for this query, so 25 of 200 rows
        # presented as complete is a wrong answer rather than a partial view.
        if len(records) > scalar_cap:
            payload["truncated"] = True
    return payload


@tool(approval_mode="never_require")
async def graph_write_cypher(
    cypher: Annotated[
        str,
        Field(
            description=(
                "A Cypher statement that modifies the graph. End it with a RETURN of the "
                "nodes and relationships it touched (for example "
                "`MERGE (p:Person {name: $name}) MERGE (p)-[r:DIRECTED]->(m) RETURN p, r, m`) "
                "so the result can be drawn and the user can see what changed. Put every "
                "value in `parameters` rather than writing it into the statement. Prefer "
                "MERGE over CREATE so re-running does not duplicate."
            )
        ),
    ],
    parameters: Annotated[
        dict[str, Any] | None,
        Field(description="Query parameters, referenced as $name in the statement."),
    ] = None,
) -> dict[str, Any]:
    """Create or change nodes and relationships, and return what was written.

    Only available when the deployment has enabled writes. Call ``graph_schema``
    first so the labels, relationship types and property names match what is
    already there — a typo does not fail, it silently creates a second kind of
    thing. End the statement with a RETURN of what it touched: the result is
    folded into the graph already on screen for you, so the change appears
    beside what it connects to without a second tool call.

    A DELETION is the exception, and the result says so. Merging can add and
    update; it cannot remove, and a deleted node has no row to return — so the
    graph on screen would go on showing what is no longer in the database.
    After a delete, re-run the read that produced the view and call
    ``graph_show`` WITHOUT ``merge``.
    """
    if not graph_db.writes_enabled():
        return _failure(
            "Writes are disabled for this deployment (NEO4J_ALLOW_WRITES is not set)."
        )
    started = time.monotonic()
    try:
        records, counters, rows_truncated = await graph_db.run_write(cypher, parameters)
    except Exception as exc:  # noqa: BLE001
        return _failure(f"The write failed. {graph_db.safe_error(exc)}")

    meta = _meta(cypher, started)
    meta["counters"] = counters
    # A deletion cannot be merged into the open graph — there is no row for a
    # node that no longer exists — so the panel keeps drawing it. Nothing on
    # the client can know which ids went, so the agent is told plainly rather
    # than left to infer it from the counters.
    if counters.get("nodes_deleted") or counters.get("relationships_deleted"):
        meta["view_stale"] = True
        meta["note"] = (
            "This write DELETED something, and a deletion cannot be merged into the graph on "
            "screen — it still shows what was removed. Re-run the read that produced the view "
            "and call graph_show WITHOUT merge."
        )
    payload = records_to_graph_payload(
        records,
        max_nodes=graph_db.max_nodes(),
        max_edges=graph_db.max_edges(),
        meta=meta,
        rows_truncated=rows_truncated,
    )
    # A write that CHANGED something and returned nothing to draw leaves the
    # panel exactly as stale as a deletion does, and for the same reason: the
    # merge has no rows to apply. `MATCH ... SET ...` with no RETURN is an
    # ordinary thing for a model to generate, so it cannot be left to the
    # deletion branch above — without this the drawer goes on showing the
    # property at its old value and nothing says otherwise.
    if not meta.get("view_stale") and _changed(counters) and not payload["nodes"]:
        meta["view_stale"] = True
        meta["note"] = (
            "This write CHANGED the database but returned no nodes or relationships, so the "
            "graph on screen still shows the values from before it. Re-run the read that "
            "produced the view, or re-run this statement with a RETURN of what it touched."
        )
        # Set explicitly rather than relying on `records_to_graph_payload`
        # having stored this same dict by reference — it does, and that is not
        # a thing the next reader should have to know.
        payload["meta"] = meta
    # `applied` rides alongside the graph so the agent can confirm the change
    # even when the statement returned nothing to draw.
    payload["applied"] = True
    return payload


@tool(approval_mode="never_require")
async def graph_expand_node(
    node_id: Annotated[
        str,
        Field(
            description="The node's id, as it appears in a graph payload (an elementId)."
        ),
    ],
    limit: Annotated[
        int, Field(description="Maximum neighbours to return (1-100).")
    ] = 25,
) -> dict[str, Any]:
    """Fetch a node's immediate neighbourhood — the node, its neighbours, and the relationships between.

    This is what "expand" means in a graph explorer, and it is the move people
    reach for constantly: show me what is around this. The neighbourhood joins
    the graph on screen by itself — describe what appeared rather than calling
    a second tool to arrange it.
    """
    started = time.monotonic()
    cap = max(1, min(int(limit), 100))
    try:
        records, rows_truncated = await graph_db.run_read(
            "MATCH (n) WHERE elementId(n) = $id "
            "OPTIONAL MATCH (n)-[r]-(m) "
            "RETURN n, r, m LIMIT $cap",
            # One past the cap, because the LIMIT is inside the STATEMENT: ask
            # for exactly `cap` and the server hands back exactly `cap`, and a
            # node with a hundred neighbours is indistinguishable from one with
            # twenty-five. `run_read` drops the extra row and reports the cut.
            {"id": node_id, "cap": cap + 1},
            row_limit=cap,
        )
    except Exception as exc:  # noqa: BLE001
        return _failure(f"Could not expand that node. {graph_db.safe_error(exc)}")

    if not records:
        return _failure(f"No node with id {node_id!r} — it may have been deleted.")

    return records_to_graph_payload(
        records,
        max_nodes=graph_db.max_nodes(),
        max_edges=graph_db.max_edges(),
        meta=_meta(None, started),
        rows_truncated=rows_truncated,
    )


def _cap_vector_nodes(
    hit_ids: list[str], per_hit: dict[str, list[str]], limit: int
) -> list[str]:
    """Spend the node budget across the hits, not down the arrival order.

    The neighbour query already caps fan-out PER HIT, so no single high-degree
    hit can eat the whole neighbourhood. Taking a prefix of the merged node
    dict afterwards puts that bias straight back: the hits themselves come
    first (they are the answer, and they are ranked), then every neighbour of
    hit 1, then every neighbour of hit 2 — so once the total passes the cap,
    the late hits arrive on screen as bare, unconnected dots while the early
    ones sit in a hairball. Reachable with the tool's own arguments: 25 hits at
    the default fan-out of 15 is 400 nodes against a 300 cap.

    So: keep the hits first, in score order, then take one neighbour from each
    hit in turn until the budget runs out. Every hit that has neighbours gets
    some before any hit gets its second.
    """
    kept = list(hit_ids[:limit])
    seen = set(kept)
    # Only reached when every hit fits, so `hit_ids` and the kept hits are the
    # same list; a cap tighter than the hit count spends nothing on neighbours.
    budget = limit - len(kept)
    depth = 0
    while budget > 0:
        exhausted = True
        for hit_id in hit_ids:
            if budget <= 0:
                break
            bucket = per_hit.get(hit_id) or []
            if depth >= len(bucket):
                continue
            exhausted = False
            neighbour = bucket[depth]
            # Already kept: a hit, or a neighbour two hits share. Skipping it
            # without spending budget is the point — the slot goes to a node
            # that is not on screen yet.
            if neighbour in seen:
                continue
            seen.add(neighbour)
            kept.append(neighbour)
            budget -= 1
        if exhausted:
            break
        depth += 1
    return kept


@tool(approval_mode="never_require")
async def graph_vector_search(
    query: Annotated[
        str,
        Field(
            description="Natural-language text to find semantically similar nodes for."
        ),
    ],
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
        hits, _ = await graph_db.run_read(
            "CALL db.index.vector.queryNodes($index, $k, $embedding) "
            "YIELD node, score RETURN node, score",
            {"index": index_name, "k": k, "embedding": embedding},
            row_limit=k,
        )
        nodes: dict[str, Any] = {}
        edges: dict[str, Any] = {}
        scores: list[dict[str, Any]] = []
        # Which hit each neighbour arrived for, in arrival order. The node cap
        # below spends its budget across these buckets rather than down the
        # merged dict, so the fan-out stays per hit all the way to the payload.
        hit_ids: list[str] = []
        per_hit: dict[str, list[str]] = {}
        for record in hits:
            node = record["node"]
            if node.element_id not in nodes:
                nodes[node.element_id] = node_to_graph_node(node)
                hit_ids.append(node.element_id)
                per_hit[node.element_id] = []
            scores.append({"id": node.element_id, "score": float(record["score"])})

        if nodes:
            # `CALL (n) { ... }` is the scoped-subquery form, Neo4j 5.23+ —
            # which `neo4j:5-community` and Aura both are. The older
            # `CALL { WITH n ... }` works everywhere but is deprecated there,
            # and a starter should not greet its user with a warning.
            #
            # PER HIT, not one budget shared across all of them. A single
            # global LIMIT lets the first high-degree hit spend the whole
            # allowance, so a semantic search over a graph with uneven degrees
            # came back as a hairball around one node and nothing at all around
            # the rest — the opposite of what this tool is for.
            neighbours, _ = await graph_db.run_read(
                "MATCH (n) WHERE elementId(n) IN $ids "
                "CALL (n) { MATCH (n)-[r]-(m) RETURN r, m LIMIT $fanout } "
                # `elementId(n)`, not `n` — which hit the row belongs to is all
                # the cap needs, and the node itself is already in hand.
                "RETURN elementId(n) AS hit, r, m",
                {"ids": hit_ids, "fanout": fanout},
                row_limit=fanout * len(hit_ids),
            )
            for record in neighbours:
                neighbour = record["m"]
                nodes.setdefault(neighbour.element_id, node_to_graph_node(neighbour))
                bucket = per_hit.get(record["hit"])
                if bucket is not None:
                    bucket.append(neighbour.element_id)
                edge = relationship_to_graph_edge(record["r"])
                if edge is not None:
                    edges.setdefault(edge["id"], edge)
    except Exception as exc:  # noqa: BLE001
        return _failure(f"Vector search failed. {graph_db.safe_error(exc)}")

    kept_ids = _cap_vector_nodes(hit_ids, per_hit, graph_db.max_nodes())
    kept_nodes = {node_id: nodes[node_id] for node_id in kept_ids}
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
    # No row-cap flag here on purpose: `k` and the fan-out cap are what this
    # tool was ASKED for, so returning exactly that many is the answer rather
    # than a partial one. Only the node/edge caps below cut into it.
    if len(nodes) > len(kept_nodes) or len(edges) > len(kept_edges):
        payload["truncated"] = True
    return payload if kept_nodes else empty_payload(meta)


# Audience the inference endpoint expects. `azure.ai.inference` defaults to a
# different one (Azure ML), so a token acquired without this comes back 401
# "audience is incorrect" — which reads like a permissions problem and is not
# one. Verified against a live resource.
_EMBEDDING_SCOPE = "https://cognitiveservices.azure.com/.default"

# Built once. `DefaultAzureCredential` caches tokens on the instance, so a
# fresh one per query pays a full token acquisition on every vector search —
# very visible in a chat loop. An app-lifetime credential is the SDK's own
# guidance.
_CREDENTIAL: Any = None


def _models_endpoint() -> str | None:
    """The inference endpoint to embed against.

    `FOUNDRY_MODELS_ENDPOINT` wins. Failing that, derive it from the resource
    endpoint the rest of the app already has: a resource serves the inference
    API under ``/models``, so requiring a second, near-identical variable
    would be configuration for its own sake.

    A **project** endpoint is not a resource endpoint, though. It has the shape
    ``https://<resource>.services.ai.azure.com/api/projects/<project>``, and
    appending ``/models`` to that produces a path that does not exist —
    silently, since ``build_graph_tools()`` registers vector search on the
    model and index variables alone, so the tool appears and every embedding
    request 404s. The project path is stripped back to the resource first.
    """
    explicit = os.getenv("FOUNDRY_MODELS_ENDPOINT")
    if explicit:
        return explicit.rstrip("/")
    base = os.getenv("AZURE_OPENAI_ENDPOINT") or os.getenv("FOUNDRY_PROJECT_ENDPOINT")
    if not base:
        return None
    root = base.rstrip("/")
    marker = "/api/projects/"
    if marker in root:
        root = root[: root.index(marker)]
    return f"{root}/models"


def _embedding_credential() -> tuple[Any, bool]:
    """The credential for the models endpoint, and whether it is a key.

    Scopes apply to token credentials only — an `AzureKeyCredential` carries no
    audience, and handing one `credential_scopes` is meaningless.
    """
    global _CREDENTIAL
    api_key = os.getenv("FOUNDRY_MODELS_API_KEY")
    if api_key:
        from azure.core.credentials import AzureKeyCredential

        return AzureKeyCredential(api_key), True
    if _CREDENTIAL is None:
        from azure.identity.aio import DefaultAzureCredential

        _CREDENTIAL = DefaultAzureCredential()
    return _CREDENTIAL, False


async def embed_query(text: str) -> list[float]:
    """Embed one string with the configured embedding model.

    Uses ``agent_framework_foundry``'s embedding client, so this shares the
    endpoint and credential the chat model already uses — no second SDK and no
    second auth story.

    The transport is built here rather than left to the client, because the
    client forwards only ``endpoint`` and ``credential`` to ``EmbeddingsClient``
    — never ``credential_scopes``. Without them the token is issued for the
    wrong audience and every call comes back 401. The client still wants a
    ``credential`` of its own, which it validates and builds its image client
    from.
    """
    from agent_framework_foundry import FoundryEmbeddingClient
    from azure.ai.inference.aio import EmbeddingsClient

    endpoint = _models_endpoint()
    model = os.getenv("FOUNDRY_EMBEDDING_MODEL")
    if not endpoint or not model:
        raise RuntimeError(
            "Embeddings are not configured. Set FOUNDRY_EMBEDDING_MODEL, and either "
            "FOUNDRY_MODELS_ENDPOINT or AZURE_OPENAI_ENDPOINT."
        )

    credential, is_key = _embedding_credential()
    scopes = {} if is_key else {"credential_scopes": [_EMBEDDING_SCOPE]}
    transport = EmbeddingsClient(endpoint=endpoint, credential=credential, **scopes)
    client = FoundryEmbeddingClient(
        model=model, endpoint=endpoint, text_client=transport, credential=credential
    )
    try:
        result = await client.get_embeddings([text])
        return list(result[0].vector)
    finally:
        # Closes both the transport above and the image client the wrapper
        # built alongside it. Each holds an aiohttp session; leaking them logs
        # "Unclosed client session" and eventually exhausts the connector. The
        # credential is deliberately NOT closed — it is reused across calls.
        await client.close()


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
    tools: list[Any] = [graph_schema, graph_read_cypher, graph_expand_node]
    if os.getenv("NEO4J_VECTOR_INDEX") and os.getenv("FOUNDRY_EMBEDDING_MODEL"):
        tools.append(graph_vector_search)
    if graph_db.writes_enabled():
        tools.append(graph_write_cypher)
    return tools


# Deliberately NOT evaluated at import. `build_graph_tools` reads environment
# that `.env` supplies, and a module-level call runs during the import graph —
# before `load_dotenv()` has had a chance to put it there. A capability would
# then be missing with the variable plainly set in the file, which is the kind
# of "it is configured and it does not work" that costs an evening. Call it
# from `get_agent()`, which runs on the first request.
