---
"@iloveagents/foundry-web-ui": patch
---

Composer: text on its own row, controls in a bottom row

The input and the trailing controls shared one flex row, so the picker and Send sat vertically centred beside the text. Fine on one line; in a narrow window the text wrapped into a tall block with the controls floating at its mid-height, and the controls also stole horizontal space, causing text to wrap sooner than it needed to.

Text now spans the full width on its own row, with attach / effort picker / Send on a dedicated line beneath — the layout ChatGPT uses. Verified at 620px and 1280px, one line and three.
