"""The tools themselves: budget sharing, registration gating, and the guardrail.

The live tests need a real server. That is deliberate for the two claims that
matter most — read-only enforcement and the payload the driver actually
produces — because both are properties of Neo4j, not of this code, and a mock
would only assert what we already believe.
"""

from __future__ import annotations

import pytest

from app import graph_db
from app.graph_tools import _round_robin, build_graph_tools


class TestBudgetIsSharedAcrossHits:
    """The neighbour query caps fan-out per hit; the caps must not undo it.

    Both the node budget and the edge budget spend through this. A prefix of
    the merged stream gives everything to the first hits and leaves the last
    ones on screen as unconnected dots — which is the opposite of what a
    semantic search is for.
    """

    @staticmethod
    def _buckets(hits: int, per_hit: int, prefix: str = "n"):
        ids = [f"h{i}" for i in range(hits)]
        return ids, {h: [f"{h}-{prefix}{j}" for j in range(per_hit)] for h in ids}

    def test_hits_are_kept_first_and_in_order(self):
        ids, buckets = self._buckets(5, 3)
        kept = _round_robin(ids, buckets, 20, seed=ids)
        assert kept[:5] == ids

    def test_the_budget_is_spread_evenly_not_front_loaded(self):
        ids, buckets = self._buckets(25, 15)
        kept = _round_robin(ids, buckets, 300, seed=ids)
        assert len(kept) == 300
        per_hit: dict[str, int] = {}
        for item in kept[25:]:
            per_hit[item.split("-")[0]] = per_hit.get(item.split("-")[0], 0) + 1
        # Every hit gets some before any hit gets its second helping.
        assert len(per_hit) == 25
        assert max(per_hit.values()) - min(per_hit.values()) <= 1

    def test_a_prefix_would_have_starved_the_late_hits(self):
        # Pins the regression this rule exists for, so a "simplification" back
        # to a slice fails here rather than in someone's browser.
        ids, buckets = self._buckets(25, 15)
        prefix = (ids + [item for h in ids for item in buckets[h]])[:300]
        starved = {h for h in ids if not any(i.startswith(f"{h}-") for i in prefix)}
        assert starved, "the fixture no longer exercises the cap"
        kept = _round_robin(ids, buckets, 300, seed=ids)
        assert not {h for h in ids if not any(i.startswith(f"{h}-") for i in kept)}

    def test_something_two_hits_share_is_kept_once(self):
        # A relationship between two hits sits in both buckets; a neighbour can
        # be shared the same way. Spending budget twice on it would silently
        # shrink the result.
        # Depth 0 takes "x" for a and skips it for b (already kept, and the
        # skip must not spend budget); depth 1 takes "y" then "z".
        kept = _round_robin(["a", "b"], {"a": ["x", "y"], "b": ["x", "z"]}, 10)
        assert kept == ["x", "y", "z"]
        assert len(kept) == len(set(kept))

    def test_a_cap_tighter_than_the_hits_spends_nothing_on_neighbours(self):
        ids, buckets = self._buckets(5, 3)
        assert _round_robin(ids, buckets, 2, seed=ids) == ids[:2]

    def test_ragged_buckets_terminate(self):
        # One hit with many neighbours and one with none must not loop.
        assert _round_robin(["a", "b"], {"a": ["1", "2", "3"], "b": []}, 10) == [
            "1",
            "2",
            "3",
        ]

    def test_no_hits_at_all(self):
        assert _round_robin([], {}, 10) == []


class TestCapabilitiesAreGatedByRegistration:
    """A tool the deployment has not enabled must not EXIST, not merely refuse.

    There is no human-approval round trip in this stack, so a registered write
    tool with `always_require` would emit a request nothing answers and the run
    would stall. Absence is the gate.
    """

    def test_the_write_tool_is_absent_by_default(self, monkeypatch: pytest.MonkeyPatch):
        monkeypatch.delenv("NEO4J_ALLOW_WRITES", raising=False)
        assert not any(
            "write" in getattr(t, "name", str(t)) for t in build_graph_tools()
        )

    def test_the_write_tool_appears_when_the_deployment_opts_in(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.setenv("NEO4J_ALLOW_WRITES", "true")
        assert any("write" in getattr(t, "name", str(t)) for t in build_graph_tools())

    def test_vector_search_needs_both_an_index_and_a_model(
        self, monkeypatch: pytest.MonkeyPatch
    ):
        monkeypatch.delenv("FOUNDRY_EMBEDDING_MODEL", raising=False)
        monkeypatch.setenv("NEO4J_VECTOR_INDEX", "movie_embeddings")
        names = [getattr(t, "name", str(t)) for t in build_graph_tools()]
        assert not any("vector" in n for n in names)
        monkeypatch.setenv("FOUNDRY_EMBEDDING_MODEL", "some-deployment")
        assert any("vector" in getattr(t, "name", str(t)) for t in build_graph_tools())


class TestTheKeywordScanIsAFriendlyMessage:
    """It is NOT the boundary — the server's READ access mode is (see below).

    What it must do is recognise a write without being fooled by a string, a
    comment or a backtick-quoted label, because a false positive refuses a
    perfectly good read.
    """

    def test_obvious_writes_are_caught(self):
        for cypher in (
            "CREATE (n:Movie {title: 'x'})",
            "MATCH (n) SET n.x = 1",
            "MATCH (n) DETACH DELETE n",
            "MERGE (n:Person {name: 'Ada'})",
        ):
            assert graph_db.looks_like_write(cypher), cypher

    def test_a_write_word_inside_a_string_is_not_a_write(self):
        assert not graph_db.looks_like_write(
            "MATCH (n) WHERE n.note = 'please delete me' RETURN n"
        )

    def test_a_write_word_inside_a_comment_is_not_a_write(self):
        assert not graph_db.looks_like_write("MATCH (n) RETURN n //CREATE")

    def test_a_backtick_quoted_label_is_not_a_write(self):
        assert not graph_db.looks_like_write("MATCH (n:`DELETE ME`) RETURN n")

    def test_ordinary_reads_pass(self):
        assert not graph_db.looks_like_write(
            "MATCH (p:Person)-[r:ACTED_IN]->(m:Movie) RETURN p, r, m LIMIT 10"
        )
