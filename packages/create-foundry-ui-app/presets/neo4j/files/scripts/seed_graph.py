"""Load a small demo graph so the starter has something to show.

Run once against an empty database:

    uv run --project agent python scripts/seed_graph.py

Idempotent — it MERGEs, so running it twice changes nothing. Pass ``--reset``
to clear the database first.

The dataset is a handful of films, the people who made them, and their genres:
big enough to show labels, relationship types and hubs, small enough to read.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
from pathlib import Path

import neo4j

# Films, their year, director, and cast. Public-domain-era and widely known, so
# the demo reads the same to everyone.
MOVIES: list[dict[str, object]] = [
    {
        "title": "Metropolis",
        "year": 1927,
        "genres": ["Science Fiction", "Drama"],
        "director": "Fritz Lang",
        "cast": ["Brigitte Helm", "Gustav Fröhlich", "Alfred Abel"],
        "tagline": "A vast city runs on the labour of workers hidden beneath it.",
    },
    {
        "title": "Nosferatu",
        "year": 1922,
        "genres": ["Horror"],
        "director": "F. W. Murnau",
        "cast": ["Max Schreck", "Greta Schröder"],
        "tagline": "A shadow spreads from the Carpathians to a quiet harbour town.",
    },
    {
        "title": "The Cabinet of Dr. Caligari",
        "year": 1920,
        "genres": ["Horror", "Mystery"],
        "director": "Robert Wiene",
        "cast": ["Werner Krauss", "Conrad Veidt"],
        "tagline": "A carnival hypnotist and a sleepwalker who murders on command.",
    },
    {
        "title": "The General",
        "year": 1926,
        "genres": ["Comedy", "Action"],
        "director": "Buster Keaton",
        "cast": ["Buster Keaton", "Marion Mack"],
        "tagline": "An engineer chases his stolen locomotive through the front line.",
    },
    {
        "title": "Sunrise",
        "year": 1927,
        "genres": ["Drama", "Romance"],
        "director": "F. W. Murnau",
        "cast": ["George O'Brien", "Janet Gaynor"],
        "tagline": "A farmer is talked into a crime and spends a day undoing it.",
    },
    {
        "title": "Battleship Potemkin",
        "year": 1925,
        "genres": ["Drama", "History"],
        "director": "Sergei Eisenstein",
        "cast": ["Aleksandr Antonov", "Vladimir Barsky"],
        "tagline": "A mutiny over rotten meat becomes an uprising.",
    },
    {
        "title": "The Gold Rush",
        "year": 1925,
        "genres": ["Comedy", "Adventure"],
        "director": "Charlie Chaplin",
        "cast": ["Charlie Chaplin", "Georgia Hale"],
        "tagline": "A prospector looks for fortune and finds a boot for dinner.",
    },
    {
        "title": "Sherlock Jr.",
        "year": 1924,
        "genres": ["Comedy", "Mystery"],
        "director": "Buster Keaton",
        "cast": ["Buster Keaton", "Kathryn McGuire"],
        "tagline": "A projectionist walks into the film he is showing.",
    },
]

SEED_CYPHER = """
UNWIND $movies AS movie
MERGE (m:Movie {title: movie.title})
  SET m.year = movie.year, m.tagline = movie.tagline
MERGE (d:Person {name: movie.director})
MERGE (d)-[:DIRECTED]->(m)
WITH m, movie
UNWIND movie.genres AS genreName
  MERGE (g:Genre {name: genreName})
  MERGE (m)-[:IN_GENRE]->(g)
WITH DISTINCT m, movie
UNWIND movie.cast AS actorName
  MERGE (a:Person {name: actorName})
  MERGE (a)-[:ACTED_IN]->(m)
