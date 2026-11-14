import { useWindowScroll } from "./use-window-scroll.ts";
import { useId, useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from "react";
import { Columns2, PanelsTopLeft } from "lucide-react";
import { Button, cn } from "@lykomi/web-primitives";
import type { WindowController, WorkbenchWindow } from "./window-controller.ts";
import { WindowTabStrip } from "./window-tab-strip.tsx";
import { WindowPanelActions } from "./window-panel-actions.tsx";
import { PaneResizeHandle } from "./pane-resize-handle.tsx";

export function useWindows<T extends WorkbenchWindow>(controller: WindowController<T>) {
  return useSyncExternalStore(controller.subscribe, controller.get, controller.get);
}

/** The same keyed panes stay mounted in both layouts, retaining editors and scroll. */
export function WindowWorkbench<T extends WorkbenchWindow>({
  controller,
  renderWindow,
  getWindowContext,
  toolbar,
  empty,
  className,
}: {
  controller: WindowController<T>;
  renderWindow: (tab: T) => ReactNode;
  getWindowContext?: (tab: T) => Record<string, unknown>;
  toolbar?: ReactNode;
  empty?: ReactNode;
  className?: string;
}) {
  const idPrefix = useId();
  const { tabs, active, layout } = useWindows(controller);
  return (
    <div data-window-workbench className={cn("flex h-full min-h-0 min-w-0 flex-col", className)}>
      <div className="flex min-h-12 min-w-0 items-center gap-2 border-b border-border bg-muted/40 px-2">
        <WindowTabStrip idPrefix={idPrefix} controller={controller} tabs={tabs} active={active} />
        {toolbar}
        <Button
          variant="ghost"
          size="sm"
          aria-label={layout === "tabs" ? "View as panels" : "View as tabs"}
          onClick={() =>
            controller.setLayout(layout === "tabs" ? "panels" : "tabs", { remember: true })
          }
        >
          {layout === "tabs" ? <Columns2 /> : <PanelsTopLeft />}
          <span className="hidden sm:inline">{layout === "tabs" ? "Panels" : "Tabs"}</span>
        </Button>
      </div>
      <div
        data-window-layout={layout}
        className={cn(
          "relative min-h-0 min-w-0 flex-1",
          layout === "panels"
            ? "flex flex-wrap content-start items-stretch gap-3 overflow-auto bg-muted/30 p-3"
            : "overflow-hidden",
        )}
      >
        {tabs.map((tab) => (
          <WindowPane
            key={tab.id}
            idPrefix={idPrefix}
            controller={controller}
            tab={tab}
            active={active === tab.id}
            panels={layout === "panels"}
            context={getWindowContext?.(tab)}
          >
            {renderWindow(tab)}
          </WindowPane>
        ))}
        {!tabs.length && empty}
      </div>
    </div>
  );
}

function WindowPane<T extends WorkbenchWindow>({
  controller,
  tab,
  active,
  panels,
  children,
  context,
  idPrefix,
}: {
  controller: WindowController<T>;
  tab: T;
  active: boolean;
  panels: boolean;
  children: ReactNode;
  context?: Record<string, unknown>;
  idPrefix: string;
}) {
  const frame = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    const element = frame.current;
    if (!element || !active || !context) return;
    const collect = (event: Event) => {
      (event as CustomEvent).detail.context = context;
    };
    element.addEventListener("focus:collect-context", collect);
    return () => element.removeEventListener("focus:collect-context", collect);
  }, [active, context]);
  useLayoutEffect(() => {
    if (panels && active) frame.current?.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  }, [panels, active]);
  const visible = panels || active;
  const scroll = useWindowScroll(visible, panels);
  const activateContent = (target: EventTarget) => {
    if (
      !active &&
      target instanceof Element &&
      frame.current?.contains(target) &&
      !target.closest("[data-item-window-controls], [data-window-reorder]")
    )
      void controller.select(tab.id);
  };
  return (
    <section
      ref={frame}
      data-focused={active ? "" : undefined}
      data-focus-kind="document"
      data-focus-title={typeof tab.title === "string" ? tab.title : undefined}
      data-item-tab={tab.id}
      data-window-active={active}
      id={`${idPrefix}panel-${tab.id}`}
      role="tabpanel"
      aria-labelledby={`${idPrefix}tab-${tab.id}`}
      hidden={!visible}
      onPointerDown={(event) => activateContent(event.target)}
      onFocusCapture={(event) => activateContent(event.target)}
      className={cn(
        "min-h-0 min-w-0 bg-background",
        !visible ? "hidden" : "flex flex-col",
        panels
          ? "relative min-h-80 overflow-hidden rounded-lg border border-border"
          : "absolute inset-0",
      )}
      style={
        panels
          ? {
              flex: tab.panelWidth ? `0 0 min(100%, ${tab.panelWidth}px)` : "1 1 28rem",
              height: "min(640px, 75vh)",
            }
          : undefined
      }
    >
      <div
        className={cn(
          "shrink-0 items-center gap-2 border-b border-border px-3 py-1",
          panels ? "flex" : "hidden",
        )}
      >
        <h2 className="min-w-0 truncate text-sm font-medium">{tab.title}</h2>
        <WindowPanelActions controller={controller} tab={tab} />
      </div>
      <div {...scroll} data-window-scroll className="min-h-0 flex-1 overflow-auto">
        {children}
      </div>
      {panels && (
        <PaneResizeHandle
          label={typeof tab.title === "string" ? tab.title : "panel"}
          width={tab.panelWidth}
          min={280}
          max={2400}
          defaultWidth={448}
          paneSelector="[data-item-tab]"
          windowReorder
          onResize={(width) => controller.resize(tab.id, width)}
        />
      )}
    </section>
  );
}
