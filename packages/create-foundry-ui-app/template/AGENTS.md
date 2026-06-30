This is a Foundry UI starter app: React chat UI, AG-UI transport, and a Microsoft Agent Framework service.

# Architecture

```text
src/main.tsx              Foundry UI shell bootstrap
src/pages/chat-page.tsx   Chat screen and starter prompts
src/index.css             Tailwind v4 plus @iloveagents/foundry-web-ui/styles.css
agent/app/main.py         FastAPI app and AG-UI endpoint
agent/app/agent.py        FoundryChatClient + Agent configuration
agent/app/tools.py        Agent Framework tools; update AGENT_TOOLS here
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
```

`FoundryChatClient` reads the Microsoft Agent Framework env vars directly. The Python agent passes `DefaultAzureCredential`; prefer `az login` locally and managed identity or service principal env vars in hosted environments.

# Agent Tools

- Add tools in `agent/app/tools.py`.
- Decorate tools with `@tool(approval_mode="never_require")` unless you intentionally add an approval flow.
- Add new tools to `AGENT_TOOLS`; otherwise the agent cannot call them.
- For remote MCP tools, use the commented `MCPStreamableHTTPTool` block in `agent/app/agent.py` and uncomment the `mcp` dependency in `agent/pyproject.toml`.
- Keep starter tools deterministic enough for demos. If a tool calls a real service, handle errors with clear user-facing strings.

# Update Modes

- Package-backed mode: keep `@iloveagents/foundry-*` dependencies and update them through npm/pnpm for central fixes to UI, shell, theme resources, and AG-UI transport.
- Copy/template mode: once this app is copied into its own GitHub template or deeply customized repo, local `src/` and `agent/` files are owned by that repo. Pull upstream starter ideas manually.
- Package updates must not overwrite local app code. Template structure changes only apply when a new app is scaffolded or manually merged.

# UI

- Keep the starter chat-first. Do not add landing pages, marketing heroes, or domain-specific clutter.
- Configure quick starts in `src/pages/chat-page.tsx`.
- Configure app name, browser title, logos, colors, radius, and fonts through `theme` layers in `src/main.tsx`.
- Keep the default generated app name and browser title as `Foundry UI` unless the app is intentionally rebranded.
- Use Foundry UI components from `@iloveagents/foundry-web-ui` and primitives from `@iloveagents/foundry-web-primitives`.
- Keep `@source "../node_modules/@iloveagents/.../dist"` entries in `src/index.css`; Tailwind v4 needs them to scan package component classes.
- Keep `@import "@iloveagents/foundry-web-ui/styles.css";`; it provides the Foundry UI theme tokens.

# Attachments

Image attachments are sent as model-visible image content. Non-image documents are sent as attachment metadata by default so the starter does not pretend to parse documents. Add a document extraction tool when the app needs PDF/DOCX understanding.

# Checks

```bash
pnpm typecheck
pnpm build
```

Use browser verification for layout or chat-flow changes.
