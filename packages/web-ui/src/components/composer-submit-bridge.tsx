import { useEffect } from "react";
import { ASSISTANT_CONTEXT_KEY } from "../lib/assistant-context.ts";
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

    const draft = aui.composer.getState();
    if (pending.kind === "help") {
      // Programmatic help is its own message. composer.send() awaits attachment
      // resolution BEFORE capturing runConfig, so temporarily setting/restoring
      // composer config loses this context even when no attachments exist.
      // Append message + config atomically to the same runtime instead. The
      // user's draft, quote and attachments are untouched.
      aui.thread.append({
        role: "user",
        content: [{ type: "text", text: pending.text }],
        runConfig: {
          ...draft.runConfig,
          ...(pending.context
            ? { custom: { ...draft.runConfig?.custom, [ASSISTANT_CONTEXT_KEY]: pending.context } }
            : {}),
        },
      });
      return;
    }

    // Ordinary text submissions (including voice) retain composer semantics.
    aui.composer.setText(pending.text);
    aui.composer.send();
    if (draft.text) aui.composer.setText(draft.text);
  }, [aui, pending]);

  return null;
}
