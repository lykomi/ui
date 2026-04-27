# create-foundry-ui-app

Scaffold a new [Foundry UI](https://github.com/iLoveAgents/foundry-ui) app — AG-UI protocol + Microsoft Agent Framework + Azure AI Foundry, ready to run.

## Usage

```bash
npx create-foundry-ui-app my-app
cd my-app
pnpm dev
```

Or, if you don't have pnpm yet:

```bash
npm create foundry-ui-app my-app
cd my-app
npm install   # or pnpm install
npm run dev
```

The scaffolded app boots a React shell (`bootstrapShell` from `@iloveagents/foundry-web-shell`) at `http://localhost:8010` with the default Foundry UI ChatPanel.

## Options

| Flag | Description |
|---|---|
| `--preset <name>` | Preset to scaffold from (default: `default`). |
| `--no-install` | Skip running `pnpm install`. |
| `--force` | Allow scaffolding into a non-empty directory. |

## Presets

| Preset | What you get |
|---|---|
| `default` | OSS shell with the four `@iloveagents/foundry-*` packages, no commercial modules. |
| `lastspace` | Default + LastSpace.ai Spaces module (private commercial extension; fetched at scaffold time, requires `LASTSPACE_TOKEN` env var). Ships in lastspace#100-F. |

## What's bundled

The scaffolded app depends on:

- `@iloveagents/foundry-web-shell` — browser bootstrap
- `@iloveagents/foundry-web-ui` — React UI core, ChatPanel
- `@iloveagents/foundry-web-primitives` — Button, Input, etc.
- `@iloveagents/foundry-agent` — cross-runtime AG-UI transport

All consumed from npm at `^0.1.0`. Source: [`iloveagents/foundry-ui`](https://github.com/iLoveAgents/foundry-ui).

## Next

- Add your customer pages to `src/pages/`.
- Add ChatModules to `bootstrapShell({ modules: [...] })`.
- Pair with a Python FastAPI backend using `agent_framework.ag_ui` (see the scaffolded README).
- Configure Entra/MSAL auth via env vars.

## License

MIT
