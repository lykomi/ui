---
"@iloveagents/foundry-web-ui": patch
---

A round of review findings on the list family, each of which a user would eventually have hit.

Frozen columns: the run is measured from every column in it (a selection checkbox leading a pinned identity column left the next one stacked at zero, overlapping it), the cells take an opaque form of the table's own surface instead of the page background (a visibly different strip in dark mode), and their hover tint is limited to rows that actually respond to a hover.

Keyboard and pointer: Escape on an active row no longer also leaves focus mode, arrow keys carry DOM focus with the active row (Enter used to open the row the keyboard had left), and a double click performs one selection and one open rather than two clicks and an open.

Toolbar and selection: the selection bar appears only while rows are selected — passing the component is not the same as having a selection, and the filter row was disappearing behind an empty one — it renders in inline layouts too, counts every selected row (a filter that hides them no longer hides the only way to clear them), and "Clear" clears rather than restoring a caller's `initialState`. Focus mode shows every facet even when some declare `pinned`.

Also: `meta.defaultHidden` now actually starts a column hidden (it was documented and inert), `facetBuckets` keys are deduplicated so a facet cannot count one row twice, `showIn: "focus"` follows real focus mode rather than the `fill` layout prop, `useElementWidth` re-observes when the ref's element is replaced, and `DataTableFrame` reports focus changes made with Escape.

A second pass closed four more: rendered-column reports keep ids that contain a comma, Escape falls through to the frame when no row is active, `meta.defaultHidden` reaches leaves nested under a grouping header, and `parseDateish` no longer lets `Date.parse` make the country-dependent guess it exists to refuse.

A third pass closed three more: `meta.defaultHidden` resolves ids the way TanStack does (a dotted `accessorKey`, a string header) and is left to the owner of a controlled list — `defaultHiddenColumns(columns)` is exported for that layer's defaults, since re-applying it every render undid the user the moment they brought a column out — and a date-only deadline now runs out at the END of its day rather than at midnight, so nothing is "overdue" for most of the day it is due.

A fifth pass: a date-only deadline ends at the next LOCAL midnight (a day is 23 or 25 hours long twice a year, so adding 86,400,000 ms ended it an hour early each autumn), pinned row tints composite over the table's own surface rather than the page background so a frozen strip does not diverge on hover or selection, the row keyboard handler leaves arrows and space to ARIA widgets (`role="slider"`, `switch`, `checkbox`, `combobox`, `contenteditable`) instead of only native controls, and keyed context is cleared on navigation whatever its persistence — it tracks a piece of UI, and that UI is gone.

A sixth pass: tree and grid widgets keep their arrows, focus follows the active row only when it is ON a row (never out of a control someone is using inside one), the frozen strip stops tinting for a focused descendant the rest of the row does not tint for, and an empty-string context key counts as a key. The DST regression test also runs in a zone that observes daylight saving — CI runs in UTC, where every day is 24 hours and the test could not have failed.

A seventh pass: a partially gated grouping header is sized by the leaves that survived (its own `getSize()` still counted the dropped ones, holding space for a column nobody can see), `role="button"` and `role="link"` count as controls so a div-button's click no longer opens the row behind it, `addContextItem` no longer accepts a tracking `key` it would not replace by, and the README's facet example is valid TypeScript rather than an object literal with a semicolon in it.
