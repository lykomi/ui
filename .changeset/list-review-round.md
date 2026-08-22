---
"@iloveagents/foundry-web-ui": patch
---

A round of review findings on the list family, each of which a user would eventually have hit.

Frozen columns: the run is measured from every column in it (a selection checkbox leading a pinned identity column left the next one stacked at zero, overlapping it), the cells take an opaque form of the table's own surface instead of the page background (a visibly different strip in dark mode), and their hover tint is limited to rows that actually respond to a hover.

Keyboard and pointer: Escape on an active row no longer also leaves focus mode, arrow keys carry DOM focus with the active row (Enter used to open the row the keyboard had left), and a double click performs one selection and one open rather than two clicks and an open.

Toolbar and selection: the selection bar appears only while rows are selected — passing the component is not the same as having a selection, and the filter row was disappearing behind an empty one — it renders in inline layouts too, counts every selected row (a filter that hides them no longer hides the only way to clear them), and "Clear" clears rather than restoring a caller's `initialState`. Focus mode shows every facet even when some declare `pinned`.

Also: `meta.defaultHidden` now actually starts a column hidden (it was documented and inert), `facetBuckets` keys are deduplicated so a facet cannot count one row twice, `showIn: "focus"` follows real focus mode rather than the `fill` layout prop, `useElementWidth` re-observes when the ref's element is replaced, and `DataTableFrame` reports focus changes made with Escape.
