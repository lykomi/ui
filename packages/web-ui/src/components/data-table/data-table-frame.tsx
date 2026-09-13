import { FocusPaneResize } from "./focus-pane-resize.tsx";
import { PanelContentRenderer } from "../tool-panel.tsx";
import type { ToolPanelContent } from "../../lib/tool-panel-store.ts";
import { Button } from "@iloveagents/foundry-web-primitives";
import { TooltipProvider } from "../../ui/tooltip.tsx";
import { useAuiState } from "@assistant-ui/react";
import { MessageSquare, PanelLeft, X } from "lucide-react";
import { ChatContent } from "../assistant-chat.tsx";
import { TooltipIconButton } from "../tooltip-icon-button.tsx";
/** Shared inline/full-screen table surface. A stable portal host preserves
 * row selection, filters and in-flight cell edits when moving into the dialog. */
import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { Dialog, DialogContent, DialogTitle, DialogPortal } from "../../ui/dialog.tsx";

export interface DataTableFrameContextValue {
  focused: boolean;
  setFocused: (focused: boolean) => void;
}
const DataTableFrameContext = createContext<DataTableFrameContextValue | null>(null);
export function useDataTableFrame(): DataTableFrameContextValue | null {
  return useContext(DataTableFrameContext);
}
export interface DataTableFrameProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  focusClassName?: string;
  defaultFocused?: boolean;
  onFocusChange?: (focused: boolean) => void;
}
export const DataTableFrame = forwardRef<HTMLDivElement, DataTableFrameProps>(
  function DataTableFrame(
    { children, className, focusClassName, defaultFocused = false, onFocusChange, ...rest },
    ref,
  ) {
    const [focused, setFocused] = useState(defaultFocused);
    const [chatOpen, setChatOpen] = useState(false);
    const [chatWidth, setChatWidth] = useState<number>();
    const [sourceWidth, setSourceWidth] = useState<number>();
    const [source, setSource] = useState<ToolPanelContent | null>(null);
    const hasChat = useAuiState((state) => Boolean(state.optional.thread));
    const [host] = useState(() =>
      typeof document === "undefined" ? null : document.createElement("div"),
    );
    const returnFocus = useRef<HTMLElement | null>(null);
    const sourceTrigger = useRef<HTMLElement | null>(null);
    const closeSource = () => {
      setSource(null);
      requestAnimationFrame(() => sourceTrigger.current?.focus());
    };
    const value = useMemo(
      () => ({
        focused,
        setFocused: (next: boolean) => {
          if (next && !focused) returnFocus.current = document.activeElement as HTMLElement | null;
          setFocused(next);
          if (!next) {
            setChatOpen(false);
            setSource(null);
          }
          onFocusChange?.(next);
        },
      }),
      [focused, onFocusChange],
    );
    useEffect(() => {
      if (!focused) return;
      const openSource = (event: Event) => {
        const request = event as CustomEvent<ToolPanelContent>;
        if (request.defaultPrevented || !request.detail?.content) return;
        const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
        if (host?.closest('[role="dialog"]') !== dialogs[dialogs.length - 1]) return;
        request.preventDefault();
        const active = document.activeElement;
        if (active instanceof HTMLElement && !active.closest('[aria-label="Citation source"]'))
          sourceTrigger.current = active;
        setSource(request.detail);
      };
      window.addEventListener("focus:open-source", openSource);
      return () => window.removeEventListener("focus:open-source", openSource);
    }, [focused, host]);
    const attach = (element: HTMLDivElement | null) => {
      if (element && host && host.parentElement !== element) {
        host.style.display = "contents";
        element.appendChild(host);
      }
    };
    const content = (
      <div
        {...rest}
        ref={ref}
        data-focused={focused ? "" : undefined}
        data-focus-title={rest["aria-label"] || "Focused content"}
        className={
          focused
            ? cn(
                "flex min-h-0 flex-1 flex-col gap-3 overflow-hidden bg-background p-4 sm:p-6",
                focusClassName,
              )
            : className
        }
      >
        {children}
      </div>
    );
    return (
      <DataTableFrameContext.Provider value={value}>
        <TooltipProvider>
          <div ref={focused ? undefined : attach} className="contents" />
          <Dialog open={focused} onOpenChange={value.setFocused}>
            <DialogContent
              showCloseButton={false}
              aria-describedby={undefined}
              onEscapeKeyDown={(event) => {
                if (source) {
                  event.preventDefault();
                  closeSource();
                }
              }}
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                returnFocus.current?.focus();
              }}
              className="inset-0 left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-row gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none"
            >
              {hasChat && (
                <aside
                  aria-label="Table chat"
                  style={{ "--focus-chat-width": `${chatWidth ?? 384}px` } as CSSProperties}
                  className={cn(
                    "relative flex min-h-0 shrink-0 flex-col border-r border-border bg-background",
                    chatOpen ? "w-full md:w-[var(--focus-chat-width)]" : "w-11",
                    source && "hidden md:flex",
                  )}
                >
                  <div
                    className={cn(
                      "flex h-12 shrink-0 items-center",
                      chatOpen ? "gap-1 border-b border-border px-2" : "justify-center",
                    )}
                  >
                    {chatOpen ? (
                      <>
                        <span className="min-w-0 flex-1 px-2 text-sm font-semibold">Chat</span>
                        <TooltipIconButton
                          tooltip="Collapse chat"
                          aria-label="Collapse chat"
                          className="size-8"
                          onClick={() => setChatOpen(false)}
                        >
                          <PanelLeft size={18} />
                        </TooltipIconButton>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Close"
                          aria-label="Close"
                          className="size-8 md:hidden"
                          onClick={() => value.setFocused(false)}
                        >
                          <X size={18} />
                        </Button>
                      </>
                    ) : (
                      <TooltipIconButton
                        tooltip="Expand chat"
                        aria-label="Expand chat"
                        aria-expanded={false}
                        className="size-8"
                        onClick={() => setChatOpen(true)}
                      >
                        <MessageSquare size={18} />
                      </TooltipIconButton>
                    )}
                  </div>
                  {chatOpen && (
                    <FocusPaneResize
                      label="chat"
                      side="right"
                      width={chatWidth}
                      onResize={setChatWidth}
                    />
                  )}
                  {chatOpen && (
                    <ChatContent
                      compactComposer
                      showPinButton={false}
                      hideCurrentPageBadge
                      starterSuggestions={[]}
                    />
                  )}
                </aside>
              )}
              <div
                className={cn(
                  "min-h-0 min-w-0 flex-1 flex-col",
                  chatOpen || source ? "hidden md:flex" : "flex",
                )}
              >
                <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
                  <DialogTitle className="min-w-0 flex-1 truncate text-sm">
                    {rest["aria-label"] || "Table focus"}
                  </DialogTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Close"
                    aria-label="Close"
                    className="size-8"
                    onClick={() => value.setFocused(false)}
                  >
                    <X size={18} />
                  </Button>
                </div>
                <div
                  ref={focused ? attach : undefined}
                  className="flex min-h-0 min-w-0 flex-1 flex-col"
                />
              </div>
              {source && (
                <aside
                  aria-label="Citation source"
                  style={
                    {
                      "--focus-source-width": sourceWidth ? `${sourceWidth}px` : "40%",
                    } as CSSProperties
                  }
                  data-focus-source-entity={source.entityId}
                  data-focus-source-title={source.title}
                  className="absolute inset-0 z-20 flex min-h-0 flex-col border-l border-border bg-background md:relative md:inset-auto md:w-[var(--focus-source-width)] md:min-w-60 md:shrink-0"
                >
                  <FocusPaneResize
                    label="source"
                    side="left"
                    width={sourceWidth}
                    onResize={setSourceWidth}
                  />
                  <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
                    <span
                      className="min-w-0 flex-1 truncate text-sm font-medium"
                      title={source.title}
                    >
                      {source.title}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Close citation"
                      title="Close citation"
                      className="size-8"
                      onClick={closeSource}
                    >
                      <X size={18} />
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1 overflow-auto">
                    <PanelContentRenderer content={source} />
                  </div>
                </aside>
              )}
            </DialogContent>
            {host ? (
              <DialogPortal container={host} forceMount>
                {content}
              </DialogPortal>
            ) : (
              content
            )}
          </Dialog>
        </TooltipProvider>
      </DataTableFrameContext.Provider>
    );
  },
);
