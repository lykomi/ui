"""No model or Azure account required: test the real context-provider boundary."""

import unittest
from types import SimpleNamespace
from agent_framework import (
    AgentSession,
    Message,
    SessionContext,
    Skill,
    SkillFrontmatter,
    SkillsSource,
)
from app.skills import ChatSkillsProvider, get_skills_source


class ExampleSkill(Skill):
    @property
    def frontmatter(self):
        return SkillFrontmatter(name="plan-work", description="Plan the work")

    async def get_content(self):
        return "EXPLICIT_PLAN_INSTRUCTIONS"


class Source(SkillsSource):
    def __init__(self):
        self.allowed = True

    async def get_skills(self, context):
        return [ExampleSkill()] if self.allowed else []


class SkillTests(unittest.IsolatedAsyncioTestCase):
    async def invoke(self, messages, source=None):
        provider = ChatSkillsProvider(source or Source())
        context = SessionContext(
            input_messages=[Message(role="user", contents=[text]) for text in messages]
        )
        await provider.before_run(
            agent=SimpleNamespace(name="test"),
            session=AgentSession(),
            context=context,
            state={},
        )
        return context

    async def test_explicit_selection_loads_the_body_before_model_invocation(self):
        context = await self.invoke(["/plan-work Plan the garden"])
        self.assertIn("EXPLICIT_PLAN_INSTRUCTIONS", "\n".join(context.instructions))

    async def test_normal_chat_only_advertises_the_catalogue(self):
        context = await self.invoke(["Help me plan"])
        self.assertNotIn("EXPLICIT_PLAN_INSTRUCTIONS", "\n".join(context.instructions))
        self.assertIn("load_skill", [tool.name for tool in context.tools])

    async def test_old_selection_does_not_reactivate_on_a_new_message(self):
        context = await self.invoke(["/plan-work Earlier task", "A new request"])
        self.assertNotIn("EXPLICIT_PLAN_INSTRUCTIONS", "\n".join(context.instructions))

    async def test_unknown_or_revoked_skill_is_not_silently_ignored(self):
        with self.assertRaisesRegex(ValueError, "not available"):
            await self.invoke(["/missing Do something"])
        source = Source()
        source.allowed = False
        with self.assertRaisesRegex(ValueError, "not available"):
            await self.invoke(["/plan-work Do something"], source)

    async def test_file_catalogue_and_body_are_real(self):
        from agent_framework import SkillsSourceContext

        skills = await get_skills_source().get_skills(
            SkillsSourceContext(agent=SimpleNamespace(name="test"))
        )
        self.assertEqual([skill.frontmatter.name for skill in skills], ["plan-work"])
        self.assertIn("Read the current page", await skills[0].get_content())
