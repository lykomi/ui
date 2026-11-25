import { ReorderTabButton } from "./window-reorder.tsx";
import { PinToggle } from "../components/pin-toggle.tsx";
import { useLayoutEffect, useRef, useState, type ReactElement } from "react";
import { Check, ChevronDown, Pin, X } from "lucide-react";
import { Button } from "@lykomi/web-primitives";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "../ui/dropdown-menu.tsx";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip.tsx";
import type { WindowController, WorkbenchWindow } from "./window-controller.ts";

function revealTab(viewport: HTMLElement, tab: HTMLElement) {
  const previousScroll = viewport.scrollLeft;
  const bounds = viewport.getBoundingClientRect();
  const tabBounds = tab.getBoundingClientRect();
  const inset = 12;
  if (tabBounds.left < bounds.left + inset)
    viewport.scrollLeft -= bounds.left + inset - tabBounds.left;
  else if (tabBounds.right > bounds.right - inset)
    viewport.scrollLeft += tabBounds.right - bounds.right + inset;
  return viewport.scrollLeft !== previousScroll;
}

function WindowTabTooltip({
  title,
  description,
  children,
}: {
  title?: string;
  description?: string;
  children: ReactElement;
}) {
  if (!title) return children;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        className="z-[80] max-w-[min(28rem,var(--radix-tooltip-content-available-width))] wrap-anywhere rounded-lg border border-border bg-popover px-3 py-2 text-popover-foreground shadow-md"
        aria-label={description || title}
      >
        <div className="text-sm font-medium">{title}</div>
        {description && <div className="mt-1 text-muted-foreground">{description}</div>}
      </TooltipContent>
    </Tooltip>
  );
}

