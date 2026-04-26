# create-foundry-ui-app

## 0.2.0

### Minor Changes

- 0755b14: Initial release of `create-foundry-ui-app` — npm scaffolding CLI for Foundry UI.

  ```bash
  npx create-foundry-ui-app my-app
  cd my-app && pnpm install && pnpm dev
  ```

  Scaffolds a React shell that consumes `@iloveagents/foundry-{agent,web-primitives,web-ui,web-shell}` from npm at `^0.1.0`. Bundled `default` preset includes Vite + Tailwind v4 + TypeScript strict + ESLint, with `bootstrapShell({ modules: [], pages: customerPages })` wiring and a stub home page.

  The `lastspace` preset is reserved for #100-F (lastspace#100-F) and currently throws "not yet available". Other presets follow the same fetch-via-PAT pattern.

  Implementation: plain TS + tsdown bundler + @clack/prompts (no UnJS). Templates bundled inside the package via `package.json#files`. Single-sentinel `__PROJECT_NAME__` substitution in text files; root package.json uses parse-edit-stringify.
