from functools import lru_cache

from agent_framework import Agent
# from agent_framework import MCPStreamableHTTPTool
from agent_framework.foundry import FoundryChatClient
from azure.identity import DefaultAzureCredential

from .tools import AGENT_TOOLS


# To add a remote MCP server, uncomment the dependency in agent/pyproject.toml,
# then uncomment and configure this block. Agent Framework connects the MCP
# server at run time; the AG-UI endpoint exposes the discovered MCP tools.
#
# AGENT_MCP_TOOLS = [
#     MCPStreamableHTTPTool(
#         name="docs",
#         url="https://example.com/mcp",
#         description="Remote MCP tools available to the agent.",
#         allowed_tools=["search_docs"],
#         approval_mode="never_require",
#         # header_provider=lambda _: {"Authorization": "Bearer <token>"},
#     ),
# ]


@lru_cache(maxsize=1)
def get_agent() -> Agent:
    client = FoundryChatClient(credential=DefaultAzureCredential())

    return Agent(
        client=client,
        name="HelloAgent",
        instructions=(
            "You are a concise starter assistant for a Foundry UI app. "
            "Use hello_world when the user asks for hello world or a hello demo. "
            "Use get_weather when weather is requested."
        ),
        tools=[
            *AGENT_TOOLS,
            # *AGENT_MCP_TOOLS,
        ],
    )
