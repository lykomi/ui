import os
from functools import lru_cache

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from .tools import AGENT_TOOLS


@lru_cache(maxsize=1)
def get_agent() -> Agent:
    project_endpoint = (
        os.getenv("FOUNDRY_PROJECT_ENDPOINT")
        or os.getenv("PROJECT_ENDPOINT")
    )
    model = (
        os.getenv("FOUNDRY_MODEL")
        or os.getenv("FOUNDRY_MODEL_DEPLOYMENT_NAME")
        or os.getenv("MODEL_DEPLOYMENT_NAME")
        or "gpt-5.4"
    )

    if not project_endpoint:
        raise RuntimeError(
            "FOUNDRY_PROJECT_ENDPOINT is not set. Copy agent/.env.example to "
            "agent/.env and set your Foundry project endpoint."
        )

    client = FoundryChatClient(
        project_endpoint=project_endpoint,
        model=model,
        credential=DefaultAzureCredential(),
    )

    return Agent(
        client=client,
        name="HelloAgent",
        instructions=(
            "You are a concise starter assistant for a Foundry UI app. "
            "Use hello_world when the user asks for hello world or a hello demo. "
            "Use get_weather when weather is requested."
        ),
        tools=AGENT_TOOLS,
    )
