# @iloveagents/foundry-web-ui

React UI core for the AG-UI protocol agent starter. Provides hooks, stores, extension-point registries, the AG-UI adapter, ChatPanel, sidebar, and layout components. Depends on `@iloveagents/foundry-web-primitives` for leaf primitives (Button, Input, Field, Checkbox, Textarea, `cn`).

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

Consumed as TypeScript source (no build step). Requires Tailwind v4 `@source` directives for both packages:

```css
@source "../../packages/web-primitives/src";
@source "../../packages/web-ui/src";
```

## Extension Points

Feature modules (like SPACES) plug into `@iloveagents/foundry-web-ui` via registries — no direct imports needed:

- **NavItem.dnd** — drag-and-drop behavior on sidebar items
- **Panel renderer registry** — custom content renderers for the side panel
- **Citation handler** — handles `[n]` citation clicks in markdown
- **Tool UI** — custom rendering for agent tools via `useAssistantToolUI`

See [AGENTS.md](./AGENTS.md) for architecture details and import boundary rules.
