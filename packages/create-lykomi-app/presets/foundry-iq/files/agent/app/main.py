from dotenv import load_dotenv
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from .agent import get_agent
from .skills import get_skills_source
from agent_framework import SkillsSourceContext
from .foundry_iq import reset_query_source_authorization, set_query_source_authorization

load_dotenv()

app = FastAPI(title="__PROJECT_NAME__ Agent")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:8010", "http://127.0.0.1:8010"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def foundry_iq_security_trimming_context(request: Request, call_next):
    # x-ms-query-source-authorization is preferred; authorization is a local-dev
    # fallback for passing the signed-in user's bearer token to security trimming.
    query_source_authorization = request.headers.get(
        "x-ms-query-source-authorization"
    ) or request.headers.get("authorization")
    token = set_query_source_authorization(query_source_authorization)
    try:
        return await call_next(request)
    finally:
        reset_query_source_authorization(token)


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
    # This local preset has no sign-in. Use an authorization scope resolver
    # when deploying it with authenticated users.
    single_user=True,
)
