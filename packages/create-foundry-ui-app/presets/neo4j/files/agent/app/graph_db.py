"""Neo4j connection, guardrails, and query execution.

One driver for the process, read and write paths kept apart, and every query
bounded in time and size. Works unchanged against a local Neo4j container and
against Neo4j Aura — only ``NEO4J_URI`` differs.
"""

from __future__ import annotations

import logging
import os
import re
from typing import Any

import neo4j

logger = logging.getLogger(__name__)

_driver: neo4j.AsyncDriver | None = None


def _env_int(name: str, default: int) -> int:
    raw = os.getenv(name)
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        logger.warning("%s=%r is not an integer; using %d", name, raw, default)
        return default


def max_nodes() -> int:
    return _env_int("NEO4J_MAX_NODES", 300)


def max_edges() -> int:
    return _env_int("NEO4J_MAX_EDGES", 600)


def max_rows() -> int:
    return _env_int("NEO4J_MAX_ROWS", 200)


def query_timeout_seconds() -> int:
    return _env_int("NEO4J_QUERY_TIMEOUT_SECONDS", 15)


def database() -> str:
    return os.getenv("NEO4J_DATABASE") or "neo4j"


def writes_enabled() -> bool:
    return (os.getenv("NEO4J_ALLOW_WRITES") or "").strip().lower() in {"1", "true", "yes"}


def get_driver() -> neo4j.AsyncDriver:
    """The process-wide driver. Created on first use, closed by the app lifespan.

    The driver owns a connection pool and is designed to be long-lived — one per
    application, not one per request.
    """
    global _driver
    if _driver is None:
        uri = os.getenv("NEO4J_URI")
        if not uri:
            raise RuntimeError(
                "NEO4J_URI is not set. Copy agent/.env.example to agent/.env and fill it in, "
                "or run `docker compose up -d` for a local database."
            )
        _driver = neo4j.AsyncGraphDatabase.driver(
            uri,
            auth=(os.getenv("NEO4J_USERNAME") or "neo4j", os.getenv("NEO4J_PASSWORD") or ""),
            connection_acquisition_timeout=30,
            max_transaction_retry_time=15,
        )
    return _driver


async def close_driver() -> None:
    """Release the connection pool. Called from the FastAPI lifespan."""
    global _driver
    if _driver is not None:
        await _driver.close()
        _driver = None


# --------------------------------------------------------------------------
# Write detection (defence in depth — NOT the security boundary)
# --------------------------------------------------------------------------

_WRITE_KEYWORDS = (
    "create",
    "merge",
    "delete",
    "detach",
    "set",
    "remove",
    "drop",
    "foreach",
)

# Procedures that write, or reach outside the database, without using a
# write keyword. `CALL ... IN TRANSACTIONS` is separate because it is the
# documented way to run a write in batches.
_DANGEROUS_CALL = re.compile(
    r"\b(?:load\s+csv|call\s*\{[^}]*\}\s*in\s+transactions|call\s+(?:dbms|apoc\.(?:load|trigger|periodic|refactor))\b)",
    re.IGNORECASE | re.DOTALL,
)

_COMMENT = re.compile(r"/\*.*?\*/|//[^\n]*", re.DOTALL)
_STRING = re.compile(r"'(?:[^'\\]|\\.)*'|\"(?:[^\"\\]|\\.)*\"", re.DOTALL)
_WORD = re.compile(r"[A-Za-z_][A-Za-z0-9_]*")


def strip_noise(cypher: str) -> str:
    """Remove comments and string literals before scanning for keywords.

    Without this, ``MATCH (n) WHERE n.note = 'please delete me' RETURN n`` reads
    as a write, and ``MATCH (n) //CREATE`` reads as one too.
    """
    return _STRING.sub(" ", _COMMENT.sub(" ", cypher))


