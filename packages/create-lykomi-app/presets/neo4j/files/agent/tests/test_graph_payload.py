"""The payload contract, without a database.

Everything here is pure: given driver-shaped values, does the payload come out
in the shape ``@lykomi/web-graph`` renders? These are the rules a
change to the tools is most likely to break silently, because the failure
shows up as a graph that looks slightly wrong rather than as an error.
"""

from __future__ import annotations

import math

from app.graph_payload import (
    JS_MAX_SAFE_INTEGER,
    MAX_PROPERTY_CHARS,
    select_connected_core,
    to_json_value,
)


class TestNumbersJsonCannotCarry:
    """JSON has no integer type and no spelling for NaN or Infinity.

    Both ends are narrowed here rather than at the UI, because past the
    transport boundary the damage is either silent (a rounded integer) or fatal
    (`JSON.parse` rejecting a bare `NaN`) — and a query that succeeded should
    not die on the way back.
    """

    def test_in_range_integers_stay_numbers(self):
        for value in (0, 1, -1, JS_MAX_SAFE_INTEGER, -JS_MAX_SAFE_INTEGER):
            assert to_json_value(value) == value
            assert isinstance(to_json_value(value), int)

    def test_out_of_range_integers_become_strings(self):
        # One past the boundary is exactly where a double starts rounding, so
        # it is the value worth pinning.
        big = JS_MAX_SAFE_INTEGER + 1
        assert to_json_value(big) == str(big)
        assert to_json_value(-big) == str(-big)

    def test_non_finite_floats_use_the_spelling_javascript_uses(self):
        assert to_json_value(float("nan")) == "NaN"
        assert to_json_value(float("inf")) == "Infinity"
        assert to_json_value(float("-inf")) == "-Infinity"

    def test_ordinary_floats_are_untouched(self):
        assert to_json_value(1.5) == 1.5
        assert math.isclose(to_json_value(-0.25), -0.25)

    def test_bools_are_not_treated_as_integers(self):
        # `isinstance(True, int)` is True in Python; without the explicit bool
        # branch a flag would arrive at the UI as 1.
        assert to_json_value(True) is True
        assert to_json_value(False) is False


class TestPropertiesThatWouldFloodTheContext:
    def test_long_text_is_clipped(self):
        clipped = to_json_value("x" * (MAX_PROPERTY_CHARS * 2))
        assert len(clipped) == MAX_PROPERTY_CHARS
        assert clipped.endswith("…")

    def test_short_text_is_untouched(self):
        assert to_json_value("Sherlock Jr.") == "Sherlock Jr."

    def test_an_embedding_is_summarised_not_shipped(self):
        # A vector property is thousands of floats. Sending it costs the chat
        # context and tells the reader nothing.
        summary = to_json_value([0.1] * 1536)
        assert summary == "<1536-dimension vector>"

    def test_a_short_number_list_is_still_a_list(self):
        assert to_json_value([1, 2, 3]) == [1, 2, 3]

    def test_a_list_of_strings_is_never_summarised(self):
        # The summary rule is for numeric vectors only — a list of genres is
        # data the user wants to read.
        assert to_json_value(["Comedy", "Silent"]) == ["Comedy", "Silent"]


class TestCappingPicksTheConnectedCore:
    """Which nodes survive a cap decides whether the user sees a graph or dust.

    Ranking by degree alone is not enough, and the bipartite case is why: in a
    films-and-people graph the hubs are all on one side and none of them are
    adjacent, so a small cap yields a set with no edges at all.
    """

    @staticmethod
    def _bipartite():
        # 4 films, 4 people, every person in every film: degree ranks all four
        # films above every person.
        edges = [
            {"source": f"film{f}", "target": f"person{p}"}
            for f in range(4)
            for p in range(4)
        ]
        nodes = [f"film{f}" for f in range(4)] + [f"person{p}" for p in range(4)]
        return nodes, edges

    def test_under_the_cap_nothing_is_dropped(self):
        nodes, edges = self._bipartite()
        assert select_connected_core(nodes, edges, 100) == nodes

    def test_a_small_cap_still_yields_edges(self):
        nodes, edges = self._bipartite()
        kept = set(select_connected_core(nodes, edges, 4))
        surviving = [e for e in edges if e["source"] in kept and e["target"] in kept]
        assert len(kept) == 4
        # The whole point: a degree-only cap would keep four films and zero
        # relationships, which renders as confetti.
        assert surviving, "capped graph has no edges — the core was not connected"

    def test_every_kept_node_after_the_seed_touches_the_kept_set(self):
        nodes, edges = self._bipartite()
        kept = select_connected_core(nodes, edges, 5)
        adjacency: dict[str, set[str]] = {}
        for e in edges:
            adjacency.setdefault(e["source"], set()).add(e["target"])
            adjacency.setdefault(e["target"], set()).add(e["source"])
        seen = {kept[0]}
        for node in kept[1:]:
            assert adjacency.get(node, set()) & seen, f"{node} is not adjacent to the core"
            seen.add(node)

    def test_the_same_result_caps_the_same_way_twice(self):
        nodes, edges = self._bipartite()
        assert select_connected_core(nodes, edges, 5) == select_connected_core(
            nodes, edges, 5
        )
