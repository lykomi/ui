# __PROJECT_NAME__

LYKOMI UI starter: a React app with a Home composer, a contextual Guide page,
and a Microsoft Agent Framework service exposed through AG-UI.

## Quick Start

```bash
pnpm install
cp agent/.env.example agent/.env
# Set your Foundry project endpoint and model deployment in agent/.env.
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
FOUNDRY_MODEL=<model-deployment-name>
```

`FoundryChatClient` reads the Microsoft Agent Framework environment variables directly. The starter passes `DefaultAzureCredential`, so local development works with `az login`. In Azure, use managed identity or the standard service principal environment variables.

## Try It

Home opens with the chat composer and three clickable prompts. The Guide route shows how a page sits beside the same persistent conversation, with real workbench tabs and resizable panels. Try:

- `Say hello world using the hello_world tool`
- `Check the weather in Seattle`
- `What tools can you use?`

The bundled tools live in `agent/app/tools.py`.

The starter registers Guide navigation, page context, and an “About this starter” item in the lower interface menu through `src/starter-module.ts`. Open **Working draft** and **Architecture**, select **Edit draft**, change the fields, then select **Panels**. Pin, reorder and resize windows; switch back to **Tabs** or visit Home and return. The draft stays in memory until you close it or reload. Closing an edited draft asks before discarding it. `src/pages/guide-windows.ts` owns the app data; `WindowWorkbench` and `createWindowStore` from `@lykomi/web-ui` provide the shared window behaviour. The active window context, including the draft text, accompanies an AG-UI turn. Connect your own storage service before treating the draft as saved. Local demo auth has no user identity, so that control is an interface menu; after you wire real auth, the same menu shows the signed-in user and sign-out action.

## Form fields and agent context

Open **Guide → Working draft → Edit draft**. Focus **Your idea**, select a few words,
then open chat and ask “Make this idea more specific”. The context indicator shows
**Your idea**; the AG-UI request includes its field path, current value and selected
text. The active window also supplies the named form fields and edit mode.

`Field` and `ReadOnlyField` automatically supply the selected field context through
`@lykomi/web-ui`. No per-field focus handlers or context hook are required.
`src/pages/use-draft-tools.ts` uses `usePageTools` for the app-owned edits. Its `page_update_draft_field` tool validates the field and
checks that its current value still matches the value the agent read. Updates
appear in the same inputs you edit manually. **Save draft** accepts the changes
in memory; **Cancel** restores the previous values. Closing the draft or switching
to another window removes its field context and tools. Moving into chat keeps them.

Wrap native inputs in `Field` to get automatic field context. Use
`agentContext={false}` on `Field` or `ReadOnlyField` for sensitive values;
password inputs are always excluded. Your app owns validation and persistence.
Connect an authenticated storage service before saving remotely.

## Coding With AI Agents

This app ships `AGENTS.md` (+ a `CLAUDE.md` shim) for coding agents. Claude
Code users can also install the LYKOMI UI plugin — grounding for the
fast-moving assistant-ui / AG-UI / Agent Framework stack plus a ChatModule
authoring skill:

```
/plugin marketplace add lykomi/ui
/plugin install lykomi-ui@lykomi-ui
```

## Update Modes

You can use this starter in two modes:

| Mode           | How                                                                    | Best for                                | Updates                                                                                                                                     |
| -------------- | ---------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Package-backed | Keep `@lykomi/*` dependencies in `package.json`           | Apps that want central LYKOMI UI fixes | Run `pnpm update @lykomi/web-ui @lykomi/web-shell @lykomi/web-primitives @lykomi/agent` |
| Full copy      | Copy this repo or turn the generated app into your own GitHub template | Apps that need deep customization       | You own the code and manually merge upstream ideas                                                                                          |

Template changes such as new files or folder structure are not applied automatically to an existing app. Package updates improve the shared UI, shell, and AG-UI transport without replacing your local `agent/` or `src/` files.

## Theme The App

The starter uses LYKOMI's neutral and deep-petrol palette, light and dark V2 favicons, and a locally bundled, OFL-licensed Manrope font. Change the app name, browser title, colors, radius, and fonts in `src/theme.ts`; add logo assets under `public/` and reference them in the theme's `branding` entry.

```ts
export const starterTheme: ThemeLayer = {
  id: "my-app",
  definition: {
    light: { primary: "#3F666B" },
    branding: { appName: "My app", appTitle: "My app" },
  },
};
```

Keep `@import "@lykomi/web-ui/styles.css";` in `src/index.css`; it exposes the package theme tokens to Tailwind.

## Talk To It

Voice is wired up and switched on by configuration, not by a flag. Set one
variable and a microphone appears in the composer:

```bash
# .env
VITE_VOICE_PROXY_URL=ws://localhost:8080/ws?model=your-voice-deployment
```

Leave it unset and nothing is registered — no microphone, no cost, the app is
exactly what it was.

You need a proxy because a browser cannot put a credential on a WebSocket:

```bash
docker run -p 8080:8080 \
  -e FOUNDRY_RESOURCE_NAME=your-foundry-resource \
  -e FOUNDRY_API_KEY="…" \
  -e ALLOWED_ORIGINS="http://localhost:8010" \
  ghcr.io/iloveagents/foundry-voice-live-proxy:0.7.0
```

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

Full options: [`@lykomi/web-voice`](https://www.npmjs.com/package/@lykomi/web-voice).

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
src/main.tsx            LYKOMI UI shell bootstrap
src/theme.ts             App colors, typography, and branding
src/pages/starter-prompts.tsx  Home quick starts
src/pages/guide-page.tsx       A page beside the persistent chat
src/starter-module.ts          Guide navigation and agent context
src/pages/chat-page.tsx  Chat route
src/index.css           Tailwind v4 + LYKOMI UI theme resource and package dist scanning
public/fonts/            Manrope and its OFL license
```

## Auth

This starter uses local pass-through auth so the demo runs without an Entra app registration.

The AG-UI endpoint declares `single_user=True` for this local demo. Before serving multiple users, replace that setting with an authorization scope resolver and protect the API with your chosen auth scheme. A browser-only MSAL setup does not protect the FastAPI endpoint by itself.

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
