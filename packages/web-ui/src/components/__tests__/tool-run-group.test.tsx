import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// The group reads the message's parts to count failures. Mock that one hook
// so the outcome logic can be exercised without an assistant runtime.
const parts = vi.hoisted(() => ({ current: [] as unknown[] }));
vi.mock("@assistant-ui/react", () => ({
  useAuiState: (selector: (s: unknown) => unknown) =>
    selector({ message: { parts: parts.current } }),
}));

const { ToolRunGroup } = await import("../tool-run-group.tsx");

describe("ToolRunGroup", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  const render = (indices: number[], isRunning = false) =>
    act(() => {
      root.render(
        <ToolRunGroup indices={indices} isRunning={isRunning}>
          <div data-testid="details">details</div>
        </ToolRunGroup>,
      );
    });

  const trigger = () => container.querySelector<HTMLElement>("[data-tool-run-trigger]");
  const detailsShown = () => container.querySelectorAll('[data-testid="details"]').length > 0;

  it("summarises a succeeded run and keeps the details collapsed", async () => {
    parts.current = [{ status: { type: "complete" } }, { status: { type: "complete" } }];
    await render([0, 1]);

    expect(trigger()?.textContent).toContain("2 tools · done");
    expect(detailsShown()).toBe(false);
  });

  it("counts a failure reported in the payload, not just in the status", async () => {
    // The round-trip succeeded; the tool itself reported an error. Counting
    // only `status` would summarise this run as green.
    parts.current = [
      { status: { type: "complete" } },
      { status: { type: "complete" }, result: "Error: no snapshot" },
    ];
    await render([0, 1]);

    expect(trigger()?.textContent).toContain("2 tools · 1 failed");
  });

  it("counts a transport-level failure too", async () => {
    parts.current = [{ status: { type: "incomplete", reason: "error" } }];
    await render([0]);

    expect(trigger()?.textContent).toContain("1 tool · 1 failed");
  });

  it("opens itself when the run contains a failure", async () => {
    parts.current = [{ status: { type: "complete" }, result: { isError: true } }];
    await render([0]);

    expect(detailsShown()).toBe(true);
  });

  it("reports progress while the run is still going", async () => {
    parts.current = [{ status: { type: "running" } }, { status: { type: "running" } }];
    await render([0, 1], true);

    expect(trigger()?.textContent).toContain("Using 2 tools");
  });

  it("expands and collapses on click", async () => {
    parts.current = [{ status: { type: "complete" } }];
    await render([0]);
    expect(detailsShown()).toBe(false);

    await act(async () => {
      trigger()?.click();
    });
    expect(detailsShown()).toBe(true);

    await act(async () => {
      trigger()?.click();
    });
    expect(detailsShown()).toBe(false);
  });
});
