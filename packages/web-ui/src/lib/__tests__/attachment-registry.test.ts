/**
 * Attachment adapter registry — the contract hosts rely on to swap the
 * shell's inline-base64 attachment handling for their own (e.g. upload
 * Office files to a workspace and hand the agent a reference).
 */

import { afterEach, describe, expect, it } from "vitest";
import type { AttachmentAdapter } from "@assistant-ui/react";
import { registerAttachmentAdapter, useAttachmentAdapterStore } from "../attachment-registry.ts";

const fakeAdapter = (accept: string): AttachmentAdapter => ({
  accept,
  add: async () => ({}) as never,
  send: async () => ({}) as never,
  remove: async () => {},
});

describe("attachment adapter registry", () => {
  afterEach(() => {
    registerAttachmentAdapter(null);
  });

  it("starts empty so the runtime falls back to the default adapter", () => {
    expect(useAttachmentAdapterStore.getState().adapter).toBeNull();
  });

  it("stores a registered adapter for the runtime to pick up", () => {
    const adapter = fakeAdapter(".docx");
    registerAttachmentAdapter(adapter);
    expect(useAttachmentAdapterStore.getState().adapter).toBe(adapter);
  });

  it("last registration wins and null restores the default", () => {
    registerAttachmentAdapter(fakeAdapter(".docx"));
    const second = fakeAdapter(".xlsx");
    registerAttachmentAdapter(second);
    expect(useAttachmentAdapterStore.getState().adapter).toBe(second);

    registerAttachmentAdapter(null);
    expect(useAttachmentAdapterStore.getState().adapter).toBeNull();
  });
});
