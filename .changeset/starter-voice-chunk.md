---
"create-foundry-ui-app": patch
---

The generated starter's chunk rules match on the package name, not on the pnpm store path. Those paths embed peer names ("…foundry-web-ui@…\_@ag-ui+client@…"), so a substring match filed foundry-web-ui under whichever peer the rules met first and "react" matched half the store; the voice build's react chunk sat at the 500 kB gate and any growth in a sibling package tripped the starter smoke. The voice package also gets its own chunk. The neo4j preset's config carries the same rules.
