"""Against a real Neo4j. Skipped when ``NEO4J_URI`` is unset.

Two claims here cannot be tested any other way. Read-only enforcement is a
property of the SERVER, not of this code, so a mock would assert only what we
already believe. And the payload's shape depends on what the driver actually
hydrates — endpoints of a bare relationship, in particular, come back without
labels or properties, which is a fact about Neo4j that a fixture would get
wrong in exactly the direction that hides the bug.
"""

from __future__ import annotations

import os
from uuid import uuid4

import neo4j
import pytest

from app import graph_db
from app.graph_payload import (
    GRAPH_PAYLOAD_KIND,
    GRAPH_PAYLOAD_VERSION,
    records_to_graph_payload,
)
from app.graph_tools import (
    graph_expand_node,
    graph_read_cypher,
    graph_schema,
    graph_vector_search,
)

pytestmark = pytest.mark.skipif(
    not os.getenv("NEO4J_URI"),
    reason="needs a live Neo4j — set NEO4J_URI (docker-compose.yml starts one)",
)


def unwrap(tool):
    """The plain coroutine behind an ``@tool``-decorated function.

    The decorator wraps the function for the agent framework; these tests want
    the behaviour, not the framework's calling convention.
    """
    return getattr(tool, "func", tool)


@pytest.fixture(autouse=True)
async def _database_is_reachable():
    """Fail clearly rather than obscurely.

    Every tool answers an unreachable database with a `_failure` payload, so
    without this the whole module fails on `KeyError: 'kind'` and the actual
    cause — nothing listening on the bolt port — appears nowhere in the report.
    """
    try:
        await graph_db.run_read("RETURN 1 AS ok")
    except Exception as exc:  # noqa: BLE001 - reported, not handled
        pytest.fail(
            f"NEO4J_URI is set but the database is unreachable: "
            f"{graph_db.safe_error(exc)}"
        )


def assert_is_graph_payload(payload: dict) -> None:
    # First, so a failure payload reports ITS message instead of a KeyError.
    assert "error" not in payload, payload.get("error")
    assert payload["kind"] == GRAPH_PAYLOAD_KIND
    assert payload["version"] == GRAPH_PAYLOAD_VERSION
    assert isinstance(payload["nodes"], list)
    assert isinstance(payload["edges"], list)
    # A top-level `error` makes the AG-UI runner mark the tool call FAILED, so
    # the card renders red however good the data is. Partial results are
    # reported with `truncated` instead — asserted above, before the shape.
    ids = {n["id"] for n in payload["nodes"]}
    for edge in payload["edges"]:
        assert edge["source"] in ids and edge["target"] in ids, "edge dangles"


