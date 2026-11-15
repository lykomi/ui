import { useEffect, useState, type RefObject } from "react";
import { clientToolRegistry } from "@lykomi/agent";
import { useAppStore } from "@lykomi/web-ui";

/** Preview the real request projection; never create a second context model. */
export function useContextPreview(surface: RefObject<HTMLElement | null>) {
  const [snapshot, setSnapshot] = useState("");
  useEffect(() => {
    let frame = 0;
    const read = () => {
      frame = 0;
      const next = JSON.stringify(
        {
          state: useAppStore.getState().getAgentState(),
          tools: clientToolRegistry.getState().getActiveSchemas(),
        },
        null,
        2,
      );
      setSnapshot((previous) => (previous === next ? previous : next));
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const events = [
      "focusin",
      "input",
      "change",
      "select",
      "selectionchange",
      "pointerup",
      "keyup",
    ];
    for (const event of events) document.addEventListener(event, schedule, true);
    const unsubscribeState = useAppStore.subscribe(schedule);
    const unsubscribeTools = clientToolRegistry.subscribe(schedule);
    const observer = new MutationObserver(schedule);
    if (surface.current)
      observer.observe(surface.current, {
        subtree: true,
        childList: true,
        characterData: true,
        attributes: true,
      });
    schedule();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      unsubscribeState();
      unsubscribeTools();
      for (const event of events) document.removeEventListener(event, schedule, true);
    };
  }, [surface]);
  return snapshot;
}
