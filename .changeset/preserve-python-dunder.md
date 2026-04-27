---
"create-foundry-ui-app": patch
---

Preserve Python dunder files (`__init__.py`, `__main__.py`) during scaffold copy. The previous underscore-prefix-→-dotfile rename rule was too aggressive — it transformed `__init__.py` into `._init__.py`, breaking any preset that ships Python source. Now only single-underscore prefixes (e.g. `_gitignore`, `_npmrc`) get rewritten; double-underscore names pass through unchanged. Surfaced by the lastspace preset's `apps/web-api/` overlay.
