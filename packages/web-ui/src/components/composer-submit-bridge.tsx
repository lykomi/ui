import { useEffect } from "react";
import { useAui } from "@assistant-ui/react";
import { useComposerSubmitStore } from "../lib/composer-submit-store.ts";

/**
 * Sends text a module submitted on the user's behalf — a spoken turn, most of
 * the time — through the ordinary composer.
 *
 * The composer stays editable while a voice call is running, so the user's own
 * draft can be sitting in it when a spoken turn arrives. Overwriting it with
 * `setText()` and sending would post the transcript AND take whatever they had
 * typed (and any attachment) with it. The draft is put back afterwards, so a
 * half-written message survives being talked over.
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

    // `send()` clears the composer, so this restores the user's own text into
    // an empty box rather than appending to the sent turn.
    if (draft) aui.composer.setText(draft);
  }, [aui, pending]);

  return null;
}
