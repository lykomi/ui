import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { ComposerPrimitive, useAuiState } from "@assistant-ui/react";

/** Re-measure autosizing when a pane changes width, not just on window resize. */
export function ComposerInput(props: ComponentProps<typeof ComposerPrimitive.Input>) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [width, setWidth] = useState(0);
  const hasText = useAuiState((state) => state.composer.text.length > 0);
  useLayoutEffect(() => {
    const input = ref.current;
    if (!input || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      const next = entry?.contentRect.width ?? 0;
      // Height changes are autosize's output. Only width is an input.
      if (next > 0) setWidth(next);
    });
    observer.observe(input);
    return () => observer.disconnect();
  }, []);
  return (
    <ComposerPrimitive.Input
      aria-label="Chat message"
      {...props}
      ref={ref}
      data-composer-width={width}
      minRows={props.minRows ?? 1}
      maxRows={hasText ? props.maxRows : 1}
    />
  );
}
