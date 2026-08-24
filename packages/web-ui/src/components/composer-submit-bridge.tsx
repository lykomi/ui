import { useEffect } from "react";
import { useAui } from "@assistant-ui/react";
import { useComposerSubmitStore } from "../lib/composer-submit-store.ts";

/**
 * Sends text a module submitted on the user's behalf — a spoken turn, most of
 * the time — through the ordinary composer.
 *
 * The composer stays editable while a voice call runs, so the user's own draft
 * can be sitting in it when a spoken turn arrives. Sending then takes the
 * composer as it stands: the transcript is posted with their half-written text
 * replaced and their attachment carried along with a sentence it has nothing
 * to do with. Text is saved and restored; attachments are lifted out first and
 * put back after, but only when every one of them can be put back.
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

    void (async () => {
      const { text: draft, attachments } = aui.composer.getState();

      // Re-adding needs the original File. Anything the user just attached has
      // one; an attachment that has been through an adapter may not. Lifting
      // out a set we cannot fully restore would turn "sent with the wrong
      // message" into "lost", so in that case leave them where they are — no
      // worse than before, and never destructive.
      const files = attachments.map((a) => a.file).filter((f): f is File => f instanceof File);
      const restorable = files.length === attachments.length;
      // No bail-out past this point. Once the attachments are out of the
      // composer the sequence has to finish, or they are lost and nothing is
      // sent — worse than either thing it was guarding against. `claim()`
      // already guarantees a single runner, so there is nothing to race.
      if (restorable && attachments.length > 0) await aui.composer.clearAttachments();

      // send() starts the run for the queued text; steering/queueing semantics
      // are handled by the composer client (assistant-ui >= 0.15).
      aui.composer.setText(pending.text);
      aui.composer.send();

      // send() clears the composer, so this restores the user's own work into
      // an empty box rather than appending it to the turn just sent.
      if (draft) aui.composer.setText(draft);
      if (restorable) for (const file of files) await aui.composer.addAttachment(file);
    })();
  }, [aui, pending]);

  return null;
}
