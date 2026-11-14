"""Shared fixtures.

The suite is split in two on purpose. Pure tests run anywhere and need no
database. Live tests need a real Neo4j and SKIP without one, so a user who
clones the starter and runs ``pytest`` gets a green, meaningful run before they
have started anything — and CI, which does start a database, gets the rest.

Nothing here fakes a driver type. ``neo4j.graph.Node`` and friends are built by
the driver's own hydration, and a hand-built stand-in would assert against a
shape the server may not actually send — which is one of the things these tests
exist to catch.
"""

from __future__ import annotations

import pytest

from app import graph_db


@pytest.fixture(autouse=True)
async def _fresh_driver_per_test():
    """Close the process-wide pool after every test. Function scope, on purpose.

    The driver is a module global created lazily, and its sockets belong to the
    event loop that created them. pytest-asyncio gives each test its own loop,
    so a driver held across tests is a pool bound to a loop that has already
    closed — which fails in whichever test happens to run second, and looks
    like a flaky database rather than a fixture bug.

    A fresh pool per test costs a connection handshake and buys an
    order-independent suite.
    """
    yield
    await graph_db.close_driver()
