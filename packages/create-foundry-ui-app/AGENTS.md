npm scaffolding CLI for Foundry UI. Customers run `npx create-foundry-ui-app my-app` to get a chat-first agent starter that consumes `@iloveagents/foundry-*` from npm at `^0.3.1`.

# Architecture

```text
src/
  index.ts             CLI entry: argv parsing, prompts, scaffold + optional pnpm install
  copy-template.ts     recursive copy + __PROJECT_NAME__ substitution + _gitignore -> .gitignore rename
  presets.ts           preset registry; default = bundled template
  __tests__/           vitest unit tests

template/
  package.json         generated app scripts and npm deps
  README.md            generated app onboarding
  AGENTS.md            generated app coding-agent contract
  CLAUDE.md            imports AGENTS.md for Claude Code
  agent/               FastAPI + Microsoft Agent Framework AG-UI service
  src/                 Foundry UI React app
```

# Public API

```bash
npx create-foundry-ui-app <target-dir> [--preset <name>] [--no-install] [--force]
```

- `--preset default` - bundled OSS starter: Foundry UI chat, FastAPI agent service, hello/weather tools.
- `--preset lastspace` - private Spaces preset, requires `LASTSPACE_TOKEN`.
- `--no-install` - skip `pnpm install`.
- `--force` - allow scaffolding into a non-empty target.

# Build

```bash
pnpm build
pnpm test:unit
pnpm typecheck
```

The published package ships `dist/` plus `template/` via `package.json#files`.

# Template Rules

Always:

- Keep the default template generic and chat-first.
- Keep package deps on the current coordinated `@iloveagents/foundry-*` release range.
- Keep `agent/` as the service folder name.
- Keep `FOUNDRY_PROJECT_ENDPOINT` and `FOUNDRY_MODEL` as the primary env vars.
- Keep the default generated app name and browser title as `Foundry UI`.
- Document app theming through `theme` layers in `src/main.tsx`.
- Keep `src/index.css` importing `@iloveagents/foundry-web-ui/styles.css`.
- Keep Tailwind v4 `@source "../node_modules/@iloveagents/.../dist"` directives.
- Keep `AGENTS.md` and `CLAUDE.md` in the generated template.

Never:

- Add customer/demo-event copy to the default template.
- Add a landing page before the chat.
- Hide tool registration behind abstractions; users should add tools in `agent/app/tools.py` and `AGENT_TOOLS`.
- Add a general-purpose templating engine. `__PROJECT_NAME__` substitution is enough.

# UX Bar

The default scaffold should feel like a serious agent bootstrap:

- One command path to a running app.
- One obvious file for tools.
- One obvious env file for Foundry config.
- Minimal README, no product tour.
- Browser-verifiable chat flow with hello/weather tools.

# Related

- Root architecture: `../../AGENTS.md`
- Generated app contract: `template/AGENTS.md`
- CLI tests: `src/__tests__/`
