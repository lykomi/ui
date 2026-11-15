from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .agent import get_agent
from .skills import get_skills_source
from agent_framework import SkillsSourceContext

load_dotenv()

app = FastAPI(title="__PROJECT_NAME__ Agent")

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
    # The scaffold does not set a reasoning level or context-window limit.
    # Leave those values unknown until the app's backend can report them.
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
    # This local starter deliberately has no user sign-in. An authenticated
    # deployment must replace this with an authorization scope resolver.
    single_user=True,
)
