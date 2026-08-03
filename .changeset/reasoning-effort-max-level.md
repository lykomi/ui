---
"@iloveagents/foundry-agent": patch
"@iloveagents/foundry-web-ui": patch
---

Expose the `xhigh` reasoning level in the effort picker as **Max**.

The protocol's effort enum runs `low | medium | high | xhigh`, but the picker
stopped at `high`. That made "Thorough" the top choice while a higher level
existed, so a user asking for the model's best effort could not get it.
`xhigh` is confirmed working on the reference deployment (83 reasoning events,
no run errors). Labelling `high` itself "Max" would have been inaccurate.
