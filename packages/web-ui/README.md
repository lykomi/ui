# @lastspace/web-ui

React UI core for the AG-UI protocol agent starter. Provides hooks, stores, extension-point registries, the AG-UI adapter, ChatPanel, sidebar, and layout components. Depends on `@lastspace/web-primitives` for leaf primitives (Button, Input, Field, Checkbox, Textarea, `cn`).

## Install

```bash
pnpm add @lastspace/web-ui @lastspace/web-primitives
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
} from "@lastspace/web-ui";
import { cn } from "@lastspace/web-primitives";
```

Consumed as TypeScript source (no build step). Requires Tailwind v4 `@source` directives for both packages:

```css
@source "../../packages/web-primitives/src";
@source "../../packages/web-ui/src";
```

## Extension Points

Feature modules (like SPACES) plug into `@lastspace/web-ui` via registries — no direct imports needed:

- **NavItem.dnd** — drag-and-drop behavior on sidebar items
- **Panel renderer registry** — custom content renderers for the side panel
- **Citation handler** — handles `[n]` citation clicks in markdown
- **Tool UI** — custom rendering for agent tools via `useAssistantToolUI`

See [AGENTS.md](./AGENTS.md) for architecture details and import boundary rules.
