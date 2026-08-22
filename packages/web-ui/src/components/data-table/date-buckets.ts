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

/**
 * Midnight at the start of that date, in the reader's own zone — and `null`
 * if the date does not exist (2026-02-31 is a typo).
 *
 * Local, not UTC: a date somebody typed into a form means that day where
 * they are. Reading it as UTC makes "22 August" start at 17:00 on the 21st
 * for a reader in UTC−7, which then puts the row in the wrong bucket and
 * marks a deadline overdue most of a day early.
 */
function localDay(year: number, month: number, day: number): number | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const at = new Date(year, month - 1, day).getTime();
  const check = new Date(at);
  return check.getFullYear() === year && check.getMonth() === month - 1 && check.getDate() === day
    ? at
    : null;
}

/** Midnight of the local calendar day an instant falls in. */
function startOfDay(at: number): number {
  const date = new Date(at);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

/**
 * Whole calendar days between two instants — 23:30 and 00:30 the next
 * morning are ONE day apart even though barely an hour passed. Everything
 * a person calls "today" or "yesterday" is a calendar question, so counting
 * elapsed milliseconds gets it wrong twice a night.
 */
function calendarDaysBetween(from: number, to: number): number {
  return Math.round((startOfDay(to) - startOfDay(from)) / DAY);
}

interface DateParts {
  at: number;
  /** No clock was given, so the value means a whole day, not an instant. */
  dateOnly: boolean;
}

function parseParts(value: unknown): DateParts | null {
  if (value == null || value === "") return null;
  if (value instanceof Date)
    return Number.isNaN(value.getTime()) ? null : { at: value.getTime(), dateOnly: false };
  if (typeof value === "number")
    return Number.isFinite(value) ? { at: value, dateOnly: false } : null;
  const text = String(value).trim();
  if (!text) return null;

  const iso = ISO.exec(text);
  if (iso) {
    // The calendar day has to be real; the clock and zone are `Date.parse`'s
    // job, and it handles ISO without guessing.
    const day = localDay(Number(iso[1]), Number(iso[2]), Number(iso[3]));
    if (day === null) return null;
    // A bare date is that day where the reader is; one carrying a clock (and
    // possibly a zone) is the instant it names.
    if (text.length === 10) return { at: day, dateOnly: true };
    const parsed = Date.parse(text);
    return Number.isNaN(parsed) ? null : { at: parsed, dateOnly: false };
  }
  const dotted = DOTTED.exec(text);
  if (dotted) {
    const at = localDay(Number(dotted[3]), Number(dotted[2]), Number(dotted[1]));
    return at === null ? null : { at, dateOnly: true };
  }
  const yearFirst = YEAR_FIRST.exec(text);
  if (yearFirst) {
    const at = localDay(Number(yearFirst[1]), Number(yearFirst[2]), Number(yearFirst[3]));
    return at === null ? null : { at, dateOnly: true };
  }
  return null;
}

export function parseDateish(value: unknown): number | null {
  return parseParts(value)?.at ?? null;
}

export type AgeBucket = "today" | "week" | "month" | "older" | "never";

/** The narrowest bucket something falls in — the one to LABEL it with. */
export function ageBucket(value: unknown, options: DateBucketOptions = {}): AgeBucket {
  const at = parseDateish(value);
  if (at === null) return "never";
  const days = calendarDaysBetween(at, options.now ?? Date.now());
  if (days <= 0) return "today";
  if (days < 7) return "week";
  if (days < 30) return "month";
  return "older";
}

/**
 * Every bucket something belongs to — what a FILTER needs.
 *
 * "Last 7 days" includes today. Saying it does not is technically defensible
 * and reads as broken: a register where everything had just been touched
 * showed "Today 11, Last 7 days 8, Last 30 days 0", three numbers that
 * cannot all be true of the same rows. Ranges nest, so the keys nest, and
 * the counts come out as totals a person can check by eye.
 *
 * The tail ("older than 30 days") and "never" are states rather than
 * ranges, so they stand alone.
 */
export function ageBuckets(value: unknown, options: DateBucketOptions = {}): AgeBucket[] {
  const narrowest = ageBucket(value, options);
  if (narrowest === "today") return ["today", "week", "month"];
  if (narrowest === "week") return ["week", "month"];
  if (narrowest === "month") return ["month"];
  return [narrowest];
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
  const parts = parseParts(value);
  if (parts === null) return "undated";
  const now = options.now ?? Date.now();
  // A date with no clock is a whole day, and someone with until Friday is not
  // late on Friday morning — so it runs out at the end of that day where
  // they are. A real timestamp is compared as the instant it is.
  const deadline = parts.dateOnly ? startOfDay(parts.at) + DAY - 1 : parts.at;
  if (deadline < now) return "overdue";
  return deadline - now <= (options.soonDays ?? 30) * DAY ? "soon" : "later";
}

/** "today" · "yesterday" · "6 d ago" · the date once that stops being useful. */
export function relativeAge(value: unknown, options: DateBucketOptions = {}): string {
  const at = parseDateish(value);
  if (at === null) return "—";
  const days = calendarDaysBetween(at, options.now ?? Date.now());
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} d ago`;
  const date = new Date(at);
  const pad = (part: number) => String(part).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
