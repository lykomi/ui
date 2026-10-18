# __PROJECT_NAME__

Foundry UI starter: a chat-first React app with a Microsoft Agent Framework service exposed through AG-UI.

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

`FoundryChatClient` reads the Microsoft Agent Framework environment variables directly. The starter passes `DefaultAzureCredential`, so local development works with `az login`. In Azure, use managed identity or the standard service principal environment variables.

## Try It

The first screen is the chat. Try:

- `Say hello world using the hello_world tool`
- `Check the weather in Seattle`
- `What tools can you use?`

The bundled tools live in `agent/app/tools.py`.

## Coding With AI Agents

This app ships `AGENTS.md` (+ a `CLAUDE.md` shim) for coding agents. Claude
Code users can also install the Foundry UI plugin — grounding for the
fast-moving assistant-ui / AG-UI / Agent Framework stack plus a ChatModule
authoring skill:

```
/plugin marketplace add lykomi/ui
/plugin install foundry-ui@foundry-ui
```

## Update Modes

You can use this starter in two modes:

| Mode           | How                                                                    | Best for                                | Updates                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Package-backed | Keep `@iloveagents/foundry-*` dependencies in `package.json`           | Apps that want central Foundry UI fixes | Run `pnpm update @iloveagents/foundry-web-ui @iloveagents/foundry-web-shell @iloveagents/foundry-web-primitives @iloveagents/foundry-agent` |
| Full copy      | Copy this repo or turn the generated app into your own GitHub template | Apps that need deep customization       | You own the code and manually merge upstream ideas                                                                                          |

Template changes such as new files or folder structure are not applied automatically to an existing app. Package updates improve the shared UI, shell, and AG-UI transport without replacing your local `agent/` or `src/` files.

## Theme The App

App name, browser title, logos, colors, radius, and fonts are configured through the `theme` layers in `src/main.tsx`.

```ts
bootstrapShell({
  pages: customerPages,
  authProvider: localDemoAuth,
  agentFetch: fetch,
  theme: [
    {
      id: "app-branding",
      definition: {
        branding: {
          appName: "Foundry UI",
          appTitle: "Foundry UI",
          logoUrl: "/logo.svg",
          darkLogoUrl: "/logo-dark.svg",
        },
        light: {
          primary: "oklch(0.54 0.21 282)",
        },
        radius: {
          radius: "0.5rem",
        },
      },
    },
  ],
});
```

Keep `@import "@iloveagents/foundry-web-ui/styles.css";` in `src/index.css`; it exposes the package theme tokens to Tailwind.

## Talk To It

Voice is wired up and switched on by configuration, not by a flag. Set one
variable and a microphone appears in the composer:

```bash
# .env
VITE_VOICE_PROXY_URL=ws://localhost:8080/ws?model=gpt-realtime
```

Leave it unset and nothing is registered — no microphone, no cost, the app is
exactly what it was.

You need a proxy because a browser cannot put a credential on a WebSocket:

```bash
docker run -p 8080:8080 \
  -e FOUNDRY_RESOURCE_NAME=your-foundry-resource \
  -e FOUNDRY_API_KEY="…" \
  -e ALLOWED_ORIGINS="http://localhost:8010" \
  ghcr.io/iloveagents/foundry-voice-live-proxy:latest
```

> The default model (`gpt-realtime`) is available in **East US 2** and
> **Sweden Central**.

The default mode is **relay**: Voice Live transcribes what you say and speaks
the answer, but *your* agent still answers it. A spoken turn is an ordinary
turn — same tools, same retrieval, same history — so nothing about your agent
changes because the question arrived by microphone. While a call is live the
conversation is replaced by a visualiser (or an avatar, if you configure one)
and comes straight back when you hang up.

Switch to `mode: "realtime"` in `src/main.tsx` to let the Voice Live model
answer directly instead: much faster, but it only knows what your client-side
tools tell it. On laptop speakers add `halfDuplex: true` so the assistant does
not hear itself.

Full options: [`@iloveagents/foundry-web-voice`](https://www.npmjs.com/package/@iloveagents/foundry-web-voice).

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

## Add An MCP Server

`agent/app/agent.py` includes a commented `MCPStreamableHTTPTool` example. To enable a remote MCP server:

1. Uncomment the `mcp` dependency in `agent/pyproject.toml`.
2. Uncomment and configure `AGENT_MCP_TOOLS` in `agent/app/agent.py`.
3. Include `*AGENT_MCP_TOOLS` in the agent `tools` list.

Agent Framework connects the MCP server when the agent runs. The AG-UI endpoint picks up the discovered MCP functions, so they appear as normal agent tools in the chat flow.

## Project Map

```text
agent/                  FastAPI + Microsoft Agent Framework AG-UI endpoint
agent/app/tools.py      Add agent tools here
src/main.tsx            Foundry UI shell bootstrap
src/pages/chat-page.tsx Chat screen and quick starts
src/index.css           Tailwind v4 + Foundry UI theme resource and package dist scanning
```

## Auth

This starter uses local pass-through auth so the demo runs without an Entra app registration.

For production MSAL auth, remove `authProvider` and `agentFetch` from `src/main.tsx`, then set:

```bash
VITE_MSAL_CLIENT_ID=<client-id>
VITE_MSAL_AUTHORITY=https://login.microsoftonline.com/<tenant-id>
VITE_MSAL_API_SCOPE=api://<api-app-id>/access_as_user
```

## Notes

- `AGENTS.md` is the local coding-agent contract.
- `CLAUDE.md` imports `AGENTS.md` for Claude Code.
- Images and documents (PDF/DOCX) are sent to the model as file content. Use `new FileAttachmentAdapter({ documentMode: "metadata" })` if your model cannot accept file input, and elide attachment bytes before persisting chat history.
