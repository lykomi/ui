# Foundry UI

Open-source agent UI starter for the [AG-UI protocol](https://github.com/ag-ui-protocol/ag-ui), [Microsoft Agent Framework](https://github.com/microsoft/agent-framework), and [Microsoft Foundry](https://learn.microsoft.com/azure/foundry/).

Foundry UI is an [iloveagents.ai](https://iloveagents.ai) project, not a Microsoft product.

> **Status: alpha (0.x).** API surface is iterating. Pre-1.0 changes can break callers in minor bumps; expect lock-step updates.

## Packages

| Package                                                          | Tier          | Role                                                                                                                                             |
| ---------------------------------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| [`@iloveagents/foundry-agent`](packages/agent)                   | Cross-runtime | Pure-TS AG-UI transport — `AGUIRunner`, vanilla zustand stores, MSAL subpath, service-fetch factory. Zero React, zero `@assistant-ui/*`.         |
| [`@iloveagents/foundry-web-primitives`](packages/web-primitives) | React-DOM     | Leaf UI primitives — Button, Checkbox, Input, Textarea, Field, FieldSet, `cn()`.                                                                 |
| [`@iloveagents/foundry-web-ui`](packages/web-ui)                 | React-DOM     | The actual agent UI — chat, composer, AG-UI adapter, message rendering, tool cards, panels, sidebar, context pins, theme runtime, and UI stores. |
| [`@iloveagents/foundry-web-shell`](packages/web-shell)           | React-DOM     | Browser bootstrap/layout — `bootstrapShell({ modules, pages, theme, authProvider })` mounts the SPA around `web-ui`. Module-agnostic.            |

Future tiers reserved by convention: `@iloveagents/foundry-native-{ui,shell,primitives}` (React Native), `@iloveagents/foundry-unity-*` (Unity), `@iloveagents/foundry-{outlook,teams}-shell`.

## Quick Start

### Create A Package-Backed App

Use this when you want central Foundry UI fixes through npm package updates.

```bash
npm create foundry-ui-app my-app
cd my-app
pnpm install
cp agent/.env.example agent/.env
pnpm dev
```

The generated app starts with a chat screen, quick starts, a FastAPI Agent
Framework service, and hello/weather tools you can replace or extend.

### Bootstrap An Existing React App

Use the shell package when you want Foundry UI as the app foundation but keep
your own routes, auth provider, and theme.

```bash
pnpm add @iloveagents/foundry-web-shell @iloveagents/foundry-web-ui @iloveagents/foundry-agent @iloveagents/foundry-web-primitives
```

```tsx
import "./index.css";
import { bootstrapShell } from "@iloveagents/foundry-web-shell";
import { ChatContent } from "@iloveagents/foundry-web-ui";

bootstrapShell({
  pages: [{ path: "/", element: <ChatContent /> }],
  theme: [{ id: "brand", definition: { branding: { appName: "Foundry UI" } } }],
});
```

Keep this import in your Tailwind entry CSS so package component classes and
theme tokens are available:

```css
@import "@iloveagents/foundry-web-ui/styles.css";
```

### Use As A Template Or Copy

Use a full copy when you want to own and deeply customize the UI, shell, and
agent service. Package-backed apps receive central fixes through dependency
updates; copied apps manually merge upstream improvements.

## Develop

```bash
pnpm install
pnpm test           # build + lint + typecheck + unit tests
pnpm pack:check     # inspect real npm tarballs before publishing
pnpm smoke:starter  # scaffold, install, and build a generated starter
pnpm typecheck
```

Packages publish built ESM JavaScript and `.d.ts` declarations. The generated
Vite starter scans the package `dist` folders with Tailwind v4 `@source`
directives so utility classes used inside Foundry UI components are included.

CI also runs `pnpm smoke:starter:browser`, which opens the generated starter in
Playwright Chromium, sends the hello-world quick start, streams a mocked AG-UI
tool call, and verifies the rendered chat response.

## Architecture

See [`AGENTS.md`](AGENTS.md) for the import-direction graph, extension points, and AG-UI runner contract.

## License

MIT — see [LICENSE](LICENSE).
