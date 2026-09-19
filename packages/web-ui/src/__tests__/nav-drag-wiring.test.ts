/**
 * The drag reservation's module is well covered; its WIRING is not, and that
 * is where it broke.
 *
 * `beginNavDrag(type, source)` needs the source element so a `dragend` is
 * still heard after a nav refresh detaches the dragged row mid-drag — a
 * detached node receives its own `dragend`, but the event reaches no window
 * listener from there. The module test for that passes a synthetic source,
 * so it stayed green while the production `onDragStart` was still calling
 * `beginNavDrag(dnd.type)` with one argument. A fix that lived only in the
 * test, which is the worst place for one to live.
 *
 * A behavioural test would have to render a real nav row and fire a real
 * `dragstart`, which means standing up the nav store and the sidebar shell
 * for one argument. This reads the source instead — the same approach the
 * frozen-column z-index invariant uses in `data-table.test.tsx`, and for the
 * same reason: what is being checked is a fact about the code, not about
 * what the code does.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";

const sidebar = readFileSync(resolve(process.cwd(), "src/components/sidebar.tsx"), "utf8");

it("hands beginNavDrag the element the drag started from", () => {
  const calls = [...sidebar.matchAll(/beginNavDrag\(([^)]*)\)/g)].map((m) => m[1]!.trim());
  expect(calls.length).toBeGreaterThan(0);
  for (const args of calls) {
    expect(args, `beginNavDrag(${args}) is missing its source element`).toContain(",");
  }
});
