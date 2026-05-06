npm scaffolding CLI for Foundry UI. Customers run `npx create-foundry-ui-app my-app` to get a working starter that consumes `@iloveagents/foundry-*` from npm at `^0.1.0`.

# Architecture

```
src/
  index.ts             ← CLI entry: argv parsing, prompts, scaffold + optional pnpm install
  copy-template.ts     ← recursive copy + __PROJECT_NAME__ substitution + _gitignore → .gitignore rename
  presets.ts           ← preset registry (default = bundled template; lastspace = future fetched preset)
  __tests__/           ← vitest unit tests (no real fs writes outside tmpdir)

template/              ← bundled "default" preset (the scaffold output)
  package.json         ← __PROJECT_NAME__ sentinel, deps on @iloveagents/foundry-* at ^0.1.0
  index.html
  vite.config.ts
  tsconfig.{json,app.json,node.json}
  eslint.config.js
  _gitignore           ← prefixed because npm strips top-level dotfiles from tarballs
  src/
    main.tsx           ← bootstrapShell({ modules: [], pages: customerPages })
    pages/{index,chat-page}.tsx
    index.css          ← tailwindcss + @source for foundry-* node_modules
    vite-env.d.ts
  README.md            ← customer onboarding (rewritten with __PROJECT_NAME__)
```

# Public API

```bash
npx create-foundry-ui-app <target-dir> [--preset <name>] [--no-install] [--force]
```

- `--preset default` (default) — bundled OSS shell, no modules.
- `--preset lastspace` — fetched from lastspace repo via `LASTSPACE_TOKEN` env var (private; reserved, ships in lastspace#100-F).
- `--no-install` — skip `pnpm install`. Used by the test suite + agents that want to inspect the output before installing.
- `--force` — allow scaffolding into a non-empty target.

# Build

```bash
pnpm build       # tsup → dist/index.js with ESM + Node20 + shebang shim
pnpm test:unit   # vitest run (copy-template logic, preset resolver)
pnpm typecheck   # tsc --noEmit
```

The published package ships `dist/` + `template/` per `package.json#files`. Source TS is NOT shipped (unlike the framework packages — this is a CLI executed via npx, not a library).

# Boundaries

**Always do:**
- Add new presets via the `presets.ts` registry, not by branching on flags in `index.ts`.
- For scaffolded `template/` content: pin `@iloveagents/foundry-*` at `^0.1.0` (matches the locked version-fixed group in `.changeset/config.json`).
- For the template's `index.css`: keep the `@source "../../node_modules/@iloveagents/foundry-*/src"` directives. Tailwind v4 silently purges classes from source-shipping packages without these — the consumer's UI looks broken (lesson from lastspace PR #127).

**Never do:**
- Add UnJS deps (giget, c12) just for templating. The CLI stays under ~300 LOC of plain TS — if preset composition outgrows that, revisit. Lock-in to UnJS would be the wrong call for a starter we want broadly adoptable.
- Add a general-purpose templating engine. Single-sentinel substitution (`__PROJECT_NAME__`) is enough.
- Embed customer-specific data in the bundled template. The template is the canonical OSS starter — any customer-flavored content goes through the preset mechanism.

# Related

- The `lastspace` preset (private, fetched at scaffold time) is shipped in `ltwlf/lastspace`. See lastspace#100-F.
- Customers running `create-lastspace-app` (a thin wrapper) actually invoke this CLI under the hood with `--preset lastspace`.
