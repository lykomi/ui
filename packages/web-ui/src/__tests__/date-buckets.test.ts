/**
 * Dates as facet keys: the buckets a person filters by, and the two readings
 * that must never be guessed — an unparseable deadline and an ambiguous one.
 */
import { describe, expect, it } from "vitest";
import {
  ageBucket,
  dueState,
  parseDateish,
  relativeAge,
} from "../components/data-table/date-buckets.ts";

const NOW = Date.parse("2026-08-22T12:00:00Z");
const daysOut = (days: number) => new Date(NOW + days * 86_400_000).toISOString();

describe("parseDateish", () => {
  it("reads ISO, Date objects and epoch millis", () => {
    expect(parseDateish("2026-08-22T00:00:00Z")).toBe(Date.parse("2026-08-22T00:00:00Z"));
    expect(parseDateish(new Date(NOW))).toBe(NOW);
    expect(parseDateish(NOW)).toBe(NOW);
  });

  it("reads the dotted European form day-first", () => {
    expect(parseDateish("03.04.2026")).toBe(Date.parse("2026-04-03T00:00:00Z"));
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
    expect(parseDateish("2026/04/03")).toBe(Date.parse("2026-04-03T00:00:00Z"));
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
    expect(dueState("2026-08-22", { now: NOW })).toBe("soon");
    expect(dueState("2026-08-21", { now: NOW })).toBe("overdue");
    // A real timestamp is compared as the instant it is.
    expect(dueState("2026-08-22T09:00:00Z", { now: NOW })).toBe("overdue");
    expect(dueState("2026-08-22T18:00:00Z", { now: NOW })).toBe("soon");
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
    expect(relativeAge(daysOut(-90), { now: NOW })).toBe("2026-05-24");
    expect(relativeAge(null, { now: NOW })).toBe("—");
  });
});
