import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { authStore } from "@lykomi/agent/msal";
import { UserMenu } from "../components/user-menu.tsx";
import { useNavStore } from "../lib/nav-store.ts";

afterEach(() => {
  authStore.setState({ user: null, isAuthenticated: false });
  useNavStore.setState({ userMenuToggles: [], userMenuActions: [] });
  document.body.replaceChildren();
});

describe("UserMenu", () => {
  it("runs a registered action as a regular menu item", async () => {
    let selected = 0;
    useNavStore.getState().setUserMenuAction({
      id: "account-settings",
      label: "Account settings",
      onSelect: () => selected++,
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<UserMenu />));
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Interface menu"]')!;
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const item = Array.from(document.querySelectorAll<HTMLElement>('[role="menuitem"]')).find(
      (node) => node.textContent === "Account settings",
    );
    expect(item).toBeDefined();
    expect(item?.getAttribute("aria-checked")).toBeNull();
    await act(async () => item!.click());
    expect(selected).toBe(1);
    await act(async () => root.unmount());
  });

  it("replaces an action without duplicating it and removes it on cleanup", () => {
    const action = { id: "settings", label: "Settings", onSelect: () => {} };
    useNavStore.getState().setUserMenuAction(action);
    useNavStore.getState().setUserMenuAction({ ...action, label: "Account settings" });
    expect(useNavStore.getState().userMenuActions).toEqual([
      { ...action, label: "Account settings" },
    ]);
    useNavStore.getState().removeUserMenuAction(action.id);
    expect(useNavStore.getState().userMenuActions).toEqual([]);
  });
  it("hides the menu when there is no user or toggle", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(<UserMenu />));

    expect(host.querySelector('[aria-label="Interface menu"]')).toBeNull();
    await act(async () => root.unmount());
  });

  it("offers the toggles an app registers, and reports a change to it", async () => {
    const changes: boolean[] = [];
    useNavStore.getState().setUserMenuToggle({
      id: "show-hidden",
      label: "Show hidden items",
      checked: false,
      onCheckedChange: (checked) => changes.push(checked),
    });
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    await act(async () => root.render(<UserMenu />));
    const trigger = host.querySelector<HTMLButtonElement>('[aria-label="Interface menu"]')!;
    await act(async () => {
      trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });
    const item = Array.from(document.querySelectorAll("[role='menuitemcheckbox']")).find(
      (node) => node.textContent === "Show hidden items",
    ) as HTMLElement | undefined;
    expect(item?.getAttribute("aria-checked")).toBe("false");
    await act(async () => item!.click());
    expect(changes).toEqual([true]);
    await act(async () => root.unmount());
  });

  it("replaces a toggle by id and removes it", () => {
    const toggle = { id: "t", label: "One", checked: false, onCheckedChange: () => {} };
    useNavStore.getState().setUserMenuToggle(toggle);
    useNavStore.getState().setUserMenuToggle({ ...toggle, checked: true });
    expect(useNavStore.getState().userMenuToggles).toEqual([{ ...toggle, checked: true }]);
    useNavStore.getState().removeUserMenuToggle("t");
    expect(useNavStore.getState().userMenuToggles).toEqual([]);
  });
});
