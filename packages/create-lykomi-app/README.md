# create-lykomi-app

Create a LYKOMI UI agent app: React chat UI, AG-UI protocol, Microsoft Agent Framework, and [Microsoft Foundry](https://learn.microsoft.com/azure/foundry/).

LYKOMI UI is maintained at [lykomi/ui](https://github.com/lykomi/ui).

## Create An App

```bash
npm create lykomi-app my-agent-app
cd my-agent-app
cp agent/.env.example agent/.env
# Edit agent/.env with your project endpoint and model deployment.
az login
pnpm dev
```

Open `http://localhost:8010`.

Set these in `agent/.env`:

```bash
FOUNDRY_PROJECT_ENDPOINT=https://<account>.services.ai.azure.com/api/projects/<project>
FOUNDRY_MODEL=<model-deployment-name>
```

The generated app starts:

- UI: `http://localhost:8010`
- Agent service: `http://localhost:8020`
- AG-UI endpoint: `/api/agent`

Home opens with a chat composer and clickable prompts. Guide demonstrates a page beside the persistent chat. The bundled agent can call `hello_world` and `get_weather`.

The lower interface menu links to the Guide in local demo mode. Connecting a real auth provider makes it the signed-in user menu.

## Explore Before Connecting Azure

Run `pnpm dev:web`, then open **Showcase** at `/showcase`. Six working examples cover forms, collections, dashboards, guided processes, tabs/panels and feedback. A live inspector shows actual AG-UI context and client tools; source panels expose the example code. UI interactions work without credentials. Agent replies require your configured backend.

Every preset also includes five coding skills in `.agents/skills/` and `.claude/skills/`: API grounding, ChatModules, agent-aware forms, workbenches and browser verification. No global installation is required. These teach your coding assistant how to build the app; runtime tools belong to your agent and page modules.

The showcase is a lazy, removable `showcaseModule` in `src/main.tsx`. Example data is local and disposable. Use the examples as a starting point, then connect your own persistence and application tools.

## Theme The App

Generated apps use LYKOMI's neutral and deep-petrol palette, light and dark V2 favicons, a locally bundled Manrope font, and `LYKOMI UI` for the shell and browser title. Edit `src/theme.ts` to change branding, colors, radius, and typography.

## Two Ways To Use It

| Mode                   | Use when                                                        | Update story                                                                                                            |
| ---------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Package-backed app     | You want central LYKOMI UI fixes and a small local app surface. | Keep the generated app and update `@lykomi/*` packages with your package manager.                                       |
| GitHub template / copy | You want to fully own and reshape the app.                      | Copy the generated app into your own template repo. You can customize everything, but you manually pull upstream ideas. |

The package-backed path updates shared UI, shell, theme resources, and AG-UI transport through npm packages. It does not overwrite local files like `agent/app/tools.py`, `src/main.tsx`, or your README.

## Requirements

- Node.js 22+
- pnpm
- uv
- Azure CLI for local `az login`

## Add Tools

Add Agent Framework tools in `agent/app/tools.py` and include them in `AGENT_TOOLS`.

```python
AGENT_TOOLS = [hello_world, get_weather, my_new_tool]
```

The generated `AGENTS.md` explains the local project contract for coding agents. `CLAUDE.md` imports it for Claude Code.

## Options

| Flag              | Description                                  |
| ----------------- | -------------------------------------------- |
| `--preset <name>` | Preset to scaffold from. Default: `default`. |
| `--no-install`    | Skip dependency install.                     |
| `--force`         | Scaffold into a non-empty directory.         |

## Presets

| Preset       | What you get                                                                           |
| ------------ | -------------------------------------------------------------------------------------- |
| `default`    | Chat-first LYKOMI UI app with FastAPI Agent Framework service and hello/weather tools. |
| `foundry-iq` | Default plus an Azure AI Search Foundry IQ knowledge base retrieval tool.              |

## Packages

The starter consumes the LYKOMI UI packages from npm:

- `@lykomi/web-shell` - browser shell and `bootstrapShell`
- `@lykomi/web-ui` - chat UI, AG-UI adapter, tool panels, theme resource
- `@lykomi/web-primitives` - shared UI primitives
- `@lykomi/agent` - AG-UI client transport

The packages publish built ESM JavaScript and `.d.ts` declarations. The
generated Vite app is already configured to scan their Tailwind classes from the
package `dist` folders.

Source: [`lykomi/ui`](https://github.com/lykomi/ui).

## License

MIT
