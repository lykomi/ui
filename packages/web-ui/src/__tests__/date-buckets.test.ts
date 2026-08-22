/**
 * Dates as facet keys: the buckets a person filters by, and the two readings
 * that must never be guessed — an unparseable deadline and an ambiguous one.
 */
import { describe, expect, it } from "vitest";
import {
  ageBucket,
  ageBuckets,
  dueState,
  parseDateish,
  relativeAge,
} from "../components/data-table/date-buckets.ts";

// Local, not UTC: these helpers speak in the reader's calendar days, so the
// fixtures have to as well or the suite passes only in one time zone.
const NOW = new Date(2026, 7, 22, 12, 0, 0).getTime();
const daysOut = (days: number) => new Date(NOW + days * 86_400_000).toISOString();
const localDate = (offsetDays: number) => {
  const d = new Date(NOW + offsetDays * 86_400_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

describe("parseDateish", () => {
  it("reads ISO, Date objects and epoch millis", () => {
    expect(parseDateish("2026-08-22T00:00:00Z")).toBe(Date.parse("2026-08-22T00:00:00Z"));
    // A bare date is that day where the reader is, not in UTC.
    expect(parseDateish("2026-08-22")).toBe(new Date(2026, 7, 22).getTime());
    expect(parseDateish(new Date(NOW))).toBe(NOW);
    expect(parseDateish(NOW)).toBe(NOW);
  });

  it("reads the dotted European form day-first", () => {
    expect(parseDateish("03.04.2026")).toBe(new Date(2026, 3, 3).getTime());
  });

  it("refuses every ambiguous form rather than guessing a country", () => {
    // 03/04/2026 is March in one place and April in another; a filter that
    // silently picks is worse than one that says it cannot tell. The
    // hyphenated shorthand is the same trap, and `Date.parse` falls for it.
    expect(parseDateish("03/04/2026")).toBe(null);
    expect(parseDateish("03-04-2026")).toBe(null);
    expect(parseDateish("4/3/26")).toBe(null);
  });

  it("reads the year-first slash form, which is not ambiguous", () => {
    expect(parseDateish("2026/04/03")).toBe(new Date(2026, 3, 3).getTime());
  });

  it("refuses shorthand a lenient parser would happily invent a date from", () => {
    // `Date.parse("1")` is the year 2001 — nobody writing "1" in a deadline
    // field means that.
    expect(parseDateish("1")).toBe(null);
    expect(parseDateish("May")).toBe(null);
    expect(parseDateish("Q3")).toBe(null);
  });

  it("refuses a day that does not exist", () => {
    expect(parseDateish("2026-02-31")).toBe(null);
    expect(parseDateish("31.02.2026")).toBe(null);
    expect(parseDateish("2026-13-01")).toBe(null);
  });

  it("keeps the clock and the zone when they are given", () => {
    expect(parseDateish("2026-08-22T09:30:00Z")).toBe(Date.parse("2026-08-22T09:30:00Z"));
    expect(parseDateish("2026-08-22T09:30:00+02:00")).toBe(Date.parse("2026-08-22T09:30:00+02:00"));
  });

  it("says nothing for a deadline written as prose", () => {
    expect(parseDateish("Contract signature (May)")).toBe(null);
    expect(parseDateish("")).toBe(null);
    expect(parseDateish(null)).toBe(null);
  });
});

describe("calendar days, not elapsed hours", () => {
  // 00:30 today and 23:30 last night are barely an hour apart and are
  // nonetheless different days — which is what a person means by "today".
  const justAfterMidnight = new Date(2026, 7, 22, 0, 30).getTime();
  const lateLastNight = new Date(2026, 7, 21, 23, 30).toISOString();

  it("puts last night in yesterday, not today", () => {
    expect(ageBucket(lateLastNight, { now: justAfterMidnight })).toBe("week");
    expect(relativeAge(lateLastNight, { now: justAfterMidnight })).toBe("yesterday");
    expect(ageBuckets(lateLastNight, { now: justAfterMidnight })).toEqual(["week", "month"]);
  });

  it("still calls this morning today", () => {
    const earlier = new Date(2026, 7, 22, 0, 5).toISOString();
    expect(ageBucket(earlier, { now: justAfterMidnight })).toBe("today");
    expect(relativeAge(earlier, { now: justAfterMidnight })).toBe("today");
  });

  it("ends a date-only deadline with the reader's day, not UTC's", () => {
    // Late in the local evening the deadline for that same date is not yet
    // past — the bug this guards made it overdue as soon as UTC rolled over.
    const lateToday = new Date(2026, 7, 22, 23, 0).getTime();
    expect(dueState(localDate(0), { now: lateToday })).toBe("soon");
    const nextMorning = new Date(2026, 7, 23, 8, 0).getTime();
    expect(dueState(localDate(0), { now: nextMorning })).toBe("overdue");
  });
});

describe("ageBuckets", () => {
  it("nests, because ranges do — today is also within the last 7 days", () => {
    // The labels say "Last 7 days" and "Last 30 days". Exclusive slices made
    // the counts read as nonsense: Today 11, Last 7 days 8, Last 30 days 0.
    expect(ageBuckets(daysOut(0), { now: NOW })).toEqual(["today", "week", "month"]);
    expect(ageBuckets(daysOut(-3), { now: NOW })).toEqual(["week", "month"]);
    expect(ageBuckets(daysOut(-20), { now: NOW })).toEqual(["month"]);
  });

  it("leaves the states that are not ranges alone", () => {
    expect(ageBuckets(daysOut(-90), { now: NOW })).toEqual(["older"]);
    expect(ageBuckets(null, { now: NOW })).toEqual(["never"]);
  });
});

describe("ageBucket", () => {
  it("buckets by how long ago", () => {
    expect(ageBucket(daysOut(0), { now: NOW })).toBe("today");
    expect(ageBucket(daysOut(-3), { now: NOW })).toBe("week");
    expect(ageBucket(daysOut(-20), { now: NOW })).toBe("month");
    expect(ageBucket(daysOut(-90), { now: NOW })).toBe("older");
    expect(ageBucket(null, { now: NOW })).toBe("never");
  });
});

describe("dueState", () => {
  it("separates late, near, far and undated", () => {
    expect(dueState(daysOut(-1), { now: NOW })).toBe("overdue");
    expect(dueState(daysOut(10), { now: NOW })).toBe("soon");
    expect(dueState(daysOut(90), { now: NOW })).toBe("later");
    expect(dueState("when the boat comes in", { now: NOW })).toBe("undated");
  });

  it("gives a date-only deadline its whole day", () => {
    // Someone with until Friday is not late on Friday morning. NOW is midday
    // on the 22nd, so a deadline of "2026-08-22" still has hours left.
    expect(dueState(localDate(0), { now: NOW })).toBe("soon");
    expect(dueState(localDate(-1), { now: NOW })).toBe("overdue");
    // A real timestamp is compared as the instant it is.
    expect(dueState(new Date(NOW - 3 * 3600_000).toISOString(), { now: NOW })).toBe("overdue");
    expect(dueState(new Date(NOW + 3 * 3600_000).toISOString(), { now: NOW })).toBe("soon");
  });

  it("takes the window from the caller", () => {
    expect(dueState(daysOut(45), { now: NOW })).toBe("later");
    expect(dueState(daysOut(45), { now: NOW, soonDays: 60 })).toBe("soon");
  });
});

describe("relativeAge", () => {
  it("reads as a person would say it, then falls back to the date", () => {
    expect(relativeAge(daysOut(0), { now: NOW })).toBe("today");
    expect(relativeAge(daysOut(-1), { now: NOW })).toBe("yesterday");
    expect(relativeAge(daysOut(-6), { now: NOW })).toBe("6 d ago");
    expect(relativeAge(daysOut(-90), { now: NOW })).toBe(localDate(-90));
    expect(relativeAge(null, { now: NOW })).toBe("—");
  });
});
