/**
 * Keep rendering machinery out of the agent state projection.
 *
 * Navigation metadata is written by the UI for the UI: a nav group's `meta`
 * may carry the items a panel renders, with their icon components and click
 * handlers. The projection built from it is `structuredClone`d on every run
 * and sent to the agent, and a component or a function cannot be cloned —
 * the run then fails in the browser before a request is made, with nothing
 * in any server log.
 *
 * The rule: a value that would make the clone throw marks the object holding
 * it as UI, and that object is left out whole — except the projected record
 * itself, a container, which only loses those entries. A half-stripped nav item
 * (a label with its icon and actions removed) would still tell the agent
 * something the author never meant it to hear. Everything a clone already
 * accepted passes through unchanged, so no projection that works today
 * changes shape.
 */

const OMIT: unique symbol = Symbol("omit");
const MAX_DEPTH = 12;

function isUiValue(value: unknown): boolean {
  if (typeof value === "function" || typeof value === "symbol") return true;
  // React elements and component objects (memo / forwardRef / lazy) are
  // tagged with `$$typeof`.
  return (
    typeof value === "object" &&
    value !== null &&
    "$$typeof" in (value as Record<string, unknown>)
  );
}

function project(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (isUiValue(value)) return OMIT;
  if (value === null || typeof value !== "object") return value;
  if (depth > MAX_DEPTH || seen.has(value)) return OMIT;
  // Built-ins a clone copies natively (Date, Map, Set, RegExp, typed arrays…)
  // keep doing so; only arrays and records are walked.
  if (!Array.isArray(value) && !isRecord(value)) return value;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const out = value.map((item) => project(item, depth + 1, seen)).filter((v) => v !== OMIT);
      return value.length > 0 && out.length === 0 ? OMIT : out;
    }
    const entries = Object.entries(value);
    // The projected record itself is a container (a page's meta, a group's
    // meta): its UI entries are dropped, the rest kept. Below it, an object
    // holding a component or a handler IS a UI object, and goes whole.
    if (depth > 0 && entries.some(([, v]) => isUiValue(v))) return OMIT;
    const out: Record<string, unknown> = {};
    for (const [key, v] of entries) {
      const projected = project(v, depth + 1, seen);
      if (projected !== OMIT) out[key] = projected;
    }
    return out;
  } finally {
    seen.delete(value);
  }
}

function isRecord(value: object): boolean {
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

/** Project a record to what may safely be cloned and sent to the agent. */
export function toAgentData(value: Record<string, unknown>): Record<string, unknown> {
  const projected = project(value, 0, new WeakSet());
  return projected === OMIT ? {} : (projected as Record<string, unknown>);
}
