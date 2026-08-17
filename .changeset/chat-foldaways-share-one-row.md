---
"@iloveagents/foundry-web-ui": patch
---

Chat: reasoning and tool runs now share one row shape, and both start folded.

The two foldaways in an assistant message had been built separately and
drifted — one caret pointing down on the right of its label, the other
pointing right on the left of its own, with different paddings and hover
treatments — so stacked together they read as two unrelated widgets. Both now
render through `MessageDisclosure`: caret first, then the part's icon, then
the label, on one baseline with identical metrics.

Tool runs are collapsed by default. The summary line already says how many
calls ran and whether they worked; the cards otherwise bury the answer they
were meant to support.

The strip is also tighter: rows are 20px instead of 24px, and a row that
directly follows another closes the message's 16px part gap to 4px — two
foldaways used to put 64px of chrome above a one-line answer, now 44px. The
in-progress status line loses its fixed 40px box (which left a hole under the
last tool row) and pulses one dot rather than three.
