This is a LYKOMI UI starter app with Foundry IQ retrieval: React chat UI, AG-UI transport, Microsoft Agent Framework, and an Azure AI Search knowledge base MCP tool.

# Architecture

```text
src/main.tsx              LYKOMI UI shell bootstrap
src/pages/chat-page.tsx   Chat screen and Foundry IQ starter prompts
src/index.css             Tailwind v4 plus @lykomi/web-ui/styles.css
src/tools/                Foundry IQ search result tool card and ChatModule registration
agent/app/main.py         FastAPI app, AG-UI endpoint, and request header capture
agent/app/agent.py        FoundryChatClient + Agent configuration
agent/app/foundry_iq.py   Foundry IQ MCP retrieval tool
agent/app/tools.py        Local Agent Framework tools; update AGENT_TOOLS here
```

# Run

```bash
pnpm install
cp agent/.env.example agent/.env
az login
pnpm dev
```

The UI runs on `http://localhost:8010`. The agent service runs on `http://localhost:8020`; Vite proxies `/api/agent` to it.

# Environment

Set these in `agent/.env`:

```bash
FOUNDRY_PROJECT_ENDPOINT=https://<account>.services.ai.azure.com/api/projects/<project>
FOUNDRY_MODEL=gpt-5.4
AZURE_AI_SEARCH_ENDPOINT=https://<search-service>.search.windows.net
FOUNDRY_IQ_KNOWLEDGE_BASE=<knowledge-base-name>
```

`FoundryChatClient` reads its Microsoft Agent Framework env vars directly. Do not add duplicate manual env probing unless Agent Framework removes that behavior.

# Foundry IQ

- The Foundry IQ MCP endpoint is derived as `${AZURE_AI_SEARCH_ENDPOINT}/knowledgebases/${FOUNDRY_IQ_KNOWLEDGE_BASE}/mcp?api-version=2026-05-01-preview`.
- The MCP tool name defaults to `knowledge_base_retrieve`.
- The activity viewer uses the documented retrieve action with `includeActivity: true`; never synthesize activity rows.
- `agent/app/foundry_iq.py` uses Azure AI Search AAD auth with `DefaultAzureCredential`.
- For remote SharePoint knowledge sources, forward the signed-in user's token per request through `x-ms-query-source-authorization` or `authorization` on `/api/agent` to both MCP and retrieve calls.
- Hosted Foundry Agent Service MCP headers are static in the current preview. Do not claim that a hosted agent can vary MCP headers per request.

# Agent Tools

- Add local tools in `agent/app/tools.py`.
- Decorate local tools with `@tool(approval_mode="never_require")` unless you intentionally add an approval flow.
- Add new local tools to `AGENT_TOOLS`; otherwise the agent cannot call them.
- Keep the Foundry IQ tool in `agent/app/foundry_iq.py` unless you are changing retrieval behavior.

# UI

- Keep the starter chat-first. Do not add landing pages, marketing heroes, or domain-specific clutter.
- Configure quick starts in `src/pages/chat-page.tsx`.
- Keep the `foundry_iq_search` tool card and activity viewer in `src/tools/search-results-tool-ui.tsx`. If the tool output shape changes, normalize it there instead of leaking Foundry IQ-specific parsing into the shared package.
- Configure app name, browser title, logos, colors, radius, and fonts through `theme` layers in `src/main.tsx`.
- Keep `@source "../node_modules/@iloveagents/.../dist"` entries in `src/index.css`; Tailwind v4 needs them to scan package component classes.
- Keep `@import "@lykomi/web-ui/styles.css";`; it provides the LYKOMI UI theme tokens.

# Checks

```bash
pnpm typecheck
pnpm build
```

Use browser verification for layout or chat-flow changes.

## Local skills and examples

Use the repository-local skills in `.agents/skills/` or `.claude/skills/` for grounding, ChatModules, agent-aware forms, workbenches and browser verification. Their bundled form UX references describe the shared component contract. These are coding-assistant instructions, not runtime chat skills.

`src/showcase/` is a removable, lazy example module. Its inspector reads actual framework state. Keep privacy opt-outs, expected-value checks and read/edit boundaries when adapting an example. Run `pnpm dev:web` to explore without an agent; real replies need the configured service.
