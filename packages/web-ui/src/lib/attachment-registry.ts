/**
 * Attachment adapter registry — host-injectable composer attachment handling.
 *
 * The shell's AG-UI runtime builds its attachment adapter internally
 * (``FileAttachmentAdapter``), which reads files client-side and inlines
 * them as base64 message parts. Hosts sometimes need a different
 * strategy — e.g. uploading Office documents into a backend workspace
 * and handing the agent a reference instead of bytes. Threading an
 * adapter through every chat mount would couple the shell to feature
 * modules, so this is a tiny registry instead — the exact pattern of
 * ``registerChatSlots``: a module calls :func:`registerAttachmentAdapter`
 * once (import time or ``useInit``) and the runtime provider picks it up
 * on its next mount.
 *
 * Compose, don't replace: hosts typically wrap their special-case
 * adapter together with the default in assistant-ui's
 * ``CompositeAttachmentAdapter`` so images/PDF keep the stock inline
 * behavior while selected types get the custom path. The composite also
 * closes the drag-and-drop loophole — its ``add()`` rejects files no
 * member adapter accepts, whereas drops bypass the file picker's
 * ``accept`` filter.
 */

import type { AttachmentAdapter } from "@assistant-ui/react";
import { create } from "zustand";

interface AttachmentAdapterState {
  adapter: AttachmentAdapter | null;
}

export const useAttachmentAdapterStore = create<AttachmentAdapterState>(() => ({
  adapter: null,
}));

/**
 * Register the composer attachment adapter. ``null`` restores the
 * shell's default (``FileAttachmentAdapter``). Later calls overwrite
 * earlier ones — last registration wins.
 */
export function registerAttachmentAdapter(adapter: AttachmentAdapter | null): void {
  useAttachmentAdapterStore.setState({ adapter });
}
