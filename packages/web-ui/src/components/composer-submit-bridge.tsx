import { useEffect } from "react";
import { useAui } from "@assistant-ui/react";
import { useComposerSubmitStore } from "../lib/composer-submit-store.ts";

export function ComposerSubmitBridge() {
  const aui = useAui();
  const pending = useComposerSubmitStore((s) => s.pending);

  useEffect(() => {
    if (!pending) return;

    // send() starts the run for the queued text; steering/queueing semantics
    // are handled by the composer client (assistant-ui >= 0.15).
    aui.composer.setText(pending.text);
    aui.composer.send();
    useComposerSubmitStore.getState().consume(pending.id);
  }, [aui, pending]);

  return null;
}

