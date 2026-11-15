"""Runtime skills: model discovery and explicit /skill-name activation.

Based on microsoft/agent-framework's python/samples/02-agents/skills/
file_based_skill sample. The same source supplies the catalogue and bodies.
"""

from __future__ import annotations

import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from agent_framework import (
    CachingSkillsSource,
    FileSkillsSource,
    SkillsProvider,
    SkillsSource,
    SkillsSourceContext,
)


class ChatSkillsProvider(SkillsProvider):
    def __init__(self, source: SkillsSource) -> None:
        super().__init__(
            source,
            disable_load_skill_approval=True,
            disable_read_skill_resource_approval=True,
        )
        self.chat_source = source

    async def before_run(
        self, *, agent: Any, session: Any, context: Any, state: dict[str, Any]
    ) -> None:
        await super().before_run(
            agent=agent, session=session, context=context, state=state
        )
        message = next(
            (item for item in reversed(context.input_messages) if item.role == "user"),
            None,
        )
        text = message.text if message is not None else ""
        match = re.match(r"^/([a-z0-9]+(?:-[a-z0-9]+)*)(?=\s|$)", text or "")
        if not match:
            return
        name = match.group(1)
        available = await self.chat_source.get_skills(
            SkillsSourceContext(agent=agent, session=session)
        )
        skill = next(
            (item for item in available if item.frontmatter.name == name), None
        )
        if skill is None:
            raise ValueError(f"Skill /{name} is not available in the current context.")
        body = await skill.get_content()
        if not body.strip():
            raise ValueError(f"Skill /{name} has no instructions.")
        context.extend_instructions(
            self.source_id,
            f"The user explicitly selected /{name} for this request.\n\n{body}",
        )


@lru_cache(maxsize=1)
def get_skills_source() -> CachingSkillsSource:
    return CachingSkillsSource(
        FileSkillsSource(
            skill_paths=str(Path(__file__).resolve().parents[1] / "skills")
        )
    )
