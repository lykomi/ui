---
"@iloveagents/foundry-agent": patch
"@iloveagents/foundry-web-ui": patch
---

Rename the reasoning levels and fix the picker's alignment.

Levels now read **Auto / Instant / Medium / High / Extra High** under an
"Intelligence" heading, matching the vocabulary users already know from other
assistants instead of inventing a private one (Fast / Balanced / Thorough /
Max). `Auto` stays ours — it means "no preference, use the app's configured
level", which the protocol enum has no member for.

Alignment: the check icon had no `shrink-0`, so on rows whose hint wrapped to
two lines flexbox compressed it to 11px instead of 16px and shifted those
titles left out of the column. Measured in the browser before and after — all
five rows now sit at the same x.
