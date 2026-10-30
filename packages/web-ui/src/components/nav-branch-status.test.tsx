import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import type { NavItem } from "../lib/nav-config.ts";
import { WorkbenchStyles } from "../workbench/workbench-styles.tsx";
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

it("shows first-load skeleton rows immediately and removes them for known children", async () => {
  await draw(item);
  const status = host.querySelector('[role="status"]')!;
  expect(status.getAttribute("aria-label")).toBe("Loading navigation");
  expect(status.textContent).toBe("");
  expect(status.querySelectorAll("[data-nav-branch-status]")).toHaveLength(3);
  expect(status.querySelector(".motion-safe\\:animate-pulse")).not.toBeNull();
  expect(vi.getTimerCount()).toBe(0);
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
  const status = host.querySelector<HTMLElement>("[data-nav-branch-status]")!;
  expect(status.dataset.navDepth).toBe("1");
  expect(status.hasAttribute("data-nav-branch-status")).toBe(true);
  expect(status.style.getPropertyValue("--nav-depth")).toBe("1");
  expect(status.querySelector(".size-3\\.5")).not.toBeNull();
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
  const status = host.querySelector<HTMLElement>("[data-nav-branch-status]")!;
  expect(status.dataset.navDepth).toBe(String(depth));
  expect(status.style.getPropertyValue("--nav-depth")).toBe(String(depth));
  expect(status.querySelector(".size-3\\.5")).not.toBeNull();
});

it("allows wrapped retry text to grow in a fine-pointer workbench", async () => {
  host.className = "workbench-preview";
  host.setAttribute("data-workspace-navigation", "");
  await act(async () =>
    root.render(
      <>
        <WorkbenchStyles />
        <aside data-sidebar-surface="desktop">
          <section data-nav-group-label="Content">
            <NavBranchStatus
              item={{
                ...item,
                childrenLoading: false,
                childrenError:
                  "A longer explanation at a deeply indented branch must remain readable.",
              }}
              depth={5}
              bodyClassName="pl-18"
            />
          </section>
        </aside>
      </>,
    ),
  );
  const status = host.querySelector<HTMLElement>("[data-nav-branch-status]")!;
  const collect = (rules: CSSRuleList): CSSStyleRule[] =>
    Array.from(rules).flatMap((rule) =>
      "cssRules" in rule
        ? collect((rule as CSSGroupingRule).cssRules)
        : "selectorText" in rule
          ? [rule as CSSStyleRule]
          : [],
    );
  const fixed = collect(host.querySelector("style")!.sheet!.cssRules).filter(
    (rule) =>
      rule.style.height && rule.style.height !== "auto" && status.matches(rule.selectorText),
  );
  expect(fixed.map((rule) => rule.selectorText)).toEqual([]);
  expect(getComputedStyle(status).minHeight).toBe("32px");
});

it("keeps status icons on the flat workbench item column", async () => {
  host.className = "workbench-preview";
  await act(async () =>
    root.render(
      <>
        <WorkbenchStyles />
        <aside data-sidebar-surface="desktop">
          <NavBranchStatus
            item={{ ...item, childrenLoading: false, childrenError: "Retry required" }}
            depth={0}
            bodyClassName="pl-8"
          />
        </aside>
      </>,
    ),
  );
  expect(getComputedStyle(host.querySelector('[role="status"]')!).paddingLeft).toBe("12px");
});
