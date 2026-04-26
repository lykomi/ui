import { beforeEach, describe, expect, it } from "vitest";
import { authStore } from "../msal/auth-store.ts";

const store = () => authStore.getState();

describe("authStore", () => {
  beforeEach(() => {
    authStore.setState({ user: null, isAuthenticated: false });
  });

  it("starts unauthenticated", () => {
    expect(store().isAuthenticated).toBe(false);
    expect(store().user).toBeNull();
  });

  it("signs in with a user", () => {
    store().signIn({ name: "Alice", email: "alice@example.com" });
    expect(store().isAuthenticated).toBe(true);
    expect(store().user?.name).toBe("Alice");
  });

  it("signs out and clears user", () => {
    store().signIn({ name: "Alice", email: "alice@example.com" });
    store().signOut();
    expect(store().isAuthenticated).toBe(false);
    expect(store().user).toBeNull();
  });

  it("signs in with avatar", () => {
    store().signIn({
      name: "Bob",
      email: "bob@example.com",
      avatar: "https://example.com/bob.png",
    });
    expect(store().user?.avatar).toBe("https://example.com/bob.png");
  });
});
