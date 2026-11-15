import assert from "node:assert/strict";
import { join } from "node:path";

/** Exercise the shipped examples and actual AG-UI wire payload with a deterministic agent. */
export async function smokeShowcase(page, url, workDir) {
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
  await page.goto(`${url}showcase`);
  const main = page.getByRole("main", { name: "Component showcase" });
  await main.getByRole("button", { name: "Edit project", exact: true }).waitFor();
  const viewport = page.getByRole("region", { name: "Showcase content", exact: true });
  await main.getByRole("heading", { name: "Project details", exact: true }).hover();
  await page.mouse.wheel(0, 500);
  await page.waitForFunction(
    () => document.querySelector("[data-showcase-scroll]").scrollTop > 100,
  );
  await viewport.focus();
  const scrolled = await viewport.evaluate((element) => element.scrollTop);
  await page.keyboard.press("PageUp");
  await page.waitForFunction(
    (before) => document.querySelector("[data-showcase-scroll]").scrollTop < before,
    scrolled,
  );
  await page.mouse.wheel(0, -2000);
  await page.waitForFunction(
    () => document.querySelector("[data-showcase-scroll]").scrollTop === 0,
  );
  const context = () => page.getByLabel("AG-UI context JSON").textContent().then(JSON.parse);
  const waitContext = async (text) =>
    page.waitForFunction(
      (value) =>
        document.querySelector('[aria-label="AG-UI context JSON"]')?.textContent?.includes(value),
      text,
    );
  const example = (name) =>
    page
      .getByRole("navigation", { name: "Showcase examples" })
      .getByRole("link", { name, exact: true });
  await page.screenshot({
    animations: "disabled",
    path: join(workDir, "showcase-forms-light.png"),
  });
  assert.equal(
    await page
      .getByRole("navigation", { name: "Showcase examples" })
      .locator('[aria-current="page"]')
      .count(),
    1,
  );
  await main.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByLabel(/^Project name/).fill("");
  await main.getByRole("button", { name: "Save project", exact: true }).click();
  await page.getByText("Give the project a name.", { exact: true }).waitFor();
  await page.getByLabel(/^Project name/).fill("Shared garden");
  await page.getByLabel(/^Project brief/).fill("Plan a shared garden");
  await page.getByLabel(/^Project brief/).evaluate((input) => {
    input.setSelectionRange(7, 13);
    input.dispatchEvent(new Event("select", { bubbles: true }));
  });
  await waitContext('"selectedText": "shared"');
  assert.equal(
    await page
      .locator('[data-agent-field][data-agent-selected="true"] [data-agent-field-label]')
      .evaluate((element) => getComputedStyle(element, "::before").width),
    "2px",
  );
  let snapshot = await context();
  assert.ok(
    snapshot.state.contextItems.some(
      (item) =>
        item.target?.currentValue === "Plan a shared garden" &&
        item.meta?.caret?.selectedText === "shared",
    ),
  );
  assert.ok(!JSON.stringify(snapshot.state).includes("Private demo note"));
  let outgoing;
  await page.route("**/api/agent", async (route) => {
    const request = route.request().postDataJSON();
    if (request.messages?.at(-1)?.content !== "Improve the showcase brief") return route.fallback();
    outgoing = request;
    const events = [
      { type: "RUN_STARTED", threadId: request.threadId, runId: request.runId },
      {
        type: "TOOL_CALL_START",
        toolCallId: "showcase-edit",
        toolCallName: "page_update_project_field",
      },
      {
        type: "TOOL_CALL_ARGS",
        toolCallId: "showcase-edit",
        delta: JSON.stringify({
          field: "brief",
          expectedValue: "Plan a shared garden",
          value: "Plan a shared herb garden with weekly watering tasks.",
        }),
      },
      { type: "TOOL_CALL_END", toolCallId: "showcase-edit" },
      { type: "RUN_FINISHED", threadId: request.threadId, runId: request.runId },
    ];
    await route.fulfill({
      contentType: "text/event-stream",
      body: events.map((event) => `data: ${JSON.stringify(event)}\n\n`).join(""),
    });
  });
  await main.getByRole("button", { name: "Open chat", exact: true }).click();
  assert.equal(
    await page
      .locator('[data-agent-field][data-agent-selected="true"] [data-agent-field-label]')
      .evaluate((element) => getComputedStyle(element, "::before").width),
    "2px",
  );
  await page
    .getByRole("textbox", { name: "Chat message", exact: true })
    .fill("Improve the showcase brief");
  await page.getByRole("button", { name: "Send message", exact: true }).click();
  await page.waitForFunction(
    () =>
      document.querySelector("#showcase-brief")?.value ===
      "Plan a shared herb garden with weekly watering tasks.",
  );
  assert.ok(
    outgoing.state.contextItems.some(
      (item) => item.target?.currentValue === "Plan a shared garden",
    ),
  );
  assert.ok(!JSON.stringify(outgoing.state).includes("Private demo note"));
  await main.getByRole("button", { name: "Cancel changes", exact: true }).click();
  await page.getByText("Neighborhood garden", { exact: true }).waitFor();
  await page.waitForFunction(
    () =>
      !JSON.parse(
        document.querySelector('[aria-label="AG-UI context JSON"]').textContent,
      ).tools.some((tool) => tool.name === "page_update_project_field"),
  );

  await page.getByRole("link", { name: "Home", exact: true }).last().click();
  assert.equal(
    await page.getByRole("heading", { name: "Explore your app", exact: true }).count(),
    0,
  );
  await page
    .getByRole("region", { name: "Working content", exact: true })
    .waitFor({ state: "hidden" });
  assert.equal(await page.getByText("Continue in Chat", { exact: true }).count(), 0);
  await page.getByRole("button", { name: "New chat", exact: true }).last().click();
  await page
    .getByRole("heading", { name: "What would you like to get done?", exact: true })
    .waitFor();
  assert.equal(
    await page
      .getByRole("heading", { name: "What would you like to get done?", exact: true })
      .count(),
    1,
  );
  assert.equal(await page.locator('[aria-label="Try a prompt"]').count(), 1);
  await page.screenshot({ animations: "disabled", path: join(workDir, "showcase-home-chat.png") });

  await page.goto(`${url}showcase/dashboard`);
  await page.getByRole("heading", { name: "Garden activity", exact: true }).waitFor();
  await waitContext('"completed": 101');
  await page.getByRole("button", { name: "3 weeks", exact: true }).click();
  await waitContext('"completed": 63');
  const dashboard = (await context()).state.contextItems.find(
    (item) => item.refType === "dashboard",
  );
  assert.equal(dashboard.meta.rows.length, 3);
  assert.equal(dashboard.meta.goal, 60);
  assert.equal(
    dashboard.meta.categories.reduce((sum, item) => sum + item.tasks, 0),
    63,
  );
  assert.ok((await page.locator("[data-chart] svg").count()) >= 3);
  await page.screenshot({
    animations: "disabled",
    path: join(workDir, "showcase-dashboard-light.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("heading", { name: "Work over time", exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({
    animations: "disabled",
    path: join(workDir, "showcase-dashboard-narrow.png"),
  });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await page.screenshot({
    animations: "disabled",
    path: join(workDir, "showcase-dashboard-dark.png"),
  });
  await page.setViewportSize({ width: 1512, height: 982 });
  await page.emulateMedia({ colorScheme: "light" });

  // Reload hides the chat so screenshots show the complete example canvas.
  await page.goto(`${url}showcase/collections`);
  await page.getByPlaceholder("Search garden tasks…").fill("watering");
  await waitContext('"matchingCount": 1');
  snapshot = await context();
  const table = snapshot.state.contextItems.find((item) => item.refType === "table");
  assert.equal(table.meta.rows.length, 1);
  assert.equal(table.meta.rows[0].name, "Plan shared watering");
  await page.getByRole("row").filter({ hasText: "Plan shared watering" }).click();
  await page.waitForFunction(() =>
    JSON.parse(document.querySelector('[aria-label="AG-UI context JSON"]').textContent)
      .state.contextItems.find((item) => item.refType === "table")
      ?.meta.selectedIds.includes("t3"),
  );
  assert.deepEqual(
    (await context()).state.contextItems.find((item) => item.refType === "table").meta.selectedIds,
    ["t3"],
  );
  await page.screenshot({
    animations: "disabled",
    path: join(workDir, "showcase-collections.png"),
  });
  await example("Processes").click();
  assert.equal(
    await main.evaluate((element) => {
      let parent = element.parentElement;
      while (parent && !/auto|scroll/.test(getComputedStyle(parent).overflowY))
        parent = parent.parentElement;
      return parent?.scrollTop ?? 0;
    }),
    0,
    "A new example must not inherit the previous page scroll",
  );
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Continue", exact: true }).isDisabled(),
    true,
  );
  await page.getByRole("checkbox", { name: "I have reviewed this plan", exact: true }).check();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Finish example", exact: true }).click();
  await page
    .getByText("Example complete. No work was submitted to a server.", { exact: true })
    .waitFor();
  await page.screenshot({ animations: "disabled", path: join(workDir, "showcase-process.png") });
  await example("Workbench").click();
  const note = page.getByLabel("Planting plan text", { exact: true });
  await note.fill(Array.from({ length: 40 }, (_, index) => `Line ${index}`).join("\n"));
  await note.evaluate((element) => {
    const scroller = element.closest("[data-window-scroll]");
    scroller.scrollTop = 100;
    scroller.dispatchEvent(new Event("scroll"));
  });
  assert.equal(
    await note.evaluate((element) => element.closest("[data-window-scroll]").scrollTop),
    100,
  );
  await page.getByRole("tab", { name: "Shared notes", exact: true }).click();
  assert.equal(
    await page
      .getByLabel("Shared notes text", { exact: true })
      .evaluate((element) => element.scrollTop),
    0,
  );
  await page.getByRole("tab", { name: /Planting plan/ }).click();
  assert.equal(
    await note.evaluate((element) => element.closest("[data-window-scroll]").scrollTop),
    100,
  );
  await note.fill("Keep this note across layouts");
  await page.getByRole("button", { name: "View as panels", exact: true }).click();
  assert.equal(
    await page.getByLabel("Planting plan text", { exact: true }).inputValue(),
    "Keep this note across layouts",
  );
  await page.getByLabel("Shared notes text", { exact: true }).click();
  await waitContext("Ask neighbors which days they can help.");
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: "Close Planting plan", exact: true }).click();
  await page.getByLabel("Planting plan text", { exact: true }).waitFor();
  await page.screenshot({ animations: "disabled", path: join(workDir, "showcase-windows.png") });
  await example("Feedback").click();
  await main.getByRole("button", { name: "Error", exact: true }).click();
  await waitContext('"status": "error"');
  await main.getByRole("button", { name: "Retry simulation", exact: true }).click();
  await waitContext('"status": "running"');
  await main.getByRole("button", { name: "Open confirmation dialog", exact: true }).click();
  await page.getByRole("dialog").waitFor();
  await page.keyboard.press("Escape");
  await page.getByRole("dialog").waitFor({ state: "hidden" });
  assert.equal(
    await main
      .getByRole("button", { name: "Open confirmation dialog", exact: true })
      .evaluate((element) => element === document.activeElement),
    true,
  );
  await page.emulateMedia({ colorScheme: "dark" });
  await page.waitForFunction(() => document.documentElement.classList.contains("dark"));
  await page.screenshot({
    animations: "disabled",
    path: join(workDir, "showcase-feedback-dark.png"),
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${url}showcase/forms`);
  const content = page.getByRole("button", { name: "Content", exact: true });
  if (await content.isVisible()) await content.click();
  await main.getByRole("button", { name: "Edit project", exact: true }).click();
  await page.getByLabel(/^Project brief/).fill("Mobile draft context");
  await waitContext("Mobile draft context");
  await page.getByLabel(/^Project brief/).scrollIntoViewIfNeeded();
  await page.screenshot({
    animations: "disabled",
    path: join(workDir, "showcase-mobile-dark.png"),
  });
  assert.equal(
    await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),
    false,
  );
  await page.emulateMedia({ colorScheme: "light" });
  await page.waitForFunction(() => !document.documentElement.classList.contains("dark"));
  await page.screenshot({
    animations: "disabled",
    path: join(workDir, "showcase-mobile-light.png"),
  });
  console.log(`Showcase browser checks and screenshots passed: ${workDir}`);
}
