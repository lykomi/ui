---
"@iloveagents/foundry-web-ui": patch
---

Keep sidebar browsing stable during branch loading and pagination. Reveal active
rows once for navigation intent instead of repeatedly recentering after tree
updates, and use a themed, indented pagination button that retains focus while busy
and through the final page until the user moves focus elsewhere.
