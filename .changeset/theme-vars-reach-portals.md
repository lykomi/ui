---
"@iloveagents/foundry-web-ui": patch
---

Theme variables now reach portalled UI. `ThemeScope` put them on a div, but
Radix portals mount into `document.body` — outside it — so dropdowns,
popovers, selects and tooltips fell back to `:root` and rendered in the base
preset while the page around them wore the customer's theme. The outermost
scope now publishes to the document element as well; nested scopes keep the
div only, so a subtree can still be themed differently without repainting
the page when it mounts.
