from random import randint
from typing import Annotated

from agent_framework import tool
from pydantic import Field


@tool(approval_mode="never_require")
def hello_world(
    name: Annotated[str, Field(description="The person, team, or event to greet.")] = "world",
) -> str:
    """Return a short demo greeting."""
    return f"Hello, {name}. Your Foundry UI agent tool is wired through AG-UI."


@tool(approval_mode="never_require")
def get_weather(
    location: Annotated[str, Field(description="The location to get the weather for.")],
) -> str:
    """Get the weather for a given location."""
    conditions = ["sunny", "cloudy", "rainy", "stormy"]
    high = randint(10, 30)
    return f"The weather in {location} is {conditions[randint(0, 3)]} with a high of {high} C."


AGENT_TOOLS = [hello_world, get_weather]
