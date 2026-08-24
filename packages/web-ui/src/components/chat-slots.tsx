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
 *   - ``composerActions`` — in the composer's trailing control row, just
 *     before Send, in BOTH the full chat and the floating bubble panel.
 *     For controls that are an alternative *way to send* rather than
 *     content about the thread — a push-to-talk mic, say. Leading-edge
 *     controls (attach, context pins) stay owned by the composer itself.
 *
 * A module that registers ``composerActions`` may also claim the Send
 * position while the composer is empty (``composerActionsReplaceSend``).
 * That is the shape a voice control wants: nothing has been typed, so Send
 * has nothing to do, and the corner belongs to the other way of asking.
 * Type one character and Send comes back. Opt-in, because a slot holding
 * something unrelated must not make Send disappear.
 */

import type { ComponentType } from "react";
import { create } from "zustand";
import { useAuiState } from "@assistant-ui/react";

interface ChatSlotsState {
  composerBanner: ComponentType | null;
  launcherBadge: ComponentType | null;
  composerActions: ComponentType | null;
  /** Let ``composerActions`` stand in for Send while the composer is empty. */
  composerActionsReplaceSend: boolean;
}

export const useChatSlotsStore = create<ChatSlotsState>(() => ({
  composerBanner: null,
  launcherBadge: null,
  composerActions: null,
  composerActionsReplaceSend: false,
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
  if (slots.composerActions !== undefined) next.composerActions = slots.composerActions;
  if (slots.composerActionsReplaceSend !== undefined) {
    next.composerActionsReplaceSend = slots.composerActionsReplaceSend;
  }
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

export function ChatComposerActionsSlot() {
  const Actions = useChatSlotsStore((s) => s.composerActions);
  return Actions ? <Actions /> : null;
}

/**
 * True when Send should stand aside for the ``composerActions`` slot: a
 * module claimed the position and there is nothing to send.
 */
export function useComposerActionsOwnSend(): boolean {
  const claimed = useChatSlotsStore((s) => s.composerActionsReplaceSend && !!s.composerActions);
  const isEmpty = useAuiState((s) => s.optional.composer?.isEmpty ?? true);
  return claimed && isEmpty;
}
