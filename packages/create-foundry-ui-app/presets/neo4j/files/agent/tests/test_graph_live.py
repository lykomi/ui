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

import neo4j
import pytest

from app import graph_db
from app.graph_payload import GRAPH_PAYLOAD_KIND, GRAPH_PAYLOAD_VERSION
from app.graph_tools import graph_expand_node, graph_read_cypher, graph_schema

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

    async def test_a_read_session_refuses_a_write(self):
        driver = graph_db.get_driver()
        async with driver.session(
            database=graph_db.database(), default_access_mode=neo4j.READ_ACCESS
        ) as session:
            with pytest.raises(neo4j.exceptions.ClientError) as excinfo:
                result = await session.run(
                    "CREATE (n:__TestOnly__ {marker: 'should never exist'}) RETURN n"
                )
                await result.consume()
        assert "AccessMode" in excinfo.value.code

    async def test_nothing_was_written(self):
        rows, _ = await graph_db.run_read(
            "MATCH (n:__TestOnly__) RETURN count(n) AS n"
        )
        assert rows[0]["n"] == 0

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

    async def test_a_node_and_its_relationships_together_keep_the_full_node(self):
        # Across rows a bare endpoint can arrive before the real node. The real
        # one has to win, or the query's own result is discarded in favour of
        # a stub.
        payload = await unwrap(graph_read_cypher)(
            "MATCH (n)-[r]->(m) RETURN n, r, m LIMIT 10"
        )
        assert_is_graph_payload(payload)
        assert all(n["labels"] for n in payload["nodes"]), "an endpoint stub survived"

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
