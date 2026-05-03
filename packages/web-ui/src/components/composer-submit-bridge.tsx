import { useEffect } from "react";
import { useComposerRuntime } from "@assistant-ui/react";
import { useComposerSubmitStore } from "../lib/composer-submit-store.ts";

export function ComposerSubmitBridge() {
  const composerRuntime = useComposerRuntime();
  const pending = useComposerSubmitStore((s) => s.pending);

  useEffect(() => {
    if (!pending) return;

    composerRuntime.setText(pending.text);
    composerRuntime.send({ startRun: true });
    useComposerSubmitStore.getState().consume(pending.id);
  }, [composerRuntime, pending]);

  return null;
}