"""

CONSTRAINTS = [
    "CREATE CONSTRAINT movie_title IF NOT EXISTS FOR (m:Movie) REQUIRE m.title IS UNIQUE",
    "CREATE CONSTRAINT person_name IF NOT EXISTS FOR (p:Person) REQUIRE p.name IS UNIQUE",
    "CREATE CONSTRAINT genre_name IF NOT EXISTS FOR (g:Genre) REQUIRE g.name IS UNIQUE",
]


def load_env() -> None:
    """Read agent/.env if present, without adding a dependency for it."""
    env_path = Path(__file__).resolve().parent.parent / "agent" / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip('"').strip("'"))


def _quote_identifier(name: str) -> str:
    """Backtick-quote an index name for a statement that cannot parameterise it.

    Cypher takes no parameter in an index name, so it has to be interpolated —
    the one place in this script where a value reaches the query as text. The
    value is a developer's own `.env` setting rather than user input, so this
    is about the failure that actually happens: a name with a space or a
    hyphen produces an opaque Cypher syntax error a long way from its cause.
    Quoting makes those names work, and doubling any backtick keeps a name
    that contains one from ending the quote early.
    """
    if not name.strip():
        raise ValueError("NEO4J_VECTOR_INDEX is empty.")
    if "\n" in name or "\r" in name:
        raise ValueError(f"NEO4J_VECTOR_INDEX must be a single line, got {name!r}.")
    return "`" + name.replace("`", "``") + "`"


async def embed_and_index(driver: neo4j.AsyncDriver, database: str) -> None:
    """Add embeddings and a vector index, when an embedding model is configured.

    Optional on purpose: the graph demo works with nothing but a local database,
    and asking for cloud credentials before the first query would undercut that.
    """
    model = os.getenv("FOUNDRY_EMBEDDING_MODEL")
    index_name = os.getenv("NEO4J_VECTOR_INDEX")
    if not model or not index_name:
        print("Skipping embeddings — set FOUNDRY_EMBEDDING_MODEL and NEO4J_VECTOR_INDEX to enable.")
        return

    sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "agent"))
    from app.graph_tools import embed_query  # noqa: PLC0415

    print(f"Embedding {len(MOVIES)} taglines with {model}…")
    vectors = {m["title"]: await embed_query(str(m["tagline"])) for m in MOVIES}
    dimensions = len(next(iter(vectors.values())))

    async with driver.session(database=database) as session:
        await session.run(
            "UNWIND keys($vectors) AS title "
            "MATCH (m:Movie {title: title}) "
            "CALL db.create.setNodeVectorProperty(m, 'embedding', $vectors[title])",
            {"vectors": vectors},
        )
        await session.run(
            f"CREATE VECTOR INDEX {_quote_identifier(index_name)} IF NOT EXISTS "
            "FOR (m:Movie) ON (m.embedding) "
            "OPTIONS {indexConfig: {"
            "`vector.dimensions`: $dimensions, "
            "`vector.similarity_function`: 'cosine'}}",
            {"dimensions": dimensions},
        )
    print(f"Vector index '{index_name}' created ({dimensions} dimensions).")


async def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="Delete everything first.")
    args = parser.parse_args()

    load_env()
    uri = os.getenv("NEO4J_URI")
    if not uri:
        print("NEO4J_URI is not set. Copy agent/.env.example to agent/.env first.", file=sys.stderr)
        return 1

    database = os.getenv("NEO4J_DATABASE") or "neo4j"
    driver = neo4j.AsyncGraphDatabase.driver(
        uri,
        auth=(os.getenv("NEO4J_USERNAME") or "neo4j", os.getenv("NEO4J_PASSWORD") or ""),
    )
    try:
        await driver.verify_connectivity()
        async with driver.session(database=database) as session:
            if args.reset:
                await session.run("MATCH (n) DETACH DELETE n")
                print("Cleared the database.")
            for statement in CONSTRAINTS:
                await session.run(statement)
            await session.run(SEED_CYPHER, {"movies": MOVIES})
            counts = await session.run(
                "MATCH (n) WITH count(n) AS nodes "
                "MATCH ()-[r]->() RETURN nodes, count(r) AS rels"
            )
            record = await counts.single()
            print(f"Seeded {record['nodes']} nodes and {record['rels']} relationships.")
        await embed_and_index(driver, database)
    finally:
        await driver.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
