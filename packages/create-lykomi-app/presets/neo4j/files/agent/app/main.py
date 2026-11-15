from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .agent import get_agent
from .skills import get_skills_source
from agent_framework import SkillsSourceContext
from .graph_db import close_driver


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Close the Neo4j connection pool on shutdown.

    The driver is a long-lived singleton — one pool for the process, not one
    per request. Without this, a reload in dev leaves the old pool's sockets
    open and the server eventually runs out of connections.
    """
    yield
    await close_driver()


app = FastAPI(title="__PROJECT_NAME__ Agent", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8010", "http://127.0.0.1:8010"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATE_SCHEMA = {
    "navigation": {
        "type": "object",
        "description": "Current app route and navigation metadata from LYKOMI UI.",
        "additionalProperties": True,
    },
    "selectedItemId": {
        "type": ["string", "null"],
        "description": "The currently selected UI item, if any.",
    },
    "content": {
        "type": "object",
        "description": "Shared draft/form content maintained by the UI.",
        "additionalProperties": True,
    },
    "highlights": {
        "type": "array",
        "description": "Entity IDs highlighted by the UI or agent.",
        "items": {"type": "string"},
    },
    "contextItems": {
        "type": "array",
        "description": "User-pinned or page-provided context items for the current turn.",
        "items": {"type": "object", "additionalProperties": True},
    },
}


@app.get("/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/chat/config")
async def chat_config() -> dict[str, object]:
    skills = await get_skills_source().get_skills(
        SkillsSourceContext(agent=get_agent())
    )
    return {
        "skills": [
            {
                "name": skill.frontmatter.name,
                "description": skill.frontmatter.description,
                "scope": "app",
            }
            for skill in skills
        ]
    }


try:
    from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint
except ImportError:
    from agent_framework_ag_ui import add_agent_framework_fastapi_endpoint

add_agent_framework_fastapi_endpoint(
    app,
    get_agent(),
    path="/api/agent",
    state_schema=STATE_SCHEMA,
)
