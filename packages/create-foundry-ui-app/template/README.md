# __PROJECT_NAME__

Scaffolded by [`create-foundry-ui-app`](https://www.npmjs.com/package/create-foundry-ui-app) — a Foundry UI starter built on the AG-UI protocol, Microsoft Agent Framework, and Azure AI Foundry.

## Quick start

```bash
pnpm install
pnpm dev
```

The app boots at `http://localhost:8010`. The default page is the Foundry UI `ChatPanel` — connect it to a backend (e.g. a FastAPI app exposing the AG-UI endpoint via `agent_framework.ag_ui`) to see real chat.

## Auth

The shell expects MSAL config from environment variables:

```
VITE_MSAL_CLIENT_ID=<your Entra app's client id>
VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
VITE_MSAL_API_SCOPE=api://<api-app-id>/access_as_user
```

Without these, the shell renders an `AuthConfigError` UI on first load.

## What's bundled

| Package | Purpose |
|---|---|
| `@iloveagents/foundry-web-shell` | Browser bootstrap (`bootstrapShell`) |
| `@iloveagents/foundry-web-ui` | React UI core — `ChatPanel`, sidebar, hooks |
| `@iloveagents/foundry-web-primitives` | Leaf primitives — Button, Input, etc. |
| `@iloveagents/foundry-agent` | Cross-runtime AG-UI transport (no DOM, no React) |

All consumed from npm at `^0.1.0`. Source: [`iloveagents/foundry-ui`](https://github.com/iLoveAgents/foundry-ui).

## Add a backend

Pair this with a Python FastAPI backend using the Microsoft Agent Framework + AG-UI mount:

```python
from agent_framework import Agent
from agent_framework.azure import AzureOpenAIResponsesClient
from agent_framework.ag_ui import add_agent_framework_fastapi_endpoint
from fastapi import FastAPI

app = FastAPI()
agent = Agent(client=AzureOpenAIResponsesClient(...), instructions="...", tools=[...])
add_agent_framework_fastapi_endpoint(app, agent, path="/api/agent")
```

The shell's default `defaultAgentFetch` POSTs to `/api/agent` — point your dev proxy at the backend.

## Add Spaces (LastSpace.ai commercial)

To add the LastSpace Spaces module (private commercial extension — agentic CMS, document intelligence, workflow execution), use the `lastspace` preset instead of the default:

```bash
npx create-foundry-ui-app my-app --preset lastspace
```

Requires `FOUNDRY_UI_TOKEN` env var (per-customer PAT). See [LastSpace customer docs](https://github.com/ltwlf/lastspace).

## License

SEE LICENSE IN LICENSE — fill in your own.

## Next

- Add your customer pages in `src/pages/`.
- Add ChatModules to `bootstrapShell({ modules: [...] })` in `src/main.tsx`.
- Connect a real AG-UI backend (Python FastAPI + Agent Framework).
- Configure Entra auth.
