import { useState } from "react";
import { Brain, ChevronDown } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible.tsx";

/**
 * Renders a `reasoning` message part — the model's own thinking, streamed
 * over AG-UI's `REASONING_*` events and kept separate from the answer.
 *
 * Collapsed by default and deliberately understated: reasoning is context for
 * a curious reader, not the response. It stays visible after the run so a
 * reader can check *why* an answer came out the way it did.
 */
export function ReasoningPart({ text }: { text: string }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!text.trim()) return null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-1.5 text-xs text-muted-foreground",
            "hover:text-foreground transition-colors",
          )}
          aria-label={isOpen ? "Hide reasoning" : "Show reasoning"}
        >
          <Brain className="size-3.5" />
          <span>Reasoning</span>
          <ChevronDown className={cn("size-3.5 transition-transform", isOpen && "rotate-180")} />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div
          className={cn(
            "mt-1.5 whitespace-pre-wrap border-l-2 border-border pl-3",
            "text-xs text-muted-foreground",
          )}
        >
          {text}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Adapter for assistant-ui's `Reasoning` part slot. */
export const ReasoningMessagePartComponent = ({ text }: { text: string }) => (
  <ReasoningPart text={text} />
);
