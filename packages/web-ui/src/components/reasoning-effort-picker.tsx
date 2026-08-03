import { useStore } from "zustand";
import { Check, ChevronDown } from "lucide-react";
import {
  reasoningEffortStore,
  REASONING_EFFORT_LABELS,
  type ReasoningEffort,
} from "@iloveagents/foundry-agent";
import { cn } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";

const OPTIONS: { value: ReasoningEffort; hint: string }[] = [
  { value: "default", hint: "Let the app decide" },
  { value: "low", hint: "Answers sooner, thinks less" },
  { value: "medium", hint: "Good default for most questions" },
  { value: "high", hint: "Slower, best for hard problems" },
  { value: "xhigh", hint: "Slowest — reserve it for the hardest questions" },
];

/**
 * Lets the user choose how hard the model thinks, per conversation.
 *
 * Sits in the composer next to Send. The choice rides on every request as
 * an AG-UI forwarded prop and is read at send time, so switching it
 * mid-conversation applies from the next message on. `Auto` sends nothing
 * and leaves the backend's configured level in place.
 */
export function ReasoningEffortPicker({ className }: { className?: string }) {
  const effort = useStore(reasoningEffortStore, (s) => s.effort);
  const setEffort = useStore(reasoningEffortStore, (s) => s.setEffort);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1",
            "text-xs text-muted-foreground hover:text-foreground hover:bg-muted",
            "transition-colors",
            className,
          )}
          aria-label={`Thinking effort: ${REASONING_EFFORT_LABELS[effort]}`}
        >
          <span>{REASONING_EFFORT_LABELS[effort]}</span>
          <ChevronDown className="size-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            onSelect={() => setEffort(opt.value)}
            className="flex items-start gap-2"
          >
            <Check
              className={cn("size-4 mt-0.5", effort === opt.value ? "opacity-100" : "opacity-0")}
            />
            <span className="flex flex-col">
              <span className="text-sm">{REASONING_EFFORT_LABELS[opt.value]}</span>
              <span className="text-xs text-muted-foreground">{opt.hint}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
