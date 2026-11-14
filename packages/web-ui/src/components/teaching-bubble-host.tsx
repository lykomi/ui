import { useEffect, useId, useMemo, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import * as Popover from "@radix-ui/react-popover";
import { Sparkles, X } from "lucide-react";
import { Button } from "@lykomi/web-primitives";
import { ThemeScope } from "./theme-runtime-provider.tsx";
import { useChatRuns } from "../lib/chat-runs-store.ts";
import {
  dismissTeachingBubble,
  mountTeachingBubbleHost,
  teachingBubbleIsCurrent,
  useTeachingBubble,
} from "../lib/teaching-bubble-store.ts";

/** A portaled ring escapes toolbar overflow without changing the target's layout. */
function TeachingHighlight({ element }: { element: HTMLElement }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    let frame = 0;
    let previous = "";
    const position = () => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const geometry = `${rect.x},${rect.y},${rect.width},${rect.height},${style.borderRadius}`;
      if (ref.current && geometry !== previous) {
        previous = geometry;
        Object.assign(ref.current.style, {
          left: `${rect.left - 4}px`,
          top: `${rect.top - 4}px`,
          width: `${rect.width + 8}px`,
          height: `${rect.height + 8}px`,
          borderRadius: `${(parseFloat(style.borderRadius) || 0) + 4}px`,
        });
      }
      frame = requestAnimationFrame(position);
    };
    position();
    return () => cancelAnimationFrame(frame);
  }, [element]);
  return (
    <ThemeScope style={{ display: "contents" }}>
      <div
        ref={ref}
        aria-hidden="true"
        data-guidance-ignore
        data-teaching-ring=""
        className="pointer-events-none fixed z-[99] border-2 border-agent"
      />
    </ThemeScope>
  );
}

/** Mount once in the shell, independently of collapsed transcript tool cards. */
export function TeachingBubbleHost() {
  const bubble = useTeachingBubble((state) => state.bubble);
  const titleId = useId();
  const descriptionId = useId();
  const anchor = useMemo(() => ({ current: bubble?.element ?? null }), [bubble]);
  useEffect(mountTeachingBubbleHost, []);
  useEffect(() => {
    if (!bubble) return;
    const element = bubble.element;
    element.setAttribute("data-teaching-highlight", "true");
    const check = () => {
      if (!teachingBubbleIsCurrent(bubble)) dismissTeachingBubble();
    };
    const observer = new MutationObserver(check);
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "hidden",
        "aria-hidden",
        "inert",
        "style",
        "class",
        "data-window-active",
        "data-item-tab",
        "data-agent-context",
      ],
    });
    const unsubscribe = useChatRuns.subscribe(check);
    window.addEventListener("popstate", check);
    window.addEventListener("resize", check);
    return () => {
      observer.disconnect();
      unsubscribe();
      window.removeEventListener("popstate", check);
      window.removeEventListener("resize", check);
      element.removeAttribute("data-teaching-highlight");
    };
  }, [bubble]);
  if (!bubble) return null;
  return (
    <Popover.Root open modal={false} onOpenChange={(open) => !open && dismissTeachingBubble()}>
      <Popover.Anchor virtualRef={anchor} />
      {createPortal(<TeachingHighlight element={bubble.element} />, document.body)}
      <Popover.Portal
        container={bubble.element.closest<HTMLElement>("[role='dialog']") ?? undefined}
      >
        <Popover.Content
          data-guidance-ignore
          aria-labelledby={titleId}
          aria-describedby={descriptionId}
          side="bottom"
          align="start"
          sideOffset={12}
          collisionPadding={16}
          hideWhenDetached
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="z-[100] w-80 max-w-[calc(100vw-2rem)] outline-none"
        >
          <ThemeScope className="rounded-lg border border-agent/40 bg-popover p-4 text-popover-foreground shadow-xl">
            <div className="mb-2 flex items-center gap-2 text-xs text-agent">
              <Sparkles className="size-4" />
              <span className="flex-1">Guide</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-6"
                aria-label="Close guidance"
                onClick={dismissTeachingBubble}
              >
                <X className="size-4" />
              </Button>
            </div>
            <h3 id={titleId} className="text-sm font-medium">
              {bubble.title}
            </h3>
            <p id={descriptionId} className="mt-1 text-sm text-muted-foreground" aria-live="polite">
              {bubble.message}
            </p>
          </ThemeScope>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
