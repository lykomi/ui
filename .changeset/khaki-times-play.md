---
"@iloveagents/foundry-web-ui": patch
---

A registered `threadSurface` now owns the whole viewport, scroll controls
included.

The transcript underneath keeps its scroll position — deliberate, so it comes
back untouched — but its scroll-to-bottom button stayed mounted, carried the
same `z-10` as the surface overlay, and rendered after it. DOM order put a
chevron on top of whatever the surface was showing, and clicking it scrolled a
viewport nobody could see. Both composers suppress it while a surface is set.