def looks_like_write(cypher: str) -> bool:
    """Best-effort check for a mutating statement.

    This exists to give the model a clear, actionable message instead of a
    driver stack trace — it is NOT what keeps a read-only tool read-only. That
    is the server, via ``READ`` access mode (see :func:`run_read`). A regex is
    not a Cypher parser and must never be treated as one.
    """
    text = strip_noise(cypher)
    if _DANGEROUS_CALL.search(text):
        return True
    return any(word.lower() in _WRITE_KEYWORDS for word in _WORD.findall(text))


class WriteNotAllowed(RuntimeError):
    """Raised when a read-only tool is handed a mutating statement."""


# --------------------------------------------------------------------------
# Execution
# --------------------------------------------------------------------------


async def run_read(
    cypher: str,
    parameters: dict[str, Any] | None = None,
    *,
    row_limit: int | None = None,
) -> list[neo4j.Record]:
    """Run a read-only query.

    Read-only is enforced by the SERVER: the session opens in ``READ`` access
    mode, and a write raises ``Neo.ClientError.Statement.AccessMode`` before
    anything is committed. The keyword scan above only front-runs that with a
    friendlier message.
    """
    if looks_like_write(cypher):
        raise WriteNotAllowed(
            "This tool runs read-only queries. Rewrite the statement using MATCH/RETURN, "
            "or use the write tool if it is enabled."
        )

    limit = row_limit if row_limit is not None else max_rows()
    query = neo4j.Query(cypher, timeout=query_timeout_seconds())
    driver = get_driver()
    async with driver.session(
        database=database(), default_access_mode=neo4j.READ_ACCESS
    ) as session:
        result = await session.run(query, parameters or {})
        rows: list[neo4j.Record] = []
        async for record in result:
            rows.append(record)
            # Stop pulling rather than rewriting the statement with a LIMIT —
            # injecting one into arbitrary Cypher (unions, subqueries, an
            # existing LIMIT) goes wrong in ways that are hard to see.
            if len(rows) >= limit:
                break
        await result.consume()
        return rows


async def run_write(
    cypher: str, parameters: dict[str, Any] | None = None, row_limit: int | None = None
) -> tuple[list[dict[str, Any]], dict[str, int]]:
    """Run a mutating query; return its rows AND the counters.

    The rows matter as much as the counters. A write that ends `RETURN a, r, b`
    hands back exactly the nodes and relationships it just created, which is
    what lets "add Fritz Lang and connect him to Metropolis" render as the
    changed piece of graph rather than as `{"nodes_created": 1}`. Callers gate
    on :func:`writes_enabled` before exposing this.
    """
    query = neo4j.Query(cypher, timeout=query_timeout_seconds())
    driver = get_driver()
    cap = row_limit if row_limit is not None else max_rows()
    rows: list[dict[str, Any]] = []
    async with driver.session(
        database=database(), default_access_mode=neo4j.WRITE_ACCESS
    ) as session:
        result = await session.run(query, parameters or {})
        async for record in result:
            if len(rows) >= cap:
                break
            rows.append(dict(record))
        summary = await result.consume()
        counters = summary.counters
        return rows, {
            "nodes_created": counters.nodes_created,
            "nodes_deleted": counters.nodes_deleted,
            "relationships_created": counters.relationships_created,
            "relationships_deleted": counters.relationships_deleted,
            "properties_set": counters.properties_set,
            "labels_added": counters.labels_added,
            "labels_removed": counters.labels_removed,
        }


_CREDENTIAL_LIKE = re.compile(
    r"(neo4j(?:\+s|\+ssc)?://[^\s]*|bolt(?:\+s|\+ssc)?://[^\s]*|password[^\s,;]*)",
    re.IGNORECASE,
)


def safe_error(exc: Exception) -> str:
    """A message the model can act on, with connection details removed.

    Driver errors routinely echo the URI and occasionally the auth token. That
    text goes back into the conversation and into any transcript store, so it
    gets scrubbed before it leaves this module.
    """
    return _CREDENTIAL_LIKE.sub("<redacted>", f"{type(exc).__name__}: {exc}")
