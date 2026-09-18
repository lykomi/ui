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

function isUiValue(value: unknown): boolean {
  if (typeof value === "function" || typeof value === "symbol") return true;
  // React elements and component objects (memo / forwardRef / lazy) carry a
  // symbol-valued `$$typeof`. Plain data may use the key too; only the
  // symbol marks React.
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Record<string, unknown>).$$typeof === "symbol"
  );
}

function project(value: unknown, depth: number, seen: WeakSet<object>): unknown {
  if (isUiValue(value)) return OMIT;
  if (value === null || typeof value !== "object") return value;
  // Cycles only: a depth cap would cut off deep data that clones fine today.
  if (seen.has(value)) return OMIT;
  seen.add(value);
  try {
    // A clone copies collections by cloning every entry, so an entry holding
    // UI would still make it throw: walk them like any other container.
    if (value instanceof Map) {
      const out = new Map();
      for (const [k, v] of value) {
        const key = project(k, depth + 1, seen);
        const val = project(v, depth + 1, seen);
        if (key !== OMIT && val !== OMIT) out.set(key, val);
      }
      return value.size > 0 && out.size === 0 ? OMIT : out;
    }
    if (value instanceof Set) {
      const out = new Set();
      for (const v of value) {
        const val = project(v, depth + 1, seen);
        if (val !== OMIT) out.add(val);
      }
      return value.size > 0 && out.size === 0 ? OMIT : out;
    }
    // Other built-ins a clone copies natively (Date, RegExp, typed arrays…)
    // keep doing so; arrays and records are walked.
    if (!Array.isArray(value) && !isRecord(value)) return value;
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
      // defineProperty, not assignment: a "__proto__" key from JSON data is
      // an own property, and assigning it would set the prototype instead.
      if (projected !== OMIT) {
        Object.defineProperty(out, key, {
          value: projected,
          enumerable: true,
          writable: true,
          configurable: true,
        });
      }
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
