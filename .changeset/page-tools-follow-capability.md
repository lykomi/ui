---
"@iloveagents/foundry-web-ui": minor
---

fix(tools): let a page withdraw a tool it can no longer perform

`usePageTools` registered once on mount and never looked again, so the tool
catalogue described the page as it was at mount rather than as it is. A page
whose capabilities are state — a document open read-only, a form with nothing
to submit — advertised tools that could only fail, and the model, correctly
trusting the catalogue, spent turns calling them and reporting the error back
to the user.

The set is now re-registered when the schema the model sees changes (names,
descriptions, parameters), so conditional tools work:

```tsx
usePageTools([infoTool, ...(canEdit ? [editTool] : [])]);
```

A fresh array literal with identical schemas does not re-register, and
`execute` always dispatches to the current render's closure — so tool bodies
read live state directly instead of through the refs the mount-time
registration used to force.
