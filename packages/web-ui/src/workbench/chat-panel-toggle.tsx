import { useNavStore } from "../lib/nav-store.ts";
import { MessageSquare, X } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip.tsx";

const DISCOVERY_KEY = "chat-panel-v1";

/** The original narrow rail, with discovery that never changes content width. */
export function ChatPanelToggle({
  running,
  home,
  onOpen,
}: {
  running: boolean;
  home: boolean;
  onOpen: () => void;
}) {
  const state = useNavStore(
    (s) => s.config.find((group) => group.meta?.type === "spaces-workspaces")?.meta?.userState,
  ) as
    | {
        ready?: boolean;
        acknowledgedHints?: Record<string, string>;
        acknowledgeHint?: (id: string) => void;
      }
    | undefined;
  const discovered = Boolean(state?.acknowledgedHints?.[DISCOVERY_KEY]);
  const dismiss = () => state?.acknowledgeHint?.(DISCOVERY_KEY);
  const description = running ? "Open chat — AI is working" : "Open chat";
  return (
    <>
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          <button
            type="button"
            data-chat-expand
            aria-label={description}
            aria-expanded={false}
            aria-controls="preview-assistant"
            className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
            onClick={() => {
              dismiss();
              onOpen();
            }}
          >
            <MessageSquare size={18} aria-hidden />
          </button>
        </TooltipTrigger>
        <TooltipContent side="right">{description}</TooltipContent>
      </Tooltip>
      {!home && state?.ready && state.acknowledgeHint && !discovered && (
        <div
          role="status"
          data-chat-discovery
          className="absolute left-full top-2 z-50 ml-2 flex w-64 items-start gap-2 rounded-lg border border-border bg-popover p-3 text-popover-foreground shadow-md"
        >
          <p className="flex-1 text-sm leading-5">Chat about what you’re viewing.</p>
          <button
            type="button"
            aria-label="Dismiss chat hint"
            onClick={dismiss}
            className="inline-flex size-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        </div>
      )}
    </>
  );
}
