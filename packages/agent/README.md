# @iloveagents/foundry-agent

Cross-runtime AG-UI transport for Foundry UI.

This package contains the non-React pieces: `AGUIRunner`, service fetch helpers,
client-tool registry, streaming status store, citation/link stores, and the
optional MSAL subpath.

## Imports

```ts
import { AGUIRunner, createServiceFetch } from "@iloveagents/foundry-agent";
import { authStore, tokenFetch } from "@iloveagents/foundry-agent/msal";
```

This package publishes built ESM JavaScript and `.d.ts` declarations.
