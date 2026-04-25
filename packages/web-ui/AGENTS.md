Stateless UI primitives for the LastSpace agent UI. Published as `@lastspace/web-ui`.

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

# Import boundary (enforced by `open-core-guards.test.ts`)

- MUST NOT import from `@lastspace/*` (zero workspace dependencies — pure leaf package)
- MUST NOT use `@/` path aliases (relative imports only)
- MUST NOT import from any `apps/`, `features/`, or `pages/`

# What goes here

Stateless, generic UI building blocks. Specifically:

- shadcn-style primitives wrapping Radix UI roots
- Layout/composition helpers (`Field` rows for forms)
- Pure styling utilities (`cn`, variant helpers)

# What does NOT go here

- Any component that touches a Zustand store, agent runtime, or theme runtime
- Any component that renders into a portal AND needs theming (Dialog, Popover, DropdownMenu — those stay in `@lastspace/web-ui-core` until the theme-runtime coupling is refactored)
- Any component with backend / API knowledge

# Theming

Components use Tailwind utility classes referencing CSS variables (shadcn convention):
- `bg-background`, `text-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-muted`, `text-muted-foreground`, `bg-accent`, `text-accent-foreground`, `border-input`, `ring-ring`, `bg-destructive`, `text-destructive-foreground`, `bg-secondary`, `text-secondary-foreground`

Consumers must define these tokens in their app's CSS (see `apps/web/src/index.css` for the canonical definitions).

# Bundle-size budget

`@lastspace/web-ui` ≤30 KB gz (enforced by `open-core-guards.test.ts` once the test is wired post-extraction). Adding heavier components (Dialog, Popover, table primitives) is fine if they stay zero-coupled, but watch the budget.
