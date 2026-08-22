/**
 * Dates as things you can tick. A timestamp is never a facet value — nobody
 * filters by "2026-08-14T09:12:03Z" — so these turn one into the words a
 * person actually means: how old it is, and whether it is late. Pair them
 * with `meta.facetBuckets`, which is what the rest of the machinery counts,
 * ORs, ANDs and puts in the URL.
 *
 * Every list with a date wants this, which is why it lives here rather than
 * being written again in each one.
 */

const DAY = 86_400_000;

export interface DateBucketOptions {
  /** The moment to measure against (default: now). Pass it to keep a test still. */
  now?: number;
}

/**
 * Milliseconds for a value that carries a date, `null` for one that does not.
 *
 * Only shapes whose meaning is not in doubt are read: ISO (`2026-08-22`, with
 * an optional time and zone), the dotted European `d.m.yyyy`, and year-first
 * `yyyy/m/d`. Everything else is `null` — including `03/04/2026` and
 * `03-04-2026`, which are March in one country and April in another.
 *
 * The alternative, handing the leftovers to `Date.parse`, is what makes that
 * guess quietly: it reads `03-04-2026` as March 4th and even turns `"1"` into
 * a date. A field where people legitimately write "Contract signature (May)"
 * needs a parser that says no.
 */
const ISO =
  /^(\d{4})-(\d{2})-(\d{2})(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?\s*(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const DOTTED = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/;
const YEAR_FIRST = /^(\d{4})\/(\d{1,2})\/(\d{1,2})$/;

/** The day itself must exist: 2026-02-31 is a typo, not a date. */
function utcDay(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const at = Date.UTC(year, month - 1, day);
  const check = new Date(at);
  return check.getUTCFullYear() === year &&
    check.getUTCMonth() === month - 1 &&
    check.getUTCDate() === day
    ? at
    : null;
}

export function parseDateish(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;

  const iso = ISO.exec(text);
  if (iso) {
    // The calendar day has to be real; the clock and zone are `Date.parse`'s
    // job, and it handles ISO without guessing.
    if (utcDay(Number(iso[1]), Number(iso[2]), Number(iso[3])) === null) return null;
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : parsed;
  }
  const dotted = DOTTED.exec(text);
  if (dotted) return utcDay(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
  const yearFirst = YEAR_FIRST.exec(text);
  if (yearFirst) return utcDay(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
  return null;
}

export type AgeBucket = "today" | "week" | "month" | "older" | "never";

/** How recently something happened — the buckets a "last update" filter offers. */
export function ageBucket(value: unknown, options: DateBucketOptions = {}): AgeBucket {
  const at = parseDateish(value);
  if (at === null) return "never";
  const age = (options.now ?? Date.now()) - at;
  if (age < DAY) return "today";
  if (age < 7 * DAY) return "week";
  if (age < 30 * DAY) return "month";
  return "older";
}

export interface DueStateOptions extends DateBucketOptions {
  /** How near counts as "soon" (default 30 days). */
  soonDays?: number;
}

export type DueState = "overdue" | "soon" | "later" | "undated";

/**
 * Where a deadline stands. `undated` is its own answer, not a guess: plenty
 * of real deadlines are written as "Contract signature (May)", and calling
 * those neither late nor on time is the honest reading.
 */
export function dueState(value: unknown, options: DueStateOptions = {}): DueState {
  const at = parseDateish(value);
  if (at === null) return "undated";
  const now = options.now ?? Date.now();
  if (at < now) return "overdue";
  return at - now <= (options.soonDays ?? 30) * DAY ? "soon" : "later";
}

/** "today" · "yesterday" · "6 d ago" · the date once that stops being useful. */
export function relativeAge(value: unknown, options: DateBucketOptions = {}): string {
  const at = parseDateish(value);
  if (at === null) return "—";
  const days = Math.floor(((options.now ?? Date.now()) - at) / DAY);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} d ago`;
  return new Date(at).toISOString().slice(0, 10);
}
