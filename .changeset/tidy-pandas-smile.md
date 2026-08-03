---
"@iloveagents/foundry-agent": patch
"@iloveagents/foundry-web-ui": patch
---

Remove the `Auto` reasoning level; default to `Medium`

`Auto` read as "the model picks a level per request". It never did — it sent no effort at all, so the backend's own fallback applied uniformly. The picker now offers only real levels (Instant / Medium / High / Extra High) and always sends one.

`DEFAULT_REASONING_EFFORT` is `medium`, matching the backend fallback that `Auto` used to resolve to, so nobody's answers change. A stored `"default"` from the old option migrates to `medium` rather than resetting the preference.
