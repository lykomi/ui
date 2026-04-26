# Foundry UI

Open-source agent UI starter for the [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui), [Microsoft Agent Framework](https://github.com/microsoft/agent-framework), and Azure AI Foundry.

> **Status: alpha (0.x).** API surface is iterating. Pre-1.0 changes can break callers in minor bumps; expect lock-step updates.

## Packages

| Package | Tier | Role |
|---|---|---|
| [`@iloveagents/foundry-agent`](packages/agent) | Cross-runtime | Pure-TS AG-UI transport — `AGUIRunner`, vanilla zustand stores, MSAL subpath, service-fetch factory. Zero React, zero `@assistant-ui/*`. |
| [`@iloveagents/foundry-web-primitives`](packages/web-primitives) | React-DOM | Leaf UI primitives — Button, Checkbox, Input, Textarea, Field, FieldSet, `cn()`. |
| [`@iloveagents/foundry-web-ui`](packages/web-ui) | React-DOM | React UI core — hooks, stores, extension-point registries, assistant-ui adapter shim, ChatPanel, sidebar, layout components. |
| [`@iloveagents/foundry-web-shell`](packages/web-shell) | React-DOM | Browser bootstrap — `bootstrapShell({ modules, pages, theme, authProvider })` mounts the SPA. Module-agnostic. |

Future tiers reserved by convention: `@iloveagents/foundry-native-{ui,shell,primitives}` (React Native), `@iloveagents/foundry-unity-*` (Unity), `@iloveagents/foundry-{outlook,teams}-shell`.

## Install

```bash
pnpm add @iloveagents/foundry-web-ui @iloveagents/foundry-web-shell @iloveagents/foundry-agent @iloveagents/foundry-web-primitives
```

For new projects, scaffold via:

```bash
npm create foundry-ui-app my-app
```

(CLI ships in [#100-E](https://github.com/ltwlf/lastspace/issues/90).)

## Develop

```bash
pnpm install
pnpm test           # lint + typecheck + unit tests
pnpm typecheck
```

Each package source-ships TypeScript (no build step) — same convention across the workspace.

## Architecture

See [`AGENTS.md`](AGENTS.md) for the import-direction graph, extension points, and AG-UI runner contract.

## License

MIT — see [LICENSE](LICENSE).
