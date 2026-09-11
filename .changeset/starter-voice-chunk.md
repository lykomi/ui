---
"create-foundry-ui-app": patch
---

The generated starter puts the voice package in its own chunk. In the main chunk it sat within a few kB of Vite's 500 kB warning, so any growth in a sibling package tripped the starter smoke.
