/**
 * The graph payload contract.
 *
 * Deliberately source-agnostic: nothing here knows about Neo4j, Cypher, or any
 * other store. A backend tool, a REST response, or a hand-built fixture all
 * produce the same shape, and {@link GraphView} renders it. Store-specific
 * mapping lives in `adapters/` (see `adapters/neo4j.ts`) and is never imported
 * from this module — a unit test enforces that.
 */

/** Discriminator carried by every payload, so a tool card can sniff an
 *  arbitrary JSON result and decide whether it is renderable as a graph. */
export const GRAPH_PAYLOAD_KIND = "foundry.graph" as const;

/** Payload format version. Bump only for a breaking shape change. */
export const GRAPH_PAYLOAD_VERSION = 1 as const;

export interface GraphNode {
  /** Stable identity. Edges reference nodes by this value. */
  id: string;
  /**
   * Type tags. Neo4j labels map straight onto this, but so does a single
   * `["Person"]` from any other source. The FIRST label drives colour and
   * legend grouping.
   */
  labels?: string[];
  /** Text drawn on the node. When absent, {@link resolveCaption} picks one. */
  caption?: string;
  properties?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  /** {@link GraphNode.id} of the edge's origin. */
  source: string;
  /** {@link GraphNode.id} of the edge's destination. */
  target: string;
  /** Relationship type — drawn along the edge and used for legend grouping. */
  type?: string;
  properties?: Record<string, unknown>;
}

