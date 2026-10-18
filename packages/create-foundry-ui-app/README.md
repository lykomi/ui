# create-lykomi-app

Create a Foundry UI agent app: React chat UI, AG-UI protocol, Microsoft Agent Framework, and [Microsoft Foundry](https://learn.microsoft.com/azure/foundry/).

Foundry UI is built by [iLoveAgents](https://iloveagents.ai).

## Create An App

```bash
npm create lykomi-app my-agent-app
cd my-agent-app
cp agent/.env.example agent/.env
az login
pnpm dev
```

Open `http://localhost:8010`.

Set these in `agent/.env`:

```bash
FOUNDRY_PROJECT_ENDPOINT=https://<account>.services.ai.azure.com/api/projects/<project>
FOUNDRY_MODEL=gpt-5.4
```

The generated app starts:

- UI: `http://localhost:8010`
- Agent service: `http://localhost:8020`
- AG-UI endpoint: `/api/agent`

The first screen is the chat. The bundled agent can call `hello_world` and `get_weather`.

## Theme The App

Generated apps default to `Foundry UI` for both the shell title and browser title. Change branding, logos, colors, radius, and fonts through the `theme` layers in `src/main.tsx`.

## Two Ways To Use It

| Mode                   | Use when                                                         | Update story                                                                                                            |
| ---------------------- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Package-backed app     | You want central Foundry UI fixes and a small local app surface. | Keep the generated app and update `@iloveagents/foundry-*` packages with your package manager.                          |
| GitHub template / copy | You want to fully own and reshape the app.                       | Copy the generated app into your own template repo. You can customize everything, but you manually pull upstream ideas. |

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

| Preset       | What you get                                                                            |
| ------------ | --------------------------------------------------------------------------------------- |
| `default`    | Chat-first Foundry UI app with FastAPI Agent Framework service and hello/weather tools. |
| `foundry-iq` | Default plus an Azure AI Search Foundry IQ knowledge base retrieval tool.               |

## Packages

The starter consumes the Foundry UI packages from npm:

- `@iloveagents/foundry-web-shell` - browser shell and `bootstrapShell`
- `@iloveagents/foundry-web-ui` - chat UI, AG-UI adapter, tool panels, theme resource
- `@iloveagents/foundry-web-primitives` - shared UI primitives
- `@iloveagents/foundry-agent` - AG-UI client transport

The packages publish built ESM JavaScript and `.d.ts` declarations. The
generated Vite app is already configured to scan their Tailwind classes from the
package `dist` folders.

Source: [`lykomi/ui`](https://github.com/lykomi/ui).

## License

MIT