export function WindowTabStrip<T extends WorkbenchWindow>({
  controller,
  tabs,
  active,
  contentTab,
  description,
  idPrefix = "",
}: {
  controller: WindowController<T>;
  tabs: T[];
  active: string;
  contentTab?: { id: string; title: string };
  idPrefix?: string;
  /** Additional context shown with the full title on hover and keyboard focus. */
  description?: (tab: T) => string | undefined;
}) {
  const moveVisibleTab = (id: string, direction: -1 | 1) => {
    const neighbor = tabs[tabs.findIndex((tab) => tab.id === id) + direction];
    if (neighbor)
      controller.move(
        id,
        controller.get().tabs.findIndex((tab) => tab.id === neighbor.id),
      );
  };
  const [menuTab, setMenuTab] = useState<string | null>(null);
  const viewport = useRef<HTMLDivElement>(null);
  const [overflow, setOverflow] = useState({ before: false, after: false });
  const overflowed = overflow.before || overflow.after;
  useLayoutEffect(() => {
    const element = viewport.current;
    if (!element) return;
    const measure = () =>
      setOverflow({
        before: element.scrollLeft > 1,
        after: element.scrollWidth - element.clientWidth - element.scrollLeft > 1,
      });
    const revealActive = () => {
      const selected = element.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      const wrapper = selected?.closest<HTMLElement>("[data-reorder-tab]") ?? selected;
      if (wrapper) revealTab(element, wrapper);
      measure();
    };
    revealActive();
    const observer =
      typeof ResizeObserver === "undefined" ? null : new ResizeObserver(revealActive);
    observer?.observe(element);
    for (const child of element.children) observer?.observe(child);
    element.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer?.disconnect();
      element.removeEventListener("scroll", measure);
    };
  }, [tabs, active]);
  return (
    <div className="flex min-w-0 flex-1 self-stretch items-stretch gap-1">
      <div
        ref={viewport}
        data-item-tabstrip
        style={{
          maskImage: `linear-gradient(to right, ${overflow.before ? "transparent, black 12px" : "black, black"}, ${overflow.after ? "black calc(100% - 12px), transparent" : "black, black"})`,
        }}
        className="flex min-w-0 flex-1 items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Open items"
        onKeyDown={(event) => {
          if (!(event.target instanceof HTMLElement) || event.target.getAttribute("role") !== "tab")
            return;
          const buttons = Array.from(
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
          );
          const index = buttons.indexOf(event.target as HTMLButtonElement);
          const next =
            event.key === "ArrowRight"
              ? (index + 1) % buttons.length
              : event.key === "ArrowLeft"
                ? (index - 1 + buttons.length) % buttons.length
                : event.key === "Home"
                  ? 0
                  : event.key === "End"
                    ? buttons.length - 1
                    : -1;
          if (next < 0) return;
          event.preventDefault();
          const button = buttons[next];
          if (!button) return;
          const element = event.currentTarget;
          const previousFocus = document.activeElement;
          controller.select(button.id.slice(`${idPrefix}tab-`.length));
          const focus = () => {
            if (document.activeElement === previousFocus) button.focus({ preventScroll: true });
          };
          if (element.scrollWidth <= element.clientWidth) {
            focus();
          } else {
            // Selection can wait on a leave guard. Reveal the focus target
            // independently and let scrolling settle before opening its tooltip.
            requestAnimationFrame(() => {
              if (document.activeElement !== previousFocus) return;
              if (revealTab(element, button)) requestAnimationFrame(focus);
              else focus();
            });
          }
        }}
      >
        {contentTab && (
          <button
            role="tab"
            id={`${idPrefix}tab-${contentTab.id}`}
            aria-selected={active === contentTab.id}
            tabIndex={active === contentTab.id ? 0 : -1}
            onClick={() => controller.select(contentTab.id)}
            className={`shrink-0 px-3 py-1 text-sm ${active === contentTab.id ? "font-medium" : ""}`}
          >
            {contentTab.title}
          </button>
        )}
        <TooltipProvider delayDuration={350}>
          {tabs.map((tab) => {
            const details = description?.(tab);
            const tooltipTitle =
              description && typeof tab.title === "string" ? tab.title : undefined;
            return (
              <DropdownMenu
                key={tab.id}
                open={menuTab === tab.id}
                onOpenChange={(open) => setMenuTab(open ? tab.id : null)}
              >
                <div
                  onContextMenu={(event) => {
                    event.preventDefault();
                    setMenuTab(tab.id);
                  }}
                  data-reorder-tab={tab.id}
                  data-preview={
                    (!tab.kept && !controller.hasDraft(tab) && !tab.independent) || undefined
                  }
                  className="relative flex max-w-full shrink-0 items-center pr-1"
                >
                  <WindowTabTooltip title={tooltipTitle} description={details}>
                    <ReorderTabButton
                      windowId={tab.id}
                      controller={controller}
                      title={
                        tooltipTitle
                          ? undefined
                          : [
                              details,
                              !tab.kept && !controller.hasDraft(tab) && !tab.independent
                                ? "Drag to reorder. Replaced when you open another item; pin to keep open."
                                : "Drag to reorder",
                            ]
                              .filter(Boolean)
                              .join("\n")
                      }
                      role="tab"
                      id={`${idPrefix}tab-${tab.id}`}
                      aria-controls={`${idPrefix}panel-${tab.id}`}
                      aria-label={
                        typeof tab.title === "string"
                          ? `${tab.title}${tab.kept ? " (pinned)" : tab.independent ? "" : " (temporary)"}${controller.hasDraft(tab) ? " — unsaved changes" : ""}`
                          : undefined
                      }
                      aria-selected={active === tab.id}
                      tabIndex={active === tab.id ? 0 : -1}
                      onClick={() => controller.select(tab.id)}
                      onDoubleClick={() => controller.keep(tab.id)}
                      onKeyDown={(event) => {
                        if (
                          event.key === "ContextMenu" ||
                          (event.shiftKey && event.key === "F10")
                        ) {
                          event.preventDefault();
                          setMenuTab(tab.id);
                        }
                      }}
                      className={`inline-flex min-w-0 self-stretch items-center gap-2 py-1 pl-3 pr-2 text-sm ${active === tab.id ? "font-medium" : ""}`}
                    >
                      <span className="max-w-48 truncate">{tab.title}</span>
                      {controller.hasDraft(tab) && (
                        <span className="shrink-0" aria-label="Unsaved changes">
                          •
                        </span>
                      )}
                    </ReorderTabButton>
                  </WindowTabTooltip>
                  <PinToggle
                    pinned={Boolean(tab.kept)}
                    label="tab"
                    title={tab.kept ? "Pinned — click to unpin" : "Pin tab to keep it open"}
                    onClick={() => (tab.kept ? controller.unkeep(tab.id) : controller.keep(tab.id))}
                    className="size-7 [&_svg]:size-3.5 [@media(pointer:coarse)]:size-11"
                  />
                  <button
                    aria-label="Close tab"
                    title="Close tab"
                    onClick={tab.close}
                    className="inline-flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring [@media(pointer:coarse)]:size-11"
                  >
                    <X size={14} />
                  </button>
                  <DropdownMenuTrigger asChild>
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent
                    onCloseAutoFocus={(event) => {
                      event.preventDefault();
                      document.getElementById(`${idPrefix}tab-${tab.id}`)?.focus();
                    }}
                  >
                    <DropdownMenuItem
                      onSelect={() =>
                        tab.kept ? controller.unkeep(tab.id) : controller.keep(tab.id)
                      }
                    >
                      {tab.kept ? "Unpin tab" : "Pin tab"}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={tabs[0]?.id === tab.id}
                      onSelect={() => moveVisibleTab(tab.id, -1)}
                    >
                      Move left
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      disabled={tabs[tabs.length - 1]?.id === tab.id}
                      onSelect={() => moveVisibleTab(tab.id, 1)}
                    >
                      Move right
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={tab.close}>Close tab</DropdownMenuItem>
                  </DropdownMenuContent>
                </div>
              </DropdownMenu>
            );
          })}
        </TooltipProvider>
      </div>
      {overflowed && (
        <div className="flex shrink-0 items-center" data-tab-overflow>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Show all open tabs"
                title="All open tabs"
              >
                <ChevronDown />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              className="max-h-80 w-80 max-w-[90vw] overflow-y-auto"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                document.getElementById(`${idPrefix}tab-${controller.get().active}`)?.focus();
              }}
            >
              {tabs.map((tab) => (
                <DropdownMenuItem key={tab.id} onSelect={() => controller.select(tab.id)}>
                  <Check className={`size-4 shrink-0 ${tab.id === active ? "" : "invisible"}`} />
                  <span className="min-w-0 flex-1 truncate">{tab.title}</span>
                  {controller.hasDraft(tab) && <span aria-label="Unsaved changes">•</span>}
                  {tab.kept && (
                    <Pin
                      className="size-3.5 shrink-0 text-primary fill-primary/20"
                      aria-label="Pinned"
                    />
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </div>
  );
}
