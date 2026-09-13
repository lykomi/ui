import { useEffect, useRef, useState } from "react";
import { useAuiState } from "@assistant-ui/react";
import { Button, cn } from "@iloveagents/foundry-web-primitives";
import { X } from "lucide-react";
import { DialogContent, DialogTitle } from "../ui/dialog.tsx";
import type { ToolPanelContent } from "../lib/tool-panel-store.ts";
import { FocusChatPane } from "./focus-chat-pane.tsx";
import { FocusSourcePane } from "./focus-source-pane.tsx";
export function FocusDialog({
  focused,
  setFocused,
  host,
  attach,
  title,
  onReturnFocus,
}: {
  focused: boolean;
  setFocused: (v: boolean) => void;
  host: HTMLElement | null;
  attach: (el: HTMLDivElement | null) => void;
  title: string;
  onReturnFocus: () => void;
}) {
  const [chatOpen, setChatOpen] = useState(false);
  const [chatWidth, setChatWidth] = useState<number>();
  const [sourceWidth, setSourceWidth] = useState<number>();
  const [source, setSource] = useState<ToolPanelContent | null>(null);
  const hasChat = useAuiState((state) => Boolean(state.optional.thread));
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const sourceTrigger = useRef<HTMLElement | null>(null);
  const closeSource = () => {
    setSource(null);
    requestAnimationFrame(() => sourceTrigger.current?.focus());
  };
  useEffect(() => {
    if (!focused) {
      setChatOpen(false);
      setSource(null);
    }
  }, [focused]);
  useEffect(() => {
    if (!focused) return;
    const openSource = (event: Event) => {
      const request = event as CustomEvent<ToolPanelContent>;
      if (request.defaultPrevented || typeof request.detail?.content !== "string") return;
      const dialogs = Array.from(document.querySelectorAll('[role="dialog"]'));
      if (host?.closest('[role="dialog"]') !== dialogs[dialogs.length - 1]) return;
      request.preventDefault();
      const active = document.activeElement;
      if (active instanceof HTMLElement && !active.closest('[aria-label="Citation source"]'))
        sourceTrigger.current = active;
      setSource(request.detail);
    };
    window.addEventListener("focus:open-source", openSource);
    window.addEventListener("preview:open-source", openSource, true);
    return () => {
      window.removeEventListener("focus:open-source", openSource);
      window.removeEventListener("preview:open-source", openSource, true);
    };
  }, [focused, host]);
  return (
    <DialogContent
      ref={dialogRef}
      tabIndex={-1}
      onOpenAutoFocus={(event) => {
        event.preventDefault();
        dialogRef.current?.focus();
      }}
      showCloseButton={false}
      aria-describedby={undefined}
      onEscapeKeyDown={(event) => {
        event.preventDefault();
        if (source) closeSource();
        else setFocused(false);
      }}
      onCloseAutoFocus={(event) => {
        event.preventDefault();
        onReturnFocus();
      }}
      className="inset-0 left-0 top-0 flex h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-row gap-0 rounded-none border-0 bg-background p-0 sm:max-w-none"
    >
      {hasChat && (
        <FocusChatPane
          chatOpen={chatOpen}
          setChatOpen={setChatOpen}
          chatWidth={chatWidth}
          setChatWidth={setChatWidth}
          source={!!source}
          onClose={() => setFocused(false)}
        />
      )}
      <div
        className={cn(
          "min-h-0 min-w-0 flex-1 flex-col",
          chatOpen || source ? "hidden md:flex" : "flex",
        )}
      >
        <div className="flex h-12 shrink-0 items-center gap-3 border-b border-border px-4">
          <DialogTitle className="min-w-0 flex-1 truncate text-sm">{title}</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            title="Close"
            aria-label="Close"
            className="size-8"
            onClick={() => setFocused(false)}
          >
            <X size={18} />
          </Button>
        </div>
        <div ref={focused ? attach : undefined} className="flex min-h-0 min-w-0 flex-1 flex-col" />
      </div>
      {source && (
        <FocusSourcePane
          source={source}
          sourceWidth={sourceWidth}
          setSourceWidth={setSourceWidth}
          closeSource={closeSource}
        />
      )}
    </DialogContent>
  );
}
