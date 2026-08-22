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
 * ISO first, then the dot-separated `d.m.yyyy` European form. Slash forms are
 * deliberately NOT read: `03/04/2026` is March in one country and April in
 * another, and a filter that quietly picks one is worse than one that admits
 * it cannot tell.
 */
export function parseDateish(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.getTime();
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const text = String(value).trim();
  if (!text) return null;
  const dmy = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(text);
  if (dmy) {
    const parsed = Date.parse(
      `${dmy[3]}-${dmy[2]!.padStart(2, "0")}-${dmy[1]!.padStart(2, "0")}T00:00:00Z`,
    );
    return Number.isNaN(parsed) ? null : parsed;
  }
  // `Date.parse` happily reads 03/04/2026 as March 4th, which is exactly the
  // guess this refuses to make. A year-first form (2026/04/03) is not
  // ambiguous, so it goes through.
  if (/^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(text)) return null;
  const parsed = Date.parse(text);
  return Number.isNaN(parsed) ? null : parsed;
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
