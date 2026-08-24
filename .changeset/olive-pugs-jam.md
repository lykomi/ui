---
"create-foundry-ui-app": patch
---

Scan the voice package for Tailwind classes.

Voice is optional at runtime, not at build time — the package is always a
dependency — so a scaffolded app that sets `VITE_VOICE_PROXY_URL` rendered a
microphone, stage and launcher badge whose utilities Tailwind had never been
told to look for, and they came out unstyled. Scanning it costs nothing when
voice is off, since Tailwind emits only what something references.

`smoke:starter` now builds the scaffold twice — once as generated, and once
with voice switched on — and checks the CSS actually carries those utilities.
The single default build could only ever exercise the half of the template
where voice does not exist, which is how this got through.
