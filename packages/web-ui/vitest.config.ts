import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.{ts,tsx}"],
    // A zone that actually observes daylight saving. CI runners are UTC,
    // where every day is exactly 24 hours long — so a date test written to
    // catch "adding 86,400,000 ms is not the end of a day" would pass there
    // even after the bug came back. Pinning the zone makes the calendar
    // tests deterministic AND able to fail.
    env: { TZ: "America/Los_Angeles" },
  },
});
