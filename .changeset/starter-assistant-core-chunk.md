---
"create-foundry-ui-app": patch
---

Generated apps split assistant-ui's framework-free runtime (`core`, `store`, `tap`) into its own chunk.

Together with the React bindings it crossed Vite's 500 kB chunk warning once the template's `^0.15` range resolved newer assistant-ui releases, which failed the starter smoke for every change. The split leaves both halves well under the gate (about 170 kB and 335 kB minified), in the default template and the neo4j preset.