export interface GraphPayload {
  kind: typeof GRAPH_PAYLOAD_KIND;
  version: typeof GRAPH_PAYLOAD_VERSION;
  nodes: GraphNode[];
  edges: GraphEdge[];
  /** The producer hit a cap and dropped elements. Surfaced in the UI. */
  truncated?: boolean;
  /** Totals BEFORE truncation, when the producer knows them. */
  stats?: { nodeCount?: number; edgeCount?: number };
  /** Per-label styling hints from the producer. Overridden by host styling. */
  legend?: Record<string, { color?: string; captionKey?: string }>;
  /**
   * Producer-supplied context about how this graph was obtained.
   *
   * Deliberately open: every source has something different worth carrying, and
   * a closed type would force each of them to fork the contract. Conventional
   * keys, which the starter presets emit and the UI reads when present:
   *
   * - `query` — the statement that produced this graph, for a panel title
   * - `elapsedMs`, `database` — provenance
   * - `scores` — `{ id, score }[]` from a similarity search
   * - `rows` — scalar results, when the query returned no graph at all
   *
   * Never put user-supplied query PARAMETERS here: this travels back into the
   * conversation and into any transcript store.
   */
  meta?: Record<string, unknown>;
  /**
   * Never present on a successful payload — declared so TypeScript rejects it
   * at the construction site.
   *
   * The AG-UI runner parses every tool result and marks the whole tool call
   * failed if the parsed object has a top-level `error` key
   * (`onToolCallResultEvent` in `@iloveagents/foundry-agent`). A payload that
   * reported, say, a partial failure under `error` would render as a red failed
   * tool call no matter how much good data it carried. Producers signal trouble
   * with `truncated` and `meta` instead; a genuine failure returns a plain
   * `{ error }` object and no payload at all.
   */
  error?: never;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isStringArray = (value: unknown): boolean =>
  value === undefined || (Array.isArray(value) && value.every((item) => typeof item === "string"));

/**
 * A node, checked past its id.
 *
 * The optional fields are checked because this predicate decides whether the
 * graph card TAKES OVER a tool result, and everything downstream then trusts
 * the shape: `labels: [42]` was accepted as a graph and crashed the first
 * search, in `matchNodes`, on `toLowerCase()`. Rejecting it renders the result
 * as an ordinary tool card, which is the right outcome for something that is
 * not a graph.
 */
const isNode = (value: unknown): value is GraphNode =>
  isRecord(value) &&
  typeof value.id === "string" &&
  value.id.length > 0 &&
  isStringArray(value.labels) &&
  (value.caption === undefined || typeof value.caption === "string") &&
  (value.properties === undefined || isRecord(value.properties));

const isEdge = (value: unknown): value is GraphEdge =>
  isRecord(value) &&
  typeof value.id === "string" &&
  typeof value.source === "string" &&
  typeof value.target === "string" &&
  (value.type === undefined || typeof value.type === "string") &&
  (value.properties === undefined || isRecord(value.properties));

/**
 * Structural check. Strict on the discriminator — an arbitrary object that
 * happens to carry `nodes` and `edges` is NOT a graph payload, because a tool
 * card uses this to decide whether to take over the render.
 */
export function isGraphPayload(value: unknown): value is GraphPayload {
  if (!isRecord(value)) return false;
  if (value.kind !== GRAPH_PAYLOAD_KIND) return false;
  if (value.version !== GRAPH_PAYLOAD_VERSION) return false;
  return (
    Array.isArray(value.nodes) &&
    Array.isArray(value.edges) &&
    value.nodes.every(isNode) &&
    value.edges.every(isEdge) &&
    isLegend(value.legend)
  );
}

/**
 * Producer styling hints, checked for the same reason the nodes are: whatever
 * passes here is trusted from then on. `legend: { Person: null }` used to be
 * accepted and then crash `useGraphStyling` on `hint.color`.
 */
const isLegend = (value: unknown): boolean =>
  value === undefined ||
  (isRecord(value) &&
    Object.values(value).every(
      (hint) =>
        isRecord(hint) &&
        (hint.color === undefined || typeof hint.color === "string") &&
        (hint.captionKey === undefined || typeof hint.captionKey === "string"),
    ));

/**
 * Best-effort extraction of a payload from a tool result.
 *
 * Tool results reach the UI in several shapes depending on how the agent
 * framework serialized them: the payload itself, a JSON string of it, a
 * double-encoded JSON string (a backend that returned a string, which the
 * AG-UI runner then parsed once), or an envelope with the payload one level
 * down (`{ graph: … }`, `{ result: … }`). All of them are common enough that
 * making each caller handle them would just spread the same bug around.
 *
 * Returns `null` rather than throwing — a non-graph result is an ordinary
 * outcome, not an error.
 */
export function coerceGraphPayload(value: unknown): GraphPayload | null {
  return coerceAtDepth(value, 0);
}

/**
 * Bound on how far to chase a payload through strings and envelopes.
 *
 * Tool results are attacker-influenced in any app whose graph holds
 * user-supplied text, so the search has to terminate on adversarial input:
 * a deeply nested `{result:{result:{…}}}`, or a string encoded a thousand
 * times. Six is far more than any real serializer produces.
 */
const MAX_COERCE_DEPTH = 6;

const ENVELOPE_KEYS = ["graph", "result", "data", "payload"] as const;

function coerceAtDepth(value: unknown, depth: number): GraphPayload | null {
  if (depth > MAX_COERCE_DEPTH) return null;

  if (typeof value === "string") {
    const trimmed = value.trim();
    // Cheap reject before paying for a parse of a long prose result. `{` is a
    // payload; `"` is a payload that was encoded one extra time.
    if (!trimmed.startsWith("{") && !trimmed.startsWith('"')) return null;
    try {
      return coerceAtDepth(JSON.parse(trimmed), depth + 1);
    } catch {
      return null;
    }
  }

  if (isGraphPayload(value)) return value;
  if (!isRecord(value)) return null;

  for (const key of ENVELOPE_KEYS) {
    const nested: unknown = value[key];
    if (nested === undefined || nested === value) continue;
    const found = coerceAtDepth(nested, depth + 1);
    if (found) return found;
  }
  return null;
}

/** An empty, valid payload — the render path's "nothing yet" value. */
export function emptyGraphPayload(): GraphPayload {
  return { kind: GRAPH_PAYLOAD_KIND, version: GRAPH_PAYLOAD_VERSION, nodes: [], edges: [] };
}

/** Property keys tried, in order, when a node carries no explicit caption. */
export const DEFAULT_CAPTION_KEYS = [
  "name",
  "title",
  "label",
  "caption",
  "displayName",
  "id",
] as const;

/**
 * Pick the text to draw on a node.
 *
 * `captionKey` (from the payload legend or host styling) wins; then the
 * conventional keys above; then the first short string property; then the id.
 * Never returns an empty string — an unlabelled circle is unreadable.
 */
export function resolveCaption(node: GraphNode, captionKey?: string): string {
  if (node.caption) return node.caption;
  const props = node.properties ?? {};
  if (captionKey) {
    const explicit = props[captionKey];
    if (typeof explicit === "string" && explicit.length > 0) return explicit;
    if (typeof explicit === "number") return String(explicit);
  }
  for (const key of DEFAULT_CAPTION_KEYS) {
    const candidate = props[key];
    if (typeof candidate === "string" && candidate.length > 0) return candidate;
  }
  for (const candidate of Object.values(props)) {
    if (typeof candidate === "string" && candidate.length > 0 && candidate.length <= 60) {
      return candidate;
    }
  }
  return node.id;
}

/** First label, or a stable fallback so untyped nodes still group together. */
export const primaryLabel = (node: GraphNode): string => node.labels?.[0] ?? "Node";

/**
 * Drop edges whose endpoints are missing, and report how many went.
 *
 * A Cypher result routinely returns relationships whose far end was not in the
 * projection. force-graph throws on an unresolvable link id, so this has to
 * happen before the data reaches the canvas — and silently dropping them
 * without a count makes "why is my graph missing edges?" unanswerable.
 */
export function pruneDanglingEdges(payload: GraphPayload): {
  nodes: GraphNode[];
  edges: GraphEdge[];
  dropped: number;
} {
  const ids = new Set(payload.nodes.map((n) => n.id));
  const edges = payload.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return { nodes: payload.nodes, edges, dropped: payload.edges.length - edges.length };
}

/**
 * Union two payloads, right-hand side winning on id collisions.
 *
 * What "expand" and "the agent just added a node" both need: the new part has
 * to join the graph on screen, not replace it. Replacing is what makes an
 * explorer feel like a search box — every step throws away the context of the
 * step before, and the position of every node the user had already placed.
 *
 * The right-hand side wins because it is the fresher read of the same thing:
 * a node returned again after a property was set carries the new value.
 */
export function mergeGraphPayloads(base: GraphPayload, addition: GraphPayload): GraphPayload {
  const nodes = new Map(base.nodes.map((node) => [node.id, node]));
  for (const node of addition.nodes) nodes.set(node.id, node);
  const edges = new Map(base.edges.map((edge) => [edge.id, edge]));
  for (const edge of addition.edges) edges.set(edge.id, edge);

  return {
    kind: GRAPH_PAYLOAD_KIND,
    version: GRAPH_PAYLOAD_VERSION,
    nodes: [...nodes.values()],
    edges: [...edges.values()],
    // Either side hitting a cap means the union is incomplete.
    truncated: base.truncated || addition.truncated ? true : undefined,
    // `stats` means totals BEFORE truncation, so it can only be stated when
    // nothing was truncated — there the retained counts ARE those totals.
    // Once either producer capped, the union's true total is not derivable
    // from anything here: each side knows its own pre-cap count, and how much
    // those two sets OVERLAP is exactly what the capped rows would have said.
    // Publishing the retained counts under this field understated a merge of
    // a 500-node truncated read as ~300 and called it a total; the field is
    // optional, so the honest answer is to omit it and let `truncated` carry
    // the "incomplete" signal on its own.
    stats:
      base.truncated || addition.truncated
        ? undefined
        : { nodeCount: nodes.size, edgeCount: edges.size },
    // The legend describes labels, which accumulate; meta describes the most
    // recent query, which does not.
    legend: base.legend || addition.legend ? { ...base.legend, ...addition.legend } : undefined,
    meta: addition.meta ?? base.meta,
  };
}

/**
 * `JSON.stringify` that survives what a graph actually carries.
 *
 * This is the DISPLAY and TRANSPORT form: the panel's `content` string behind
 * the Copy button, the raw-result view on the card, and the tool results the
 * model reads. It is deliberately NOT the form used to decide whether a value
 * changed — see {@link deepEqual}, and the note below for why the two must
 * stay apart.
 *
 * `properties` is `unknown` by design — it is whatever the database had — and
 * the Neo4j driver hands back native `bigint` when configured with
 * `useBigInt`, which `JSON.stringify` THROWS on. So opening the panel for an
 * otherwise perfect payload could fail before anything rendered. Bigints
 * become their decimal string (which is what the inspector already displays),
 * and a cycle becomes `"[circular]"` rather than an exception.
 *
 * That string tag is LOSSY — `10n` and `"10"` come out the same — and that is
 * correct here. A reader wants `10`, and so does the model: a stretch of this
 * function's history tagged the bigint to keep an equality check honest, and
 * the cost was a node property reaching the agent as `{"__bigint":"10"}`
 * instead of a number. Equality is a different job; give it {@link deepEqual}.
 */
export function safeStringify(value: unknown, space?: number): string {
  // ANCESTORS of the value being written, not everything ever seen. A single
  // visited-set calls the second sighting of a shared object a cycle, and two
  // nodes sharing one `properties` object is an ordinary thing for a hand-built
  // payload or a browser-side adapter to produce — so the panel's copied
  // content, and the tool results the agent reads, carried a literal
  // "[circular]" where real data belonged. A repeat is only a cycle if the
  // object is on the path back to the root.
  //
  // `JSON.stringify` walks depth-first and calls the replacer with `this` bound
  // to the container it is writing into, which is what makes the path
  // reconstructible: pop until the top of the stack is this item's parent.
  const path: unknown[] = [];
  return JSON.stringify(
    value,
    function (this: unknown, _key, item: unknown) {
      if (typeof item === "bigint") return item.toString();
      if (typeof item !== "object" || item === null) return item;
      while (path.length > 0 && path[path.length - 1] !== this) path.pop();
      if (path.includes(item)) return "[circular]";
      path.push(item);
      return item;
    },
    space,
  );
}

/**
 * A structurally identical value that `JSON.stringify` cannot choke on.
 *
 * For anything that will be TRANSPORTED by someone else\'s serializer — the
 * chat context rides along on every turn and is serialized by the HTTP agent,
 * far from here — a raw `properties` object is a hazard: one native `bigint`
 * and the request body throws, which does not degrade, it stops the user
 * sending messages at all while that node is selected.
 */
export function jsonSafe<T>(value: T): T {
  return JSON.parse(safeStringify(value)) as T;
}

/**
 * Did this value actually change?
 *
 * Compared structurally, WITHOUT serialising — which is the whole point. This
 * question was answered three times by stringifying with a tag for `bigint`,
 * and each tag collided with the data it competed against: `10n` as `"10"`
 * collides with the string `"10"`, as `"10n"` with the string `"10n"`, and as
 * `{__bigint:"10"}` with a property that happens to be that object. There is
 * no fourth tag that works, because `properties` is `unknown` — any encoding
 * can be imitated by data shaped like the encoding.
 *
 * Comparing types directly has no encoding to imitate: `typeof 10n` is not
 * `typeof "10"`, and the question is settled in one step.
 *
 * It also drops a subtler bug the string form carried. Those replacers marked
 * every visited object in one `WeakSet`, so the SECOND appearance of a shared
 * but perfectly acyclic sub-object (the same `properties` on two nodes)
 * serialised as `"[circular]"` — making values that differ there compare
 * equal. Cycles are tracked as PAIRS here, so a repeat is only a cycle when
 * both sides repeat together.
 */
/**
 * `Object.hasOwn`, which this repo\'s ES2020 target does not have.
 *
 * Needed wherever a key comes from the payload: labels and relationship types
 * are whatever the producer called them, and `record["constructor"]` finds a
 * function on the prototype rather than reporting the key as absent.
 */
export function hasOwn(target: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(target, key);
}

function isDate(value: object): value is Date {
  return Object.prototype.toString.call(value) === "[object Date]";
}

/** Own enumerable keys describe this object completely. */
function isPlainObject(value: object): boolean {
  const proto = Object.getPrototypeOf(value) as unknown;
  return proto === Object.prototype || proto === null;
}

export function deepEqual(a: unknown, b: unknown, seen?: Map<object, Set<object>>): boolean {
  if (Object.is(a, b)) return true;
  // Different types can never be equal, which is exactly the bigint case.
  if (typeof a !== typeof b) return false;
  if (typeof a !== "object" || a === null || b === null) return false;

  const left = a as object;
  const right = b as object;
  const pairs = seen ?? new Map<object, Set<object>>();
  const already = pairs.get(left);
  // Assumed equal while the comparison is in flight: two structures that
  // recurse identically are equal, and re-entering would not terminate.
  if (already?.has(right)) return true;
  if (already) already.add(right);
  else pairs.set(left, new Set([right]));

  if (Array.isArray(left) || Array.isArray(right)) {
    if (!Array.isArray(left) || !Array.isArray(right)) return false;
    if (left.length !== right.length) return false;
    return left.every((item, index) => deepEqual(item, right[index], pairs));
  }

  // Enumerable keys only describe a PLAIN object. A `Date`, `Map`, `Set` or
  // `RegExp` keeps its state internally and has none, so comparing key sets
  // said two different dates were the same value — and this guard's entire job
  // is deciding whether something changed. `Date` is worth spelling out
  // because it is what a host or an adapter actually puts in a property; every
  // other exotic object falls through to "not equal unless identical", which
  // is the safe direction: a spurious change costs one redundant update, a
  // missed one loses the user's data silently.
  if (isDate(left) || isDate(right)) {
    return isDate(left) && isDate(right) && Object.is(left.getTime(), right.getTime());
  }
  if (!isPlainObject(left) || !isPlainObject(right)) return false;

  const leftKeys = Object.keys(left);
  const rightKeys = new Set(Object.keys(right));
  if (leftKeys.length !== rightKeys.size) return false;
  return leftKeys.every(
    (key) =>
      rightKeys.has(key) &&
      deepEqual(
        (left as Record<string, unknown>)[key],
        (right as Record<string, unknown>)[key],
        pairs,
      ),
  );
}
