import { useEffect } from "react";
import { useAui } from "@assistant-ui/react";
import { useComposerSubmitStore } from "../lib/composer-submit-store.ts";

/**
 * Sends text a module submitted on the user's behalf — a spoken turn, most of
 * the time — through the ordinary composer.
 *
 * The composer stays editable while a module is using it, so the user's own
 * draft can be sitting in it when a turn arrives. Sending would take that with
 * it, so the text is saved and put back.
 *
 * **Attachments are NOT preserved**, and that is a decision rather than an
 * oversight. There is no way to send without them — `SendOptions` is
 * `{ startRun, steer }` — so preserving them means lifting them out of the
 * composer, sending, and adding them back. That is asynchronous, through a
 * host-supplied adapter, and it produced four separate defects in short order:
 * a cancellation check that dropped them mid-sequence, two turns interleaving
 * their save/restore, a stalled upload wedging every later turn, and a
 * timed-out operation landing on a later turn instead. Each fix was correct
 * and each one exposed the next.
 *
 * So this stays synchronous, which is what makes it easy to be sure about: no
 * queue, no timeout, no window in which a second turn can interleave. A file
 * attached but not yet sent goes with the spoken turn, exactly as it did
 * before any of this — a real limitation, and a smaller one than the failures
 * that came with trying to remove it. It is worth revisiting if the composer
 * ever grows a way to send without attachments.
 */
export function ComposerSubmitBridge() {
  const aui = useAui();
  const pending = useComposerSubmitStore((s) => s.pending);

  useEffect(() => {
    if (!pending) return;
    // Claim first, send second. Several bridges may be mounted at once, and
    // StrictMode runs this effect twice; both would otherwise send the same
    // text before either had cleared it.
    if (!useComposerSubmitStore.getState().claim(pending.id)) return;

    const draft = aui.composer.getState().text;

    // send() starts the run for the queued text; steering/queueing semantics
    // are handled by the composer client (assistant-ui >= 0.15).
    aui.composer.setText(pending.text);
    aui.composer.send();

    // send() clears the composer, so this restores the user's own text into an
    // empty box rather than appending it to the turn just sent.
    if (draft) aui.composer.setText(draft);
  }, [aui, pending]);

  return null;
}
