# @iloveagents/foundry-web-ui

React UI core for Foundry UI apps.

`web-ui` is the package that renders the actual agent experience: chat UI,
composer, AG-UI adapter, message rendering, tool-call cards, side panels,
sidebar, theme runtime, context pins, attachment handling, and UI stores. It
depends on `@iloveagents/foundry-web-primitives` for leaf primitives (Button,
Input, Field, Checkbox, Textarea, `cn`).

## Install

```bash
pnpm add @iloveagents/foundry-web-ui @iloveagents/foundry-web-primitives
```

## Usage

```tsx
import {
  AGUIRuntimeProvider,
  Sidebar,
  ChatContent,
  ToolPanel,
  useAppStore,
  usePageTools,
} from "@iloveagents/foundry-web-ui";
import { cn } from "@iloveagents/foundry-web-primitives";
```

This package publishes built ESM JavaScript and `.d.ts` declarations. Host apps
must include Tailwind v4 `@source` directives so classes used inside package
components are generated:

```css
@import "@iloveagents/foundry-web-ui/styles.css";
@source "../node_modules/@iloveagents/foundry-web-primitives/dist";
@source "../node_modules/@iloveagents/foundry-web-ui/dist";
```

## Extension Points

Feature modules (like SPACES) plug into `@iloveagents/foundry-web-ui` via registries — no direct imports needed:

- **NavItem.dnd** — drag-and-drop behavior on sidebar items
- **Panel renderer registry** — custom content renderers for the side panel
- **Citation handler** — handles `[n]` citation clicks in markdown
- **Tool UI** — custom rendering for agent tools via `makeAssistantToolUI`

See [AGENTS.md](https://github.com/iLoveAgents/foundry-ui/blob/main/packages/web-ui/AGENTS.md) for architecture details and import boundary rules.
