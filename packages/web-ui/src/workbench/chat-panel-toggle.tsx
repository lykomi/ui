import { useId, useRef } from "react";
import { Arrow } from "@radix-ui/react-popover";
import { Button } from "@lykomi/web-primitives";
import { MessageSquare } from "lucide-react";
import { useNavStore } from "../lib/nav-store.ts";
import { Popover, PopoverAnchor, PopoverContent } from "../ui/popover.tsx";
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
  const toggle = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const bodyId = useId();
  const state = useNavStore(
    (s) => s.config.find((group) => group.meta?.type === "spaces-workspaces")?.meta?.userState,
  ) as
    | {
        ready?: boolean;
        acknowledgedHints?: Record<string, string>;
        acknowledgeHint?: (id: string) => void;
      }
    | undefined;
  const showHint = Boolean(
    !home && state?.ready && state.acknowledgeHint && !state.acknowledgedHints?.[DISCOVERY_KEY],
  );
  const dismiss = () => state?.acknowledgeHint?.(DISCOVERY_KEY);
  const description = running ? "Open chat — AI is working" : "Open chat";
  return (
    <Popover open={showHint} onOpenChange={(open) => !open && dismiss()}>
      <Tooltip delayDuration={0}>
        <PopoverAnchor asChild>
          <TooltipTrigger asChild>
            <button
              type="button"
              ref={toggle}
              data-chat-expand
              aria-label={description}
              aria-expanded={false}
              aria-controls="preview-assistant"
              aria-describedby={showHint ? bodyId : undefined}
              className="inline-flex size-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary"
              onClick={onOpen}
            >
              <MessageSquare size={18} aria-hidden />
            </button>
          </TooltipTrigger>
        </PopoverAnchor>
        {!showHint && <TooltipContent side="right">{description}</TooltipContent>}
      </Tooltip>
      {showHint && (
        <PopoverContent
          data-chat-discovery
          lang="en"
          aria-labelledby={titleId}
          aria-describedby={bodyId}
          side="right"
          align="start"
          sideOffset={12}
          collisionPadding={12}
          hideWhenDetached
          onOpenAutoFocus={(event) => event.preventDefault()}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onInteractOutside={(event) => event.preventDefault()}
          className="w-72 max-w-[calc(100vw-1.5rem)] rounded-lg p-4"
        >
          <Arrow className="fill-popover" />
          <h2 id={titleId} className="text-sm font-semibold">
            Show and hide chat
          </h2>
          <p
            id={bodyId}
            className="mt-1 text-sm leading-5 text-muted-foreground"
            aria-live="polite"
          >
            Select this icon to open chat. Collapse it from the chat header. As you navigate, chat
            uses what you’re currently viewing as context.
          </p>
          <div className="mt-3 flex justify-end">
            <Button
              type="button"
              size="sm"
              onClick={() => {
                dismiss();
                toggle.current?.focus();
              }}
            >
              Got it
            </Button>
          </div>
        </PopoverContent>
      )}
    </Popover>
  );
}
