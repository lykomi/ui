React UI core for the AG-UI protocol starter — hooks, stores, extension-point registries, AG-UI adapter, ChatPanel, sidebar, layout components. Published as `@lastspace/web-ui`. Depends on `@lastspace/web-primitives` for leaf primitives (Button, Input, Field, Checkbox, Textarea, `cn`).

# Architecture

Relative imports only (no `@/` alias). Cross-package consumers use `@lastspace/web-ui`.

```
src/
  components/   ← UI components (sidebar, chat, tool-panel, markdown, etc.)
  lib/          ← Zustand stores, adapters, hooks, utilities
  ui/           ← shadcn/radix primitives (button, tooltip, collapsible, dropdown)
  index.ts      ← barrel export (all public API)
```

# Import Boundary (enforced by guard test)

- MUST NOT import from `@lastspace/spaces`
- MUST NOT use `@/` path aliases (relative imports only)
- MUST NOT import from `features/` or `pages/` (those are app-level)

# Extension Points

SPACES and other feature modules plug in via these registries:

- **NavItem.dnd** (`nav-config.ts`): drag-and-drop behavior on sidebar items
- **NavItem.dimmed / NavItem.badge** (`nav-config.ts`): visual modifiers on sidebar items (greyed-out state, small text badge)
- **NavGroupCreateAction** (`nav-config.ts`): "+ New" actions on nav group headers (label, icon, handler)
- **NavFooterAction** (`nav-store.ts`): action buttons in the sidebar footer area
- **Panel renderer registry** (`tool-panel-store.ts`): custom content renderers for the side panel (PDF, entity pages)
- **Citation handler** (`citation-store.ts`): handles `[n]` citation clicks in markdown
- **Tool UI** (via `useAssistantToolUI` in runtime provider): custom rendering for agent tools

# Adding Extension Points

1. Define interface in the relevant store (e.g., `PanelRendererEntry`)
2. Add registry array + register function to the store
3. Component reads from registry and delegates rendering
4. Feature module calls `registerX()` at init time

# AG-UI Adapter

- No official `@assistant-ui/ag-ui` adapter exists. This package ships a custom adapter (`src/lib/ag-ui-adapter.ts`) that uses raw fetch + SSE and accepts a `fetchFn` option for explicit service clients.
- `@assistant-ui/react` must stay on **0.12.x or newer** — 0.11.x has a `_getInitializePromise` runtime regression.

# Client-Side Tools (AG-UI protocol)

Schemas are sent to the backend, the LLM calls them as declaration-only, the adapter intercepts at `TOOL_CALL_END`, executes locally, and sends a follow-up turn with the results.

- **`ui_*`** — global tools (always available): `ui_navigate`, `ui_set_theme`, `ui_open_panel`, `ui_select_item`, `ui_update_content`, `ui_highlight`, `ui_get_context`, `ui_confirm`.
- **`page_*`** — page-specific tools registered via the `usePageTools()` hook (mounted on enter, removed on leave).

Register page tools with `usePageTools([{ name, description, parameters, execute }])`. Custom tool UIs go through `useAssistantToolUI`. Generic rendering falls back to the tool-fallback component.
