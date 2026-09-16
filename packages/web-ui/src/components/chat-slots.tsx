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
 *   - ``homeStarters`` — contextual starters inside the empty chat home,
 *     alongside its introduction. The module owns discovery and execution.
 *   - ``composerBanner`` — directly above the composer in BOTH the full
 *     chat (``ChatContent``) and the floating bubble panel. It renders
 *     inside a fixed (non-scrolling) footer, so it never scrolls away
 *     with the thread.
 *   - ``contextDetails`` — grouped capabilities beneath the current context
 *     in the composer flyout. Call ``onDismiss`` before opening action dialogs.
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
 *   - ``threadSurface`` — rendered *instead of* the message viewport, for a
 *     mode that replaces the conversation rather than adding to it. A live
 *     voice call is the case it exists for: while you are talking, the
 *     transcript scrolling past is not what you are looking at. Unlike the
 *     other slots this one is set and cleared at runtime — registering a
 *     component IS the takeover, clearing it hands the thread back.
 *
 * A module that registers ``composerActions`` may also claim the Send
 * position while the composer is empty (``composerActionsReplaceSend``).
 * That is the shape a voice control wants: nothing has been typed, so Send
 * has nothing to do, and the corner belongs to the other way of asking.
 * Type one character and Send comes back. Opt-in, because a slot holding
 * something unrelated must not make Send disappear.
 */

import { useEffect, useState, type ComponentType } from "react";
import { create } from "zustand";
import { useAuiState } from "@assistant-ui/react";

interface ChatSlotsState {
  /** Contextual conversation starters. Only mounted on the empty chat home. */
  homeStarters: ComponentType | null;
  composerBanner: ComponentType | null;
  /** Extra capabilities in the context flyout. Providers own section headings
   * and can dismiss the flyout before opening a dialog or starting an action. */
  contextDetails: ComponentType<{ onDismiss: () => void }> | null;
  launcherBadge: ComponentType | null;
  composerActions: ComponentType | null;
  /** Let ``composerActions`` stand in for Send while the composer is empty. */
  composerActionsReplaceSend: boolean;
  /** Replaces the message viewport entirely while set. */
  threadSurface: ComponentType | null;
  /** The surface supplies its own controls. Hide (but retain) the text composer. */
  threadSurfaceHidesComposer: boolean;
}

export const useChatSlotsStore = create<ChatSlotsState>(() => ({
  homeStarters: null,
  composerBanner: null,
  contextDetails: null,
  launcherBadge: null,
  composerActions: null,
  composerActionsReplaceSend: false,
  threadSurface: null,
  threadSurfaceHidesComposer: false,
}));

const homeStarterHosts = new Map<symbol, { priority: number; order: number }>();
let homeStarterHostOrder = 0;
const useHomeStarterHostStore = create<{ active: symbol | null }>(() => ({ active: null }));

function refreshActiveHomeStarterHost() {
  let active: symbol | null = null;
  let bestPriority = Number.NEGATIVE_INFINITY;
  let bestOrder = Number.NEGATIVE_INFINITY;
  for (const [id, host] of homeStarterHosts) {
    if (
      host.priority > bestPriority ||
      (host.priority === bestPriority && host.order > bestOrder)
    ) {
      active = id;
      bestPriority = host.priority;
      bestOrder = host.order;
    }
  }
  useHomeStarterHostStore.setState({ active });
}

/**
 * Register chat slot components. Later calls overwrite only the keys
 * they pass, so independent modules can each claim a different slot.
 * Explicit ``null`` clears a slot; ``undefined`` values are ignored so
 * an optional-spread caller can't corrupt the state shape.
 */
export function registerChatSlots(slots: Partial<ChatSlotsState>): void {
  const next: Partial<ChatSlotsState> = {};
  if (slots.homeStarters !== undefined) next.homeStarters = slots.homeStarters;
  if (slots.composerBanner !== undefined) next.composerBanner = slots.composerBanner;
  if (slots.contextDetails !== undefined) next.contextDetails = slots.contextDetails;
  if (slots.launcherBadge !== undefined) next.launcherBadge = slots.launcherBadge;
  if (slots.composerActions !== undefined) next.composerActions = slots.composerActions;
  if (slots.composerActionsReplaceSend !== undefined) {
    next.composerActionsReplaceSend = slots.composerActionsReplaceSend;
  }
  if (slots.threadSurface !== undefined) next.threadSurface = slots.threadSurface;
  if (slots.threadSurfaceHidesComposer !== undefined) {
    next.threadSurfaceHidesComposer = slots.threadSurfaceHidesComposer;
  }
  useChatSlotsStore.setState(next);
}

export function ChatComposerBannerSlot() {
  const Banner = useChatSlotsStore((s) => s.composerBanner);
  return Banner ? <Banner /> : null;
}

export function ChatHomeStartersSlot({ priority = 0 }: { priority?: number }) {
  const [hostId] = useState(() => Symbol("chat-home-starters"));
  const active = useHomeStarterHostStore((state) => state.active);
  const Starters = useChatSlotsStore((s) => s.homeStarters);
  useEffect(() => {
    homeStarterHosts.set(hostId, { priority, order: ++homeStarterHostOrder });
    refreshActiveHomeStarterHost();
    return () => {
      homeStarterHosts.delete(hostId);
      refreshActiveHomeStarterHost();
    };
  }, [hostId, priority]);
  return active === hostId && Starters ? <Starters /> : null;
}

export function ChatContextDetailsSlot({ onDismiss }: { onDismiss: () => void }) {
  const Details = useChatSlotsStore((s) => s.contextDetails);
  return Details ? <Details onDismiss={onDismiss} /> : null;
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

/**
 * The module-supplied surface that replaces the message viewport, or null
 * when the thread should render normally.
 */
export function useChatThreadSurface(): ComponentType | null {
  return useChatSlotsStore((s) => s.threadSurface);
}
