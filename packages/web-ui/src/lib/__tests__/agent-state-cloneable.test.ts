/**
 * The agent state projection must survive `structuredClone`.
 *
 * A downstream app kept a nav group's rendered chat list — items with icon
 * components and action handlers — in the group's `meta`. Opening a chat from
 * that group put the list into the projection, the adapter's clone threw
 * `Symbol(react.forward_ref) could not be cloned`, and every message in a
 * reopened chat failed in the browser before a request was made.
 */
import { forwardRef, createElement } from "react";
import { beforeEach, describe, expect, it } from "vitest";

import { toAgentData } from "../agent-data";
import { useAppStore } from "../app-store";

const Icon = forwardRef<SVGSVGElement>(function Icon(_props, ref) {
  return createElement("svg", { ref });
});

const navItem = (label: string) => ({
  to: `/chat/${label}`,
  label,
  icon: Icon,
  meta: { pinned: false },
  actions: [
    { label: "Rename", icon: Icon, handler: () => undefined },
    { label: "Delete", icon: Icon, handler: () => undefined },
  ],
});

beforeEach(() => {
  useAppStore.setState({
    currentPage: "/chat/a",
    navContext: {
      group: "Recent chats",
      groupDescription: null,
      groupMeta: {
        type: "recent-chats",
        workspaceId: "ws-1",
        allConversations: [navItem("a"), navItem("b")],
      },
      label: "a",
      description: null,
      meta: { entityId: "e-1", renderRow: () => null },
      contextInstructions: null,
    },
    content: { page: "chat", header: createElement("h1", null, "Chat") },
    contextItems: [],
  });
});

describe("agent state projection", () => {
  it("can be cloned when nav metadata holds rendered items", () => {
    const projection = useAppStore.getState().getAgentState();

    expect(() => structuredClone(projection)).not.toThrow();
  });

  it("keeps the data and leaves the UI objects out whole", () => {
    const { navigation, content } = useAppStore.getState().getAgentState();

    expect(navigation.groupMeta).toEqual({ type: "recent-chats", workspaceId: "ws-1" });
    // The page's own meta and content are containers: only their UI
    // entries go.
    expect(navigation.meta).toEqual({ entityId: "e-1" });
    expect(content).toEqual({ page: "chat" });
  });
});

describe("toAgentData", () => {
  it("passes plain data through unchanged", () => {
    const date = new Date(0);
    const data = {
      a: 1,
      b: "x",
      c: null,
      d: [1, { e: true }],
      f: { g: { h: [] } },
      date,
    };

    expect(toAgentData(data)).toEqual(data);
  });

  it("drops a list made only of UI objects rather than leaving it empty", () => {
    expect(toAgentData({ items: [navItem("a")], kept: [] })).toEqual({ kept: [] });
  });

  it("keeps the data entries of a mixed list", () => {
    expect(toAgentData({ items: [navItem("a"), { id: "x" }] })).toEqual({
      items: [{ id: "x" }],
    });
  });

  it("does not loop on a cycle", () => {
    const a: Record<string, unknown> = { id: "a" };
    a.self = a;

    expect(toAgentData(a)).toEqual({ id: "a" });
  });

  it("keeps deep data that clones today", () => {
    let deep: Record<string, unknown> = { leaf: "x" };
    for (let i = 0; i < 40; i++) deep = { child: deep };

    expect(toAgentData({ deep })).toEqual({ deep });
  });

  it("treats only a symbol-valued $$typeof as React", () => {
    const data = { node: { $$typeof: "schema-node", value: 3 } };

    expect(toAgentData(data)).toEqual(data);
  });

  it("keeps a __proto__ key as data, not as the prototype", () => {
    const data = JSON.parse('{"__proto__": {"polluted": true}, "a": 1}');
    const out = toAgentData(data);

    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(out, "__proto__")).toBe(true);
    expect((out as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("walks Map and Set entries so the clone cannot throw", () => {
    const out = toAgentData({
      byId: new Map<string, unknown>([
        ["a", { id: "a" }],
        ["b", navItem("b")],
      ]),
      tags: new Set<unknown>(["x", () => undefined]),
    });

    expect(() => structuredClone(out)).not.toThrow();
    expect(out.byId).toEqual(new Map([["a", { id: "a" }]]));
    expect(out.tags).toEqual(new Set(["x"]));
  });
});
