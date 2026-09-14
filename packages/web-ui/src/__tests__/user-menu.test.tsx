import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { authStore } from "@iloveagents/foundry-agent/msal";
import { UserMenu } from "../components/user-menu.tsx";

afterEach(() => {
  authStore.setState({ user: null, isAuthenticated: false });
  document.body.replaceChildren();
});

describe("UserMenu", () => {
  it("keeps the UI chooser available with a custom auth adapter", async () => {
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);

    await act(async () => root.render(<UserMenu />));

    expect(host.querySelector('[aria-label="Interface menu"]')).not.toBeNull();
    await act(async () => root.unmount());
  });
});
