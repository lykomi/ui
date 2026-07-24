/**
 * Chat extension slots — module-injectable UI anchored to the chat chrome.
 *
 * Modules (via ``bootstrapShell``) sometimes need to render inside the
 * chat surfaces the shell owns — e.g. a background-task progress strip
 * pinned above the composer, or an activity badge on the collapsed chat
 * launcher. Threading those through props would couple the shell to
 * feature modules, so this is a tiny registry instead: a module calls
 * :func:`registerChatSlots` once (import time or ``useInit``) and the
 * shell's chat components render the slots wherever they belong.
 *
 * Render points:
 *   - ``composerBanner`` — directly above the composer in BOTH the full
 *     chat (``ChatContent``) and the floating bubble panel. It renders
 *     inside a fixed (non-scrolling) footer, so it never scrolls away
 *     with the thread.
 *   - ``launcherBadge`` — inside the collapsed chat-bubble launcher's
 *     wrapper (a positioned ``group`` container around the round button),
 *     so a badge can position itself absolutely over the button and use
 *     ``group-hover:`` styles for a hover flyout.
 */

import type { ComponentType } from "react";
import { create } from "zustand";

interface ChatSlotsState {
  composerBanner: ComponentType | null;
  launcherBadge: ComponentType | null;
}

export const useChatSlotsStore = create<ChatSlotsState>(() => ({
  composerBanner: null,
  launcherBadge: null,
}));

/**
 * Register chat slot components. Later calls overwrite only the keys
 * they pass, so independent modules can each claim a different slot.
 * Explicit ``null`` clears a slot; ``undefined`` values are ignored so
 * an optional-spread caller can't corrupt the state shape.
 */
export function registerChatSlots(slots: Partial<ChatSlotsState>): void {
  const next: Partial<ChatSlotsState> = {};
  if (slots.composerBanner !== undefined) next.composerBanner = slots.composerBanner;
  if (slots.launcherBadge !== undefined) next.launcherBadge = slots.launcherBadge;
  useChatSlotsStore.setState(next);
}

export function ChatComposerBannerSlot() {
  const Banner = useChatSlotsStore((s) => s.composerBanner);
  return Banner ? <Banner /> : null;
}

export function ChatLauncherBadgeSlot() {
  const Badge = useChatSlotsStore((s) => s.launcherBadge);
  return Badge ? <Badge /> : null;
}
