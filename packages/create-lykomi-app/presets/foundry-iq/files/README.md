# __PROJECT_NAME__

LYKOMI UI starter with a Microsoft Agent Framework service, AG-UI chat, and a Foundry IQ knowledge base tool.

## Quick Start

```bash
pnpm install
cp agent/.env.example agent/.env
az login
pnpm dev
```

Open `http://localhost:8010`.

`pnpm dev` starts:

- UI: `http://localhost:8010`
- Agent service: `http://localhost:8020`
- AG-UI endpoint: `/api/agent` proxied to the agent service

## Configure Foundry

Edit `agent/.env`:

```bash
FOUNDRY_PROJECT_ENDPOINT=https://<account>.services.ai.azure.com/api/projects/<project>
FOUNDRY_MODEL=gpt-5.4
```

`FoundryChatClient` reads the Microsoft Agent Framework environment variables directly. The starter passes `DefaultAzureCredential`, so local development works with `az login`.

## Configure Foundry IQ

Set the Azure AI Search endpoint and knowledge base name:

```bash
AZURE_AI_SEARCH_ENDPOINT=https://<search-service>.search.windows.net
FOUNDRY_IQ_KNOWLEDGE_BASE=<knowledge-base-name>
```

The tool derives the MCP endpoint documented for Foundry IQ:

```text
${AZURE_AI_SEARCH_ENDPOINT}/knowledgebases/${FOUNDRY_IQ_KNOWLEDGE_BASE}/mcp?api-version=2026-05-01-preview
```

The MCP tool name defaults to `knowledge_base_retrieve`. Override only if your service exposes a different tool:

```bash
FOUNDRY_IQ_MCP_TOOL_NAME=knowledge_base_retrieve
```

For the activity viewer, the starter also calls the documented Azure AI Search retrieve action with `includeActivity: true`:

```text
${AZURE_AI_SEARCH_ENDPOINT}/knowledgebases/${FOUNDRY_IQ_KNOWLEDGE_BASE}/retrieve?api-version=2026-05-01-preview
```

This is real service activity data from the `activity` array. Disable the extra diagnostic call only when you want MCP-only retrieval:

```bash
FOUNDRY_IQ_INCLUDE_ACTIVITY=false
```

## Security Trimming

For remote SharePoint knowledge sources, Foundry IQ requires the `x-ms-query-source-authorization` header. In this starter, `agent/app/main.py` captures the incoming request's `x-ms-query-source-authorization` or `authorization` header and `agent/app/foundry_iq.py` forwards it per request to the MCP endpoint and the retrieve action.

For local development without a signed-in UI user, you can set:

```bash
FOUNDRY_IQ_QUERY_SOURCE_AUTHORIZATION=Bearer <user-token>
```

Do not use that fallback for production multi-user apps. Hosted Foundry Agent Service MCP headers are static in the current preview; for per-user security trimming, keep the per-request forwarding in your app/API layer.

## Try It

The first screen is the chat. Try:

- `Search Foundry IQ for a knowledge base summary`
- `What sources are available in the knowledge base?`
- `Say hello world using the hello_world tool`

The Foundry IQ tool lives in `agent/app/foundry_iq.py`; normal demo tools live in `agent/app/tools.py`.

The chat renders `foundry_iq_search` with a search-results tool card and an expandable activity viewer for tuning query planning, search-source calls, token usage, timings, and result counts. The UI lives in:

```text
src/tools/search-results-tool-ui.tsx
src/tools/foundry-iq-module.tsx
```

Use that pattern for other search/retrieval tools: create a `makeAssistantToolUI` for the tool name, normalize the tool payload in the card, then register it through a `ChatModule` in `src/main.tsx`.

## Add A Tool

Add a function in `agent/app/tools.py` and include it in `AGENT_TOOLS`:

```python
from typing import Annotated

from agent_framework import tool
from pydantic import Field


@tool(approval_mode="never_require")
def get_time(
    city: Annotated[str, Field(description="The city to report time for.")],
) -> str:
    """Return a demo time response."""
    return f"It is demo time in {city}."


AGENT_TOOLS = [hello_world, get_weather, get_time]
```

Restart `pnpm dev` after changing Python dependencies or environment variables. Tool code itself reloads through Uvicorn.

## Project Map

```text
agent/                      FastAPI + Microsoft Agent Framework AG-UI endpoint
agent/app/foundry_iq.py     Foundry IQ MCP retrieval tool
agent/app/tools.py          Add local agent tools here
src/main.tsx                LYKOMI UI shell bootstrap
src/pages/chat-page.tsx     Chat screen and quick starts
src/tools/                  Custom tool cards registered through ChatModules
src/index.css               Tailwind v4 + LYKOMI UI theme resource and package dist scanning
```

## Auth

This starter uses local pass-through auth so the demo runs without an Entra app registration.

For production MSAL auth, remove `authProvider` and `agentFetch` from `src/main.tsx`, then set:

```bash
VITE_MSAL_CLIENT_ID=<client-id>
VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
VITE_MSAL_API_SCOPE=api://<api-app-id>/access_as_user
```

Ensure your authenticated fetch path forwards the user's bearer token to `/api/agent`.

## Component showcase

Run `pnpm dev:web` and open `/showcase` to explore six interactive examples without Azure credentials: forms, collections, dashboards, processes, workbench windows and feedback. The live inspector reads the framework’s actual AG-UI state and available client tools. Select text in a field, filter a table, or change the active window to see the context change. Source panels contain the exact example code, ready to copy.

Connect the agent service with `pnpm dev` to ask about that context or request a guarded draft edit. The inspector works offline; agent replies require your configured backend. Examples use local, disposable data. Saving a form accepts it only in this example; leaving the example resets it. The feedback example explicitly simulates outcomes.

The showcase is a lazy `ChatModule` in `src/showcase/module.tsx`. Remove `showcaseModule` from the imports and `modules` list in `src/main.tsx` to remove its route and navigation; you can then delete `src/showcase/`. Your own app keeps using the same framework components.

## Bundled coding skills

Five repository-local skills ship in both `.agents/skills/` (Codex and compatible tools) and `.claude/skills/` (Claude Code):

- `lykomi-verify-agent-apis`: verify current framework and library APIs.
- `lykomi-author-chat-module`: compose pages, navigation and agent tools.
- `lykomi-build-agent-forms`: build consistent read/edit forms with automatic field context and guarded edits.
- `lykomi-build-workbench`: connect windows, tables and processes to visible context.
- `lykomi-verify-ui`: verify real browser behavior, context and package boundaries.

These guide your coding assistant; they are not runtime tools for the chat agent. They install only in this project and do not change global configuration. The optional Claude Code plugin adds documentation MCP servers; it is not required for these bundled skills. Keep project-specific adaptations in your generated app.
