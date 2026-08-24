---
"@iloveagents/foundry-web-voice": patch
---

Four from review, the sharpest of them about giving up on a connection.

Cancelling now races the transport instead of waiting it out.
`controls.connect()` takes no abort signal and is unbounded — a permission
prompt left open, a transport that never settles — and until it resolved,
nothing existed that could disconnect it. A cancelled call could therefore hang
as "connecting" indefinitely and still come up later, with the runtime holding
no control over it.

Disposal clears only what the installation still owns. Both registries are
last-registration-wins, so unmounting an older host stripped a newer one that
was still mounted, leaving it with no adapter and a composer with no controls.
Ownership is a token rather than component identity, because two installations
register the very same components.

And one more normalisation boundary: a finished `[label]` at the end of the
text is not finished if the next character is `(`, which makes it a link four
characters shorter. It waits for the next delta now, which costs nothing —
`flush()` speaks it regardless at the end of an answer.
