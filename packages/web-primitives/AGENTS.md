Stateless UI primitives for the Foundry UI stack. Published as `@iloveagents/foundry-web-primitives`.

# Architecture

```
src/
  index.ts        ← barrel export (all public API)
  utils.ts        ← cn() — clsx + tailwind-merge
  button.tsx      ← Button + buttonVariants
  checkbox.tsx    ← Checkbox (Radix UI)
  field.tsx       ← Field, FieldSet (form-row composition)
  input.tsx       ← Input + inputClassName
  textarea.tsx    ← Textarea + textareaClassName
```

# Import boundary

- MUST NOT import from commercial downstream packages (`@ltwlf/*`) (zero workspace dependencies — pure leaf package). **Enforced** by the `OPEN_CORE_GRAPH` rule in `packages/web-ui/src/__tests__/open-core-guards.test.ts`.
- MUST NOT use `@/` path aliases (relative imports only). Convention; not currently guarded for this package.
- MUST NOT import from any `apps/`, `features/`, or `pages/`. Convention; same status as above.

# What goes here

Stateless, generic UI building blocks. Specifically:

- shadcn-style primitives wrapping Radix UI roots
- Layout/composition helpers (`Field` rows for forms)
- Pure styling utilities (`cn`, variant helpers)

# What does NOT go here

- Any component that touches a Zustand store, agent runtime, or theme runtime
- Any component that renders into a portal AND needs theming (Dialog, Popover, DropdownMenu — those stay in `@iloveagents/foundry-web-ui` until the theme-runtime coupling is refactored)
- Any component with backend / API knowledge

# Theming

Components use Tailwind utility classes referencing CSS variables (shadcn convention):
- `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `bg-accent`, `text-accent-foreground`, `border-input`, `ring-ring`, `bg-destructive`, `text-destructive-foreground`, `bg-secondary`, `text-secondary-foreground`

Consumers must define these tokens in their app's CSS (canonical definitions: `packages/web-ui/src/styles.css`, shipped as `@iloveagents/foundry-web-ui/styles.css`; the scaffold's `template/src/index.css` shows the consumer wiring).

# Bundle-size budget

`@iloveagents/foundry-web-primitives` ≤30 KB gz — **target, not yet enforced**. The `size-limit` infrastructure is planned but not yet scaffolded; until then, manually check the build output. Adding heavier components (Dialog, Popover, table primitives) is fine if they stay zero-coupled, but watch the budget.
