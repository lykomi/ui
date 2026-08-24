import { useEffect } from "react";
import { useAui } from "@assistant-ui/react";
import { useComposerSubmitStore } from "../lib/composer-submit-store.ts";

/**
 * Sends text a module submitted on the user's behalf — a spoken turn, most of
 * the time — through the ordinary composer.
 *
 * The composer stays editable while a module is using it, so the user's own
 * work can be sitting in it when a turn arrives. Sending takes the composer as
 * it stands: their half-written text replaced, and their attachment carried
 * along with a sentence it has nothing to do with. Both are put back.
 *
 * Doing that spans ticks — attachments are lifted out and re-added
 * asynchronously — which is why submissions run one at a time. `claim()` stops
 * the same submission being sent twice; it says nothing about two DIFFERENT
 * submissions overlapping, and two overlapping save/restore sequences trample
 * each other's snapshots.
 *
 * The queue is module-level rather than per-component on purpose. Several
 * bridges can be mounted at once, and a bridge that unmounts mid-sequence
 * hands nothing over — with a queue each, the next bridge's turn simply
 * overtakes the one still in flight. What has to be serialised is access to
 * the composer, and there is one of those.
 */
let composerQueue: Promise<void> = Promise.resolve();

/**
 * How long one attachment operation may hold the queue.
 *
 * Attachment work goes through a host-supplied adapter and can stall — an
 * upload that never completes, a network that never answers. Awaiting it
 * unbounded inside a shared chain means one stalled file silently stops every
 * later turn from ever being sent, for the life of the page. That is the same
 * shape as the speech queue waiting on a `response.done` that never comes,
 * which is the bug this codebase already learned once.
 *
 * Timing out degrades the restore, not the send: the turn still goes, and the
 * worst case is attachments left where they were, which is where they were
 * before any of this.
 */
const ATTACHMENT_TIMEOUT_MS = 10_000;

/** Resolve when `work` does, or when it has taken too long. */
function bounded(work: Promise<unknown>): Promise<void> {
  return new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ATTACHMENT_TIMEOUT_MS);
    void work.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

export function ComposerSubmitBridge() {
  const aui = useAui();
  const pending = useComposerSubmitStore((s) => s.pending);
  useEffect(() => {
    if (!pending) return;
    // Claim first, send second. Several bridges may be mounted at once, and
    // StrictMode runs this effect twice; both would otherwise send the same
    // text before either had cleared it.
    if (!useComposerSubmitStore.getState().claim(pending.id)) return;

    composerQueue = composerQueue
      .then(async () => {
        const { attachments } = aui.composer.getState();

        // Re-adding needs the original File. Anything the user just attached
        // has one; an attachment that has been through an adapter may not.
        // Lifting out a set we cannot fully restore would turn "sent with the
        // wrong message" into "lost", so leave those in place — no worse than
        // before, and never destructive.
        const files = attachments.map((a) => a.file).filter((f): f is File => f instanceof File);
        const restorable = files.length === attachments.length;

        // No bail-out past this point. Once the attachments are out of the
        // composer the sequence has to finish, or they are lost and nothing is
        // sent — worse than either thing a cancellation check would guard.
        if (restorable && attachments.length > 0) await bounded(aui.composer.clearAttachments());

        // Snapshotted as late as possible: the user can keep typing while the
        // attachments are being lifted out, and an earlier snapshot would put
        // stale text back over what they have since written.
        const draft = aui.composer.getState().text;

        // send() starts the run for the queued text; steering/queueing
        // semantics are handled by the composer client (assistant-ui >= 0.15).
        aui.composer.setText(pending.text);
        aui.composer.send();

        // send() clears the composer, so this restores the user's own work
        // into an empty box rather than appending it to the turn just sent.
        if (draft) aui.composer.setText(draft);
        if (restorable) for (const file of files) await bounded(aui.composer.addAttachment(file));
      })
      // One failure must not wedge the chain for every later submission.
      .catch(() => {});
  }, [aui, pending]);

  return null;
}
