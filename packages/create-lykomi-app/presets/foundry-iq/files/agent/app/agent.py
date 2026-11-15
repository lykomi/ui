from functools import lru_cache

from .skills import ChatSkillsProvider, get_skills_source

from agent_framework import Agent
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from .foundry_iq import FOUNDRY_IQ_TOOLS
from .tools import AGENT_TOOLS


@lru_cache(maxsize=1)
def get_agent() -> Agent:
    client = FoundryChatClient(credential=DefaultAzureCredential())

    return Agent(
        context_providers=[ChatSkillsProvider(get_skills_source())],
        client=client,
        name="FoundryIQAgent",
        instructions=(
            "You are a concise assistant for a LYKOMI UI app. "
            "Use foundry_iq_search when the user asks about knowledge-base content, "
            "documents, SharePoint-backed content, or retrieval-backed answers. "
            "Use hello_world when the user asks for hello world or a hello demo. "
            "Use get_weather when weather is requested."
        ),
        tools=[*AGENT_TOOLS, *FOUNDRY_IQ_TOOLS],
    )
