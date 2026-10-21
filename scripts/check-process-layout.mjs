import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

// An isolated synthetic fixture, never an authenticated application session.
const base = process.env.PROCESS_LAYOUT_URL ?? "http://127.0.0.1:5190/";
const browser = await chromium.launch({ headless: true });
let checked = 0;
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 900 },
    reducedMotion: "reduce",
  });
  for (const dark of [false, true]) {
    for (const rtl of [false, true]) {
      for (const layout of [
        "",
        "narrow&details",
        "vertical&details",
        "narrow&responsive&details",
        "narrow&compact&details",
        "narrow&compact&dense&details",
      ]) {
        const url = new URL(base);
        url.search = [layout, dark ? "dark" : "", rtl ? "rtl" : ""].filter(Boolean).join("&");
        await page.goto(url.href);
        await page.locator(".foundry-process-marker").first().waitFor();
        const horizontal = !layout.includes("vertical") && !layout.includes("responsive");
        const overflow = horizontal && layout.includes("narrow");
        if (overflow) await page.getByRole("button", { name: "Show next steps" }).waitFor();
        const geometry = await page.evaluate(() => {
          const rect = (element) => {
            const { left, top, right, bottom, width, height } = element.getBoundingClientRect();
            return { left, top, right, bottom, width, height };
          };
          const cards = [...document.querySelectorAll(".foundry-process-target")].map(rect);
          const connectors = [
            ...document.querySelectorAll(".foundry-process-step:not(:last-child)"),
          ].map((step) => {
            const style = getComputedStyle(step, "::after");
            const box = rect(step);
            const left = box.left + parseFloat(style.left);
            const top = box.top + parseFloat(style.top);
            return {
              left,
              top,
              right: left + parseFloat(style.width),
              bottom: top + parseFloat(style.height),
              visible: style.display !== "none" && style.content !== "none",
            };
          });
          const marker = rect(document.querySelector(".foundry-process-marker"));
          const buttons = [...document.querySelectorAll(".foundry-process-scroll-button")].map(
            rect,
          );
          return {
            cards,
            connectors,
            marker,
            buttons,
            direction: getComputedStyle(document.querySelector(".foundry-process-steps"))
              .flexDirection,
            contained: document.documentElement.scrollWidth <= innerWidth,
          };
        });
        assert.equal(geometry.direction, horizontal ? "row" : "column", url.search);
        assert.ok(geometry.contained, `Page overflow: ${url.search}`);
        assert.equal(geometry.buttons.length, overflow ? 2 : 0, url.search);
        for (const button of geometry.buttons) {
          assert.ok(
            Math.abs(
              button.top + button.height / 2 - geometry.marker.top - geometry.marker.height / 2,
            ) <= 1,
            `Arrow alignment: ${url.search}`,
          );
        }
        if (!layout.includes("compact")) {
          for (const connector of geometry.connectors) {
            assert.ok(
              connector.visible &&
                connector.right > connector.left &&
                connector.bottom > connector.top,
              `Missing connector: ${url.search}`,
            );
            for (const card of geometry.cards) {
              const overlaps =
                connector.left < card.right &&
                connector.right > card.left &&
                connector.top < card.bottom &&
                connector.bottom > card.top;
              assert.ok(!overlaps, `Connector crosses a card: ${url.search}`);
            }
          }
        }
        checked++;
      }
    }
  }
  await page.goto(`${base}?narrow&details&dark`);
  const next = page.getByRole("button", { name: "Show next steps" });
  await next.click();
  assert.equal(await page.locator("[data-inspected]").textContent(), "documents");
  await page.getByRole("button", { name: "Review: Completed" }).click();
  assert.equal(await page.locator("[data-inspected]").textContent(), "review");
  assert.equal(await page.locator('[data-status="complete"]').count(), 3);
  await mkdir("output/playwright", { recursive: true });
  await page.screenshot({ path: "output/playwright/process-overview-narrow-dark.png" });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${base}?responsive&dark&details`);
  assert.ok(
    await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    "Mobile page overflow",
  );
  await page.screenshot({ path: "output/playwright/process-overview-mobile-dark.png" });
  const touch = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
  await touch.goto(`${base}?narrow&compact&dense`);
  const arrow = await touch.getByRole("button", { name: "Show next steps" }).boundingBox();
  const marker = await touch.locator(".foundry-process-marker").first().boundingBox();
  assert.ok(arrow && marker && arrow.width >= 44 && arrow.height >= 44, "Touch target size");
  assert.ok(
    Math.abs(arrow.y + arrow.height / 2 - marker.y - marker.height / 2) <= 1,
    "Touch arrow alignment",
  );
  await touch.close();
  console.log(
    `Passed ${checked} layout combinations, scrolling, selection and mobile containment.`,
  );
} finally {
  await browser.close();
}
