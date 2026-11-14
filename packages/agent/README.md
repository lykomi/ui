# @lykomi/agent

Cross-runtime AG-UI transport for LYKOMI UI.

This package contains the non-React pieces: `AGUIRunner`, service fetch helpers,
client-tool registry, streaming status store, citation/link stores, and the
optional MSAL subpath.

## Imports

```ts
import { AGUIRunner, createServiceFetch } from "@lykomi/agent";
import { authStore, tokenFetch } from "@lykomi/agent/msal";
```

This package publishes built ESM JavaScript and `.d.ts` declarations.
