---
"@iloveagents/foundry-web-ui": patch
---

Message foldaway rows and the reasoning-effort trigger, tightened.

Rows now line up with the message text instead of sitting 6px inside it — the
pill's own padding was shifting its contents right of the prose above and
below it. A negative margin cancels it, so the hover pill keeps its padding
and the icon still starts on the text's left edge. The pill also hugs its
label now rather than spanning the whole message width.

The disclosure caret moved from the head of the row to the tail. Leading it
put two glyphs in front of every row and pushed the status icon — the one
that carries meaning — into second place. A trailing caret rests pointing
DOWN and flips up when open, the opposite of the leading convention, so the
glyph changed with the position.

The effort trigger shows the level as four rising bars when — and only when —
there is no room for the words. They are the same fact, so exactly one of them
renders: wide, the words name the level outright and need no decoding; narrow,
they drop entirely and the bars carry it in 45px instead of ~75px. Dropping
just the mode was not enough, since "Medium" still cost more width than a chat
bubble's input could spare next to Send. The gauge shows an empty track when
the app has not said what `Auto` resolves to, for the same reason the menu
hint refuses to name a level it does not know.
