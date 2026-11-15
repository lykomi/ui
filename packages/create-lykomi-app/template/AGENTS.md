This is a LYKOMI UI starter app: React chat UI, AG-UI transport, and a Microsoft Agent Framework service.

# Architecture

```text
src/main.tsx              LYKOMI UI shell bootstrap
src/pages/chat-page.tsx   Chat route
src/pages/starter-prompts.tsx  Home prompts
src/pages/guide-page.tsx       Example content page
src/starter-module.ts          Navigation, agent context, interface menu
src/theme.ts                   App palette and branding
src/index.css             Tailwind v4 plus @lykomi/web-ui/styles.css
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
FOUNDRY_MODEL=your-model-deployment
```

`FoundryChatClient` reads the Microsoft Agent Framework env vars directly. The Python agent passes `DefaultAzureCredential`; prefer `az login` locally and managed identity or service principal env vars in hosted environments.

# Agent Tools

- Add tools in `agent/app/tools.py`.
- Decorate tools with `@tool(approval_mode="never_require")` unless you intentionally add an approval flow.
- Add new tools to `AGENT_TOOLS`; otherwise the agent cannot call them.
- For remote MCP tools, use the commented `MCPStreamableHTTPTool` block in `agent/app/agent.py` and uncomment the `mcp` dependency in `agent/pyproject.toml`.
- Keep starter tools deterministic enough for demos. If a tool calls a real service, handle errors with clear user-facing strings.

# Update Modes

- Package-backed mode: keep `@lykomi/*` dependencies and update them through npm/pnpm for central fixes to UI, shell, theme resources, and AG-UI transport.
- Copy/template mode: once this app is copied into its own GitHub template or deeply customized repo, local `src/` and `agent/` files are owned by that repo. Pull upstream starter ideas manually.
- Package updates must not overwrite local app code. Template structure changes only apply when a new app is scaffolded or manually merged.

# UI

- Keep the starter chat-first. Do not add landing pages, marketing heroes, or domain-specific clutter.
- Configure quick starts in `src/pages/starter-prompts.tsx`.
- Configure app name, browser title, logos, colors, radius, and fonts in `src/theme.ts`.
- Keep the Guide page and its `ChatModule` as an example of page context and persistent chat; replace them when building your app.
- Keep the default generated app name and browser title as `LYKOMI UI` unless the app is intentionally rebranded.
- Use LYKOMI UI components from `@lykomi/web-ui` and primitives from `@lykomi/web-primitives`.
- Keep `@source "../node_modules/@lykomi/.../dist"` entries in `src/index.css`; Tailwind v4 needs them to scan package component classes.
- Keep `@import "@lykomi/web-ui/styles.css";`; it provides the LYKOMI UI theme tokens.

# Attachments

Images and documents (PDF/DOCX) are both sent to the model as file content — base64 bytes with their mime type and filename. If your model or gateway cannot accept file input, construct the adapter with `new FileAttachmentAdapter({ documentMode: "metadata" })` to send filename/type/size only; the agent then knows a file was attached but cannot read it.

If your backend persists chat history, strip or elide attachment bytes before storing them — they ride along on every turn, and one large PDF can blow past a document-size limit.

# Checks

```bash
pnpm typecheck
pnpm build
```

Use browser verification for layout or chat-flow changes.

## Local skills and examples

Use the repository-local skills in `.agents/skills/` or `.claude/skills/` for grounding, ChatModules, agent-aware forms, workbenches and browser verification. Their bundled form UX references describe the shared component contract. These are coding-assistant instructions, not runtime chat skills.

`src/showcase/` is a removable, lazy example module. Its inspector reads actual framework state. Keep privacy opt-outs, expected-value checks and read/edit boundaries when adapting an example. Run `pnpm dev:web` to explore without an agent; real replies need the configured service.
