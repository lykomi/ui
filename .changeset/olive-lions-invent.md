---
"create-foundry-ui-app": minor
---

Scaffolded apps can talk, switched on by configuration rather than a flag.

`VITE_VOICE_PROXY_URL` is the switch: set it and a microphone appears in the
composer; leave it unset and `createVoiceModule` is never referenced, so the
whole voice tier — and the Voice Live SDK behind it — is tree-shaken out of
the build. Verified: no Voice Live code appears in a default scaffold's
bundle.

That is why there is no `--voice` flag. A flag makes you choose at scaffold
time, before you know whether you want it, and choosing wrong means editing
the app later. Configuration means the decision is reversible, costs nothing
until made, and cannot produce a first run where clicking a microphone errors
because no proxy exists.

The default is `relay`, so a spoken turn is an ordinary turn answered by the
app's own agent, with its tools and history intact.
