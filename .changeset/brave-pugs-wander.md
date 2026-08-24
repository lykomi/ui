---
"create-foundry-ui-app": patch
---

Check the default scaffold bundle before the second build overwrites it.

`smoke:starter` builds twice — once as generated, once with voice enabled — and
was reading `dist` only after the second. The assertion that voice is absent
from a default build was therefore inspecting the voice-ENABLED bundle, and
would have passed however badly tree-shaking regressed.
