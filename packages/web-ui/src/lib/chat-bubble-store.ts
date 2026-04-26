/**
 * Chat Bubble Store — manages chat display mode as a layout state.
 *
 * Four modes: CLOSED → BUBBLE → EXPANDED → FULL
 * - CLOSED: only trigger button visible
 * - BUBBLE (isOpen): floating 380x600 chat panel
 * - EXPANDED (isExpanded): chat fills main area, page goes to panel
 * - FULL: expanded with page panel closed
 *
 * No route changes. The URL stays the same in all modes.
 */

import { create } from "zustand";

interface ChatBubbleState {
  /** Bubble floating panel is visible */
  isOpen: boolean;
  /** Chat is expanded into the main layout area */
  isExpanded: boolean;
  /** Page panel visible in expanded mode (false = FULL mode) */
  showPagePanel: boolean;

  open: () => void;
  close: () => void;
  toggle: () => void;
  /** Expand: hide bubble, show chat in main layout */
  expand: () => void;
  /** Collapse: hide expanded chat, show bubble */
  collapse: () => void;
  /** Toggle page panel in expanded mode (EXPANDED ↔ FULL) */
  togglePagePanel: () => void;
}

export const useChatBubbleStore = create<ChatBubbleState>((set) => ({
  isOpen: false,
  isExpanded: false,
  showPagePanel: true,

  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false, isExpanded: false }),
  toggle: () => set((s) => ({ isOpen: !s.isOpen })),

  expand: () => set({ isOpen: false, isExpanded: true, showPagePanel: true }),
  collapse: () => set({ isOpen: true, isExpanded: false }),
  togglePagePanel: () => set((s) => ({ showPagePanel: !s.showPagePanel })),
}));