class TestReadOnlyIsEnforcedByTheServer:
    """The keyword scan is a friendlier message; THIS is the boundary.

    Tested by going around the scan entirely and handing a write straight to a
    READ-mode session. If this ever passes, `run_read` is no longer read-only
    no matter how good the regex is.
    """

    async def test_run_read_is_refused_a_write_by_the_server(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        # Through `run_read`, with only the keyword scan disabled. Opening a
        # READ session directly would pin NEO4J's behaviour and not ours —
        # `run_read` could be changed to WRITE_ACCESS and such a test would
        # stay green while the documented boundary was gone.
        #
        # The sentinel is unique per run and removed in a `finally` through an
        # independent WRITE session, because the failure mode this test exists
        # for is the one where the CREATE actually commits. Without that, a
        # single regression leaves a node behind, and the count below then
        # fails on every future run against that database even after read mode
        # is fixed — a test that poisons the thing it is testing. This is not
        # hypothetical: it happened once while verifying this test can fail.
        monkeypatch.setattr(graph_db, "looks_like_write", lambda _cypher: False)
        sentinel = uuid4().hex
        try:
            with pytest.raises(neo4j.exceptions.ClientError) as excinfo:
                await graph_db.run_read(
                    "CREATE (n:__TestOnly__ {marker: $marker}) RETURN n",
                    {"marker": sentinel},
                )
            assert "AccessMode" in excinfo.value.code

            # The exception is not the whole guarantee — what matters is that
            # nothing was written. A boundary could fail in a way that raises
            # something else, or raises after committing.
            rows, _ = await graph_db.run_read(
                "MATCH (n:__TestOnly__ {marker: $marker}) RETURN count(n) AS n",
                {"marker": sentinel},
            )
            assert rows[0]["n"] == 0, "the write was not refused — a node was created"
        finally:
            await _remove_sentinel(sentinel)

    async def test_run_read_refuses_before_it_reaches_the_server(self):
        with pytest.raises(graph_db.WriteNotAllowed):
            await graph_db.run_read("CREATE (n:Movie {title: 'nope'}) RETURN n")


class TestPayloadsComeBackRenderable:
    async def test_a_node_query_round_trips(self):
        payload = await unwrap(graph_read_cypher)("MATCH (n) RETURN n LIMIT 5")
        assert_is_graph_payload(payload)
        assert payload["nodes"], "seeded database returned no nodes"
        assert all(n["labels"] for n in payload["nodes"])

    async def test_a_relationship_only_query_still_renders_its_endpoints(self):
        # `MATCH ()-[r]->() RETURN r` hands back endpoints with NO labels and
        # NO properties. Without the stub-replacement rule the graph draws
        # nameless circles with empty inspectors.
        payload = await unwrap(graph_read_cypher)(
            "MATCH ()-[r]->() RETURN r LIMIT 5"
        )
        assert_is_graph_payload(payload)
        assert payload["edges"], "no relationships came back"
        assert payload["nodes"], "relationships arrived with no endpoints"

    async def test_endpoints_in_the_same_record_arrive_hydrated(self):
        # Documents WHY the test below needs two results. Within one result the
        # driver caches a node by element id and fills it in, so a relationship
        # returned alongside its endpoints never yields a stub — measured, and
        # true even across rows of a UNION ALL, where `rel.start_node is node`.
        payload = await unwrap(graph_read_cypher)(
            "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 10"
        )
        assert_is_graph_payload(payload)
        assert all(n["labels"] for n in payload["nodes"])

    async def test_a_stub_from_one_result_loses_to_the_full_node_from_another(self):
        # THE regression the stub rule exists for, and it needs records from two
        # SEPARATE results to exist at all: a relationship returned alone hands
        # back endpoints with no labels and no properties, and a plain
        # `setdefault` would keep that bare endpoint and discard the real node
        # the second query returned — drawing a nameless circle with an empty
        # inspector.
        rel_rows, _ = await graph_db.run_read("MATCH ()-[r]->() RETURN r LIMIT 1")
        endpoint_id = rel_rows[0]["r"].start_node.element_id
        assert not list(rel_rows[0]["r"].start_node.labels), (
            "a relationship returned alone no longer yields a bare endpoint — "
            "the premise of the stub rule has changed"
        )
        node_rows, _ = await graph_db.run_read(
            "MATCH (n) WHERE elementId(n) = $id RETURN n", {"id": endpoint_id}
        )
        assert list(node_rows[0]["n"].labels)

        # Stub first, full node second: the order that makes first-wins lose.
        payload = records_to_graph_payload(
            list(rel_rows) + list(node_rows), max_nodes=50, max_edges=50
        )
        # Compared against the node the second query returned, not against
        # "has any properties at all": a labelled node with an empty property
        # map is a perfectly ordinary graph, and asserting truthiness there
        # would reject a valid database even though the rule works.
        expected = node_rows[0]["n"]
        kept = next(n for n in payload["nodes"] if n["id"] == endpoint_id)
        assert kept["labels"] == list(expected.labels), (
            "the endpoint stub survived and the real node was dropped"
        )
        assert set(kept["properties"]) == {str(key) for key in dict(expected)}

    async def test_the_schema_is_itself_a_renderable_graph(self):
        # The schema comes back as a `foundry.graph` payload — labels as nodes,
        # relationship types as edges — so "what is in this database?" draws in
        # the same panel as every other answer instead of being a wall of text.
        payload = await unwrap(graph_schema)()
        assert_is_graph_payload(payload)
        assert payload["nodes"], "schema reported no labels"
        labels = {label for n in payload["nodes"] for label in n["labels"]}
        assert labels, "schema nodes carry no label"
        assert payload["edges"], "schema reported no relationship types"
        assert all(e["type"] for e in payload["edges"])

    async def test_expanding_a_node_returns_it_with_its_neighbourhood(self):
        seed = await unwrap(graph_read_cypher)(
            "MATCH (n)--() RETURN n LIMIT 1"
        )
        node_id = seed["nodes"][0]["id"]
        payload = await unwrap(graph_expand_node)(node_id)
        assert_is_graph_payload(payload)
        assert node_id in {n["id"] for n in payload["nodes"]}
        assert len(payload["nodes"]) > 1, "expansion returned the node alone"


class TestTruncationIsReported:
    """A capped answer that claims to be whole is worse than a small one.

    The row cap lives in the caller, so the payload cannot infer it — it only
    ever sees the rows that survived. Being told is the only way it knows.
    """

    async def test_a_row_cap_sets_truncated(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.setenv("NEO4J_MAX_ROWS", "1")
        payload = await unwrap(graph_read_cypher)("MATCH (n) RETURN n LIMIT 25")
        assert payload.get("truncated") is True
        # `stats` means totals BEFORE truncation, and with rows cut they are
        # not knowable here — reporting the retained count as the total would
        # call a 200-row prefix the size of the database.
        assert "stats" not in payload

    async def test_an_uncapped_query_reports_stats_and_no_truncation(self):
        payload = await unwrap(graph_read_cypher)("MATCH (n) RETURN n LIMIT 3")
        assert payload.get("truncated") is not True
        assert payload["stats"]["nodeCount"] == len(payload["nodes"])


class TestTheVectorToolSpendsItsBudgetAcrossHits:
    """`_round_robin` is unit-tested; this pins that the TOOL still uses it.

    Swapping either budget call back to a prefix slice leaves every direct test
    of `_round_robin` green while late semantic-search hits go back to being
    drawn as unconnected dots — so the rule has to be pinned where it is
    APPLIED, not only where it is defined.

    The tool's two queries are replayed from REAL records fetched out of the
    live database, keyed the way the tool keys them. Nothing fabricates a driver
    type: a hand-built Node would assert against a shape the server may not
    send, which is the failure this file exists to avoid. Only `embed_query` is
    faked, because it is the one part needing a model rather than a database.

    The hits are ordered by degree, highest first, and the neighbour rows are
    grouped per hit the way the tool's own per-hit subquery returns them. That
    ordering is the whole point: a prefix slice then spends the entire budget
    on the first, busiest hit, which is exactly the regression. A fixture where
    every hit has a similar handful of neighbours does NOT discriminate — a
    prefix spreads across hits by accident and the test passes on broken code.
    """

    @staticmethod
    async def _replayable(monkeypatch: pytest.MonkeyPatch, *, wanted: int = 4):
        """Real records for both of the tool's queries, busiest hit first."""
        hits, _ = await graph_db.run_read(
            "MATCH (n)--(m) WITH n, count(DISTINCT m) AS degree "
            "ORDER BY degree DESC, elementId(n) LIMIT $wanted "
            "RETURN n AS node, 1.0 AS score",
            {"wanted": wanted},
        )
        assert len(hits) >= 2, "need several connected nodes to distribute between"
        hit_ids = [record["node"].element_id for record in hits]
        rows, _ = await graph_db.run_read(
            "MATCH (n)-[r]-(m) WHERE elementId(n) IN $ids "
            "RETURN elementId(n) AS hit, r, m",
            {"ids": hit_ids},
        )
        # Grouped per hit, in hit order — what the per-hit subquery produces.
        neighbours = sorted(rows, key=lambda record: hit_ids.index(record["hit"]))
        assert sum(1 for r in neighbours if r["hit"] == hit_ids[0]) >= 3, (
            "the busiest hit needs several neighbours or a prefix cannot starve the rest"
        )

        async def replay(cypher, parameters=None, *, row_limit=None):
            return (hits, False) if "queryNodes" in cypher else (neighbours, False)

        monkeypatch.setattr(graph_db, "run_read", replay)
        monkeypatch.setattr("app.graph_tools.embed_query", _fixed_embedding)
        monkeypatch.setenv("NEO4J_VECTOR_INDEX", "irrelevant-the-query-is-replayed")
        return hit_ids, neighbours

    async def test_the_node_budget_reaches_more_than_the_first_hit(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        hit_ids, neighbours = await self._replayable(monkeypatch)

        # Provenance, as in the edge test: which bucket first offered each
        # neighbour. A shared neighbour belongs to two hits, so crediting it to
        # both would let a prefix that kept only the first bucket's nodes score
        # as "spread" and pass on the broken code.
        first_owner: dict[str, str] = {}
        per_bucket: dict[str, list[str]] = {}
        for record in neighbours:
            node_id = record["m"].element_id
            if node_id in hit_ids:
                continue
            first_owner.setdefault(node_id, record["hit"])
            if first_owner[node_id] == record["hit"]:
                bucket = per_bucket.setdefault(record["hit"], [])
                if node_id not in bucket:
                    bucket.append(node_id)

        # Budget = exactly the busiest bucket's own neighbours, so a prefix
        # spends all of it there and reaches no second bucket, whatever the
        # graph looks like. Asserted rather than assumed.
        spare = len(per_bucket.get(hit_ids[0], []))
        assert spare >= 2, "the busiest bucket must be able to absorb the whole budget"
        assert sum(1 for ids in per_bucket.values() if ids) >= 2, (
            "at least two hits need neighbours of their own for a distribution to exist"
        )
        monkeypatch.setenv("NEO4J_MAX_NODES", str(len(hit_ids) + spare))
        monkeypatch.setenv("NEO4J_MAX_EDGES", "600")

        payload = await unwrap(graph_vector_search)("anything", limit=len(hit_ids))
        assert_is_graph_payload(payload)
        kept = {node["id"] for node in payload["nodes"]}
        assert set(hit_ids) <= kept, "a hit was capped away; the hits seed the budget"

        owners = {first_owner[node_id] for node_id in kept if node_id in first_owner}
        assert len(owners) > 1, (
            "every retained neighbour came from one hit's bucket — the node budget is "
            "a prefix again"
        )

    async def test_the_edge_budget_reaches_more_than_the_first_hit(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        hit_ids, neighbours = await self._replayable(monkeypatch)

        # Which bucket each edge is FIRST offered from — the order both a
        # prefix and the round-robin walk it in. Provenance, not endpoints: an
        # edge between two hits touches two seeds whichever rule kept it, so
        # counting endpoints would score a prefix as "spread" and pass on the
        # broken code.
        first_owner: dict[str, str] = {}
        per_bucket: dict[str, list[str]] = {}
        for record in neighbours:
            edge_id = record["r"].element_id
            first_owner.setdefault(edge_id, record["hit"])
            bucket = per_bucket.setdefault(record["hit"], [])
            if edge_id not in bucket:
                bucket.append(edge_id)

        # The budget is exactly the busiest bucket's size, so a prefix spends
        # all of it inside that one bucket and reaches no other. Asserting the
        # premise rather than assuming the demo graph's shape: with a smaller
        # first bucket a prefix would spill into the second and pass.
        budget = len(per_bucket[hit_ids[0]])
        assert budget >= 2, "the busiest bucket must be able to absorb the whole budget"
        assert sum(1 for ids in per_bucket.values() if ids) >= 2, (
            "at least two hits need drawable edges for a distribution to exist"
        )

        # Keep every node, so only the EDGE budget is doing the choosing.
        monkeypatch.setenv("NEO4J_MAX_NODES", "600")
        monkeypatch.setenv("NEO4J_MAX_EDGES", str(budget))

        payload = await unwrap(graph_vector_search)("anything", limit=len(hit_ids))
        assert_is_graph_payload(payload)
        owners = {
            first_owner[edge["id"]]
            for edge in payload["edges"]
            if edge["id"] in first_owner
        }
        assert len(owners) > 1, (
            "every retained edge came from one hit's bucket — the edge budget is a "
            "prefix again, and the late hits are drawn as unconnected dots"
        )


async def _fixed_embedding(_text: str) -> list[float]:
    """The one fake here: embedding needs a model, everything else a database."""
    return [0.0, 0.0, 0.0]


async def _remove_sentinel(marker: str) -> None:
    """Delete the read-only test's sentinel through a WRITE session.

    Independent of `run_read` on purpose: if that regressed to write access the
    node exists, and the cleanup has to work in exactly that case.
    """
    driver = graph_db.get_driver()
    async with driver.session(
        database=graph_db.database(), default_access_mode=neo4j.WRITE_ACCESS
    ) as session:
        result = await session.run(
            "MATCH (n:__TestOnly__ {marker: $marker}) DETACH DELETE n",
            {"marker": marker},
        )
        await result.consume()
