# create-foundry-ui-app

## 0.3.0

### Minor Changes

- 2b5f9da: Wire `--preset lastspace` end-to-end. The CLI now fetches `@lastspace/preset` from npmjs (public, no auth — the preset itself ships zero proprietary code; the customer-PAT auth boundary is `pnpm install` of `@lastspace/spaces-web-ui` which is gated separately), reads the manifest, and overlays its `files/` on top of the default scaffold. Resulting `package.json` gets `extraDependencies` merged in (sorted), required env vars are reported on completion, and underscore-prefixed dotfiles like `_npmrc` are renamed to `.npmrc` automatically.

  Dev escape hatch: set `FOUNDRY_UI_PRESET_LASTSPACE_PATH=<local-path>` to skip the fetch and use a filesystem checkout of the preset (used by lastspace-meta cross-repo dev + integration tests).

  Also fixes the default template's Tailwind `@source` paths — they pointed at `../../node_modules` (two levels up) but a scaffolded app's `src/index.css` is one level under the project root, so utilities from `@iloveagents/foundry-*` source-shipping packages were silently purged.

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
