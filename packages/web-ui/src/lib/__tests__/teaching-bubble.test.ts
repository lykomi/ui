import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { useChatRuns } from "../chat-runs-store.ts";
import { registerGuidanceSource } from "../guidance-targets.ts";
import {
  dismissTeachingBubble,
  getGuidanceTargets,
  mountTeachingBubbleHost,
  showTeachingBubble,
  teachingBubbleIsCurrent,
  useTeachingBubble,
} from "../teaching-bubble-store.ts";

let unmount: () => void;
beforeEach(() => {
  unmount = mountTeachingBubbleHost();
  useChatRuns.setState({ foregroundId: "chat-a" });
  vi.spyOn(HTMLElement.prototype, "getClientRects").mockReturnValue([{}] as unknown as DOMRectList);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  document.body.innerHTML = `<main data-working-content data-item-tab="form" data-window-active="true">
    <div data-agent-field="name"><label>Name</label><input required value="Private draft value" /></div>
    <button>Save</button>
  </main>`;
});
afterEach(() => {
  unmount();
  document.body.innerHTML = "";
  useChatRuns.setState({ foregroundId: null });
  vi.restoreAllMocks();
});

function request() {
  const snapshot = getGuidanceTargets();
  if (!snapshot.targets?.length) throw new Error("Expected visible targets");
  return {
    snapshotId: snapshot.snapshotId,
    targetId: snapshot.targets[0].targetId,
    title: "Name",
    message: "Enter a descriptive name here.",
  };
}

it("exposes labels and capabilities, without form values or private/hidden/inactive fields", () => {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
    <div data-agent-field="password"><label>Password</label><input type="password" /></div>
    <div data-agent-context="off"><div data-agent-field="secret"><label>Secret</label></div></div>
    <div hidden><div data-agent-field="hidden"><label>Hidden</label></div></div>
    <div data-item-tab="other" data-window-active="false"><div data-agent-field="other"><label>Other tab</label></div></div>`,
  );
  const result = getGuidanceTargets();
  expect(result.targets?.map((target) => target.label)).toEqual(["Name", "Save"]);
  expect(result.targets?.[0]).toMatchObject({ kind: "field", required: true });
  expect(JSON.stringify(result)).not.toContain("Private draft value");
});

it("uses domain field boundaries once and links existing context refs", () => {
  const cleanup = registerGuidanceSource("domain", {
    selector: "[data-domain-field]",
    label: () => "Domain name",
    contextRefId: () => "entity:name",
  });
  try {
    document.querySelector("main")!.innerHTML =
      `<section data-domain-field><div data-agent-field="name"><label>Name</label><input /></div></section>`;
    expect(getGuidanceTargets().targets).toEqual([
      expect.objectContaining({ label: "Domain name", contextRefId: "entity:name" }),
    ]);
  } finally {
    cleanup();
  }
});

it("shows a hint without changing focus or values and rejects arbitrary selectors", () => {
  const input = document.querySelector("input")!;
  input.focus();
  const args = request();
  expect(showTeachingBubble({ ...args, targetId: "body" }).status).toBe("target_not_found");
  expect(showTeachingBubble(args).status).toBe("shown");
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("Private draft value");
  expect(useTeachingBubble.getState().bubble?.title).toBe("Name");
});

it("refuses stale targets after a conversation change, window change, expiry or removal", () => {
  let args = request();
  useChatRuns.setState({ foregroundId: "chat-b" });
  expect(showTeachingBubble(args).status).toBe("stale_context");
  args = request();
  document.querySelector<HTMLElement>("main")!.dataset.itemTab = "different";
  expect(showTeachingBubble(args).status).toBe("stale_context");
  args = request();
  const now = Date.now();
  const clock = vi.spyOn(Date, "now").mockReturnValue(now + 121_000);
  expect(showTeachingBubble(args).status).toBe("stale_context");
  clock.mockRestore();
  args = request();
  document.querySelector("[data-agent-field]")!.remove();
  expect(showTeachingBubble(args).status).toBe("target_not_found");
});

it("invalidates a displayed hint when its field becomes private or hidden", () => {
  showTeachingBubble(request());
  const bubble = useTeachingBubble.getState().bubble!;
  expect(teachingBubbleIsCurrent(bubble)).toBe(true);
  bubble.element.setAttribute("data-agent-context", "off");
  expect(teachingBubbleIsCurrent(bubble)).toBe(false);
  dismissTeachingBubble();
  expect(useTeachingBubble.getState().bubble).toBeNull();
});

it("does not expose targets when no shell host is mounted", () => {
  unmount();
  unmount = () => {};
  expect(getGuidanceTargets().status).toBe("unavailable");
});

it("supports ordinary framework controls and chat inputs without explicit registration", () => {
  document.body.innerHTML =
    '<nav><a href="/spaces">Spaces</a></nav><textarea aria-label="Chat message">Unsent draft</textarea><label for="search">Search</label><input id="search" value="private value" /><button aria-label="Create a space">+</button><button role="tab">Details</button>';
  const targets = getGuidanceTargets().targets!;
  expect(targets.map((target) => target.label)).toEqual(
    expect.arrayContaining(["Spaces", "Chat message", "Search", "Create a space", "Details"]),
  );
  expect(targets.find((target) => target.label === "Chat message")?.kind).toBe("field");
  expect(JSON.stringify(targets)).not.toMatch(/Unsent draft|private value/);
});

it("reports capability flags on semantic custom controls themselves", () => {
  document.body.innerHTML =
    '<div role="combobox" aria-label="Owner" aria-disabled="true" aria-required="true" aria-invalid="true"></div>';
  expect(getGuidanceTargets().targets).toEqual([
    expect.objectContaining({ label: "Owner", disabled: true, required: true, invalid: true }),
  ]);
});
