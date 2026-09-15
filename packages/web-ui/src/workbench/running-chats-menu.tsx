import { useNavigate } from "react-router";
import { LoaderCircle, MessageSquare, PauseCircle } from "lucide-react";
import { useChatRuns, isChatRunActive } from "../lib/chat-runs-store.ts";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
} from "../ui/dropdown-menu.tsx";

export function RunningChatsMenu() {
  const runs = useChatRuns((s) => s.runs);
  const navigate = useNavigate();
  const active = Object.values(runs).filter(isChatRunActive);
  if (!active.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`${active.length} running conversations`}
          className="inline-flex items-center gap-1.5 px-2 text-xs text-primary"
        >
          <LoaderCircle className="size-3.5 animate-spin motion-reduce:animate-none" />
          <span>{active.length}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-w-80">
        <DropdownMenuLabel>Running in this browser</DropdownMenuLabel>
        {active.map((run) => (
          <DropdownMenuItem
            key={run.threadId}
            onSelect={() =>
              navigate(run.conversationUrl ?? `/chat/${encodeURIComponent(run.threadId)}`)
            }
          >
            {run.status === "waiting" ? (
              <PauseCircle className="size-4 shrink-0" />
            ) : (
              <MessageSquare className="size-4 shrink-0" />
            )}
            <span className="min-w-0">
              <span className="block truncate">{run.title}</span>
              {run.status === "waiting" && (
                <span className="block text-xs text-muted-foreground">Open to continue</span>
              )}
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
