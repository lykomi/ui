# create-foundry-ui-app

## 0.4.0

### Minor Changes

- 9be8b3d: Add a default FastAPI + Microsoft Agent Framework AG-UI agent service scaffold to the starter, including a hello tool, a weather tool, current Foundry env examples, and a demo-grade Hello Agent page with one-click AG-UI prompts. Expose `agentFetch` through `bootstrapShell` so generated apps can use a local unauthenticated agent transport for demos before swapping to the MSAL-backed default.

  Ship the Foundry UI Tailwind v4 theme resource through `@iloveagents/foundry-web-ui/styles.css` and import it from the starter so panels and other source-shipped components render correctly without app-local theme copies. Default shared app branding and browser titles to `Foundry UI`, and document starter theming through `bootstrapShell({ theme })`.

  Hide the composer page-pin button by default, while keeping it available through `ChatContent` and `ContextPins` opt-in props. Make non-image document attachments degrade to model-visible metadata instead of malformed binary payloads so starter uploads do not break AG-UI streaming.

  Reserve user-message action-row height while the agent is running so the chat no longer jumps when the post-run edit button appears.

  Tighten the starter documentation around a single quick-start path, add generated-app `AGENTS.md` plus `CLAUDE.md` import support, and remove default-template product clutter so coding agents and humans both have one clear place to add tools.

  Document the two supported adoption modes: package-backed apps for central Foundry UI updates, and full-copy/GitHub-template apps for complete customization.

  Harden preview packaging by replacing internal `workspace:*` dependencies with installable semver ranges, adding package-level MIT licenses, publishing runtime packages as built ESM JavaScript plus `.d.ts` declarations, filtering runtime package tarballs to dist/README/LICENSE only, and adding missing package READMEs/typecheck coverage.

## 0.3.1

### Patch Changes

- 733f3d6: Doc cleanup: remove dangling `FOUNDRY_UI_TOKEN` references in README/AGENTS/template/help-text. They were left over from the era when the lastspace preset was fetched from GitHub Packages with that token; that fetch path was replaced with a no-auth npmjs registry fetch in the previous release.

  The customer-side env var is now consistently named `LASTSPACE_TOKEN` (authenticates lastspace-private resources: Docker image, npm @lastspace scope, Python packages). No code-path changes — purely documentation alignment.

- 7c22e6a: Preserve Python dunder files (`__init__.py`, `__main__.py`) during scaffold copy. The previous underscore-prefix-→-dotfile rename rule was too aggressive — it transformed `__init__.py` into `._init__.py`, breaking any preset that ships Python source. Now only single-underscore prefixes (e.g. `_gitignore`, `_npmrc`) get rewritten; double-underscore names pass through unchanged. Surfaced by the lastspace preset's `apps/web-api/` overlay.

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
