import {
  cloneElement,
  useEffect,
  useId,
  useRef,
  type ComponentProps,
  type ReactElement,
  type ReactNode,
} from "react";
import { Popover, PopoverAnchor, PopoverContent } from "../ui/popover.tsx";

const focusableElements =
  "a[href], button, input, select, textarea, iframe, summary, [contenteditable], [tabindex]";

export function WindowTabPreview({
  title,
  description,
  preview,
  open,
  onOpenChange,
  children,
}: {
  title: string;
  description?: string;
  preview: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactElement<ComponentProps<"button">>;
}) {
  const titleId = useId();
  const descriptionId = useId();
  const interactive = preview != null;
  const trigger = useRef<HTMLButtonElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const enterOnOpen = useRef(false);
  const clearHover = () => clearTimeout(timer.current);
  useEffect(() => () => clearTimeout(timer.current), []);

  const changeOpen = (next: boolean) => {
    clearHover();
    if (!next) enterOnOpen.current = false;
    onOpenChange(next);
  };
  const leave = () => {
    clearHover();
    timer.current = setTimeout(() => {
      const focused = document.activeElement;
      if (content.current?.contains(focused)) return;
      if (focused === trigger.current && trigger.current?.matches(":focus-visible")) return;
      changeOpen(false);
    }, 220);
  };
  const enterPreview = () => {
    if (!content.current) return false;
    const candidates = content.current.querySelectorAll<HTMLElement>(focusableElements);
    for (const candidate of candidates) {
      if (
        candidate.tabIndex < 0 &&
        (candidate.hasAttribute("tabindex") || !candidate.isContentEditable)
      )
        continue;
      candidate.focus({ preventScroll: true });
      if (document.activeElement === candidate) return true;
    }
    return false;
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverAnchor asChild>
        {cloneElement(children, {
          ref: trigger,
          "aria-haspopup": interactive ? "dialog" : undefined,
          "aria-expanded": interactive ? open : undefined,
          "aria-describedby": !interactive && open && description ? descriptionId : undefined,
          onPointerEnter: (event) => {
            clearHover();
            if (event.pointerType !== "touch" && event.buttons === 0 && !open)
              timer.current = setTimeout(() => changeOpen(true), 350);
          },
          onPointerLeave: leave,
          onPointerDownCapture: () => changeOpen(false),
          onFocus: (event) => {
            if (event.currentTarget.matches(":focus-visible")) changeOpen(true);
          },
          onKeyDown: (event) => {
            children.props.onKeyDown?.(event);
            if (event.defaultPrevented) return;
            const forwardTab = event.key === "Tab" && !event.shiftKey;
            if (!interactive || (event.key !== "ArrowDown" && !forwardTab)) return;
            if (open) {
              if (enterPreview()) event.preventDefault();
            } else if (event.key === "ArrowDown") {
              event.preventDefault();
              enterOnOpen.current = true;
              changeOpen(true);
            }
          },
        })}
      </PopoverAnchor>
      <PopoverContent
        ref={content}
        role={interactive ? "dialog" : "tooltip"}
        aria-labelledby={interactive ? titleId : undefined}
        side="bottom"
        align="start"
        sideOffset={4}
        collisionPadding={12}
        hideWhenDetached
        onPointerEnter={clearHover}
        onPointerLeave={leave}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          if (enterOnOpen.current) {
            enterOnOpen.current = false;
            enterPreview();
          }
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault();
          if (content.current?.contains(document.activeElement))
            trigger.current?.focus({ preventScroll: true });
          changeOpen(false);
        }}
        onInteractOutside={(event) => {
          if (event.target instanceof Node && trigger.current?.contains(event.target))
            event.preventDefault();
        }}
        className="z-[80] max-w-[min(28rem,var(--radix-popover-content-available-width))] wrap-anywhere rounded-lg px-3 py-2 shadow-md"
      >
        <div id={titleId} className="text-sm font-medium">
          {title}
        </div>
        {interactive ? (
          <div className="mt-1">{preview}</div>
        ) : description ? (
          <div id={descriptionId} className="mt-1 text-muted-foreground">
            {description}
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
