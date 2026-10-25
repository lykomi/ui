import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NavItem } from "../lib/nav-config.ts";
import { NavBranchStatus } from "./nav-branch-status.tsx";

let root: Root;
let host: HTMLDivElement;
let previousAct: boolean | undefined;
const item: NavItem = { to: "/branch", label: "Branch", childrenLoading: true };
const draw = async (value: NavItem) => {
  await act(async () =>
    root.render(<NavBranchStatus item={value} depth={1} bodyClassName="pl-10" />),
  );
};
const advance = async (milliseconds: number) => {
  await act(async () => vi.advanceTimersByTimeAsync(milliseconds));
};

beforeEach(() => {
  previousAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.useRealTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = previousAct;
});

it("reveals only a sustained first load and removes it immediately for children", async () => {
  await draw(item);
  await advance(149);
  expect(host.querySelector('[role="status"]')).toBeNull();
  await advance(1);
  const status = host.querySelector('[role="status"]')!;
  expect(status.textContent).toContain("Loading items");
  expect(status.classList.contains("fade-in")).toBe(true);
  expect(status.classList.contains("motion-reduce:animate-none")).toBe(true);
  await draw({ ...item, children: [{ to: "/branch/child", label: "Child" }] });
  expect(host.querySelector('[role="status"]')).toBeNull();
});

it("cancels a short load without a late flash or timer leak", async () => {
  await draw(item);
  await advance(100);
  await draw({ ...item, childrenLoading: false });
  await advance(1000);
  expect(host.textContent).toBe("");
  expect(vi.getTimerCount()).toBe(0);
});

it("never inserts loading above known children and does not delay retry errors", async () => {
  await draw({ ...item, children: [{ to: "/branch/child", label: "Child" }] });
  await advance(1000);
  expect(host.textContent).toBe("");
  await draw({ ...item, childrenLoading: false, childrenError: "Could not load items." });
  expect(host.textContent).toContain("Try again");
  expect(vi.getTimerCount()).toBe(0);
});

it("exposes the native depth to workbench geometry without creating a navigation action", async () => {
  await draw(item);
  await advance(150);
  const status = host.querySelector<HTMLElement>('[role="status"]')!;
  expect(status.dataset.navDepth).toBe("1");
  expect(status.hasAttribute("data-nav-branch-status")).toBe(true);
  expect(status.style.getPropertyValue("--nav-depth")).toBe("1");
  expect(status.querySelector("svg")?.classList.contains("size-3.5")).toBe(true);
  expect(status.querySelector("button")).toBeNull();
  await draw({ ...item, childrenLoading: false, childrenError: "Retry required" });
  const error = host.querySelector<HTMLElement>('[role="status"]')!;
  expect(error.dataset.navDepth).toBe("1");
  expect(error.querySelector("svg")?.classList.contains("size-3.5")).toBe(true);
  expect(error.querySelector(":scope > button")).toBeNull();
});

it.each([0, 2, 5])("keeps child geometry at native depth %s", async (depth) => {
  await act(async () =>
    root.render(<NavBranchStatus item={item} depth={depth} bodyClassName="pl-12" />),
  );
  await advance(150);
  const status = host.querySelector<HTMLElement>('[role="status"]')!;
  expect(status.dataset.navDepth).toBe(String(depth));
  expect(status.style.getPropertyValue("--nav-depth")).toBe(String(depth));
  expect(status.querySelector("svg")?.classList.contains("size-3.5")).toBe(true);
});
