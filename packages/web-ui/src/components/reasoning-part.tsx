import { useState } from "react";
import { Brain } from "lucide-react";
import { MessageDisclosure } from "./message-disclosure.tsx";

/**
 * Renders a `reasoning` message part — the model's own thinking, streamed
 * over AG-UI's `REASONING_*` events and kept separate from the answer.
 *
 * Collapsed by default and deliberately understated: reasoning is context for
 * a curious reader, not the response. It stays visible after the run so a
 * reader can check *why* an answer came out the way it did.
 *
 * The row shape comes from `MessageDisclosure`, shared with the turn's
 * activity row — these sit next to each other in a message and used to be
 * built separately, which is how they ended up with their carets on opposite
 * sides.
 */
export function ReasoningPart({ text, nested = false }: { text: string; nested?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  if (!text.trim()) return null;

  // Inside the turn's activity fold there is no second fold: the reader
  // already opened one to get here, and a disclosure containing disclosures
  // is a maze. Just the thinking, captioned, in the slot the model produced
  // it in.
  if (nested) {
    return (
      <div className="flex flex-col gap-1" data-reasoning-part>
        <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Brain className="size-3.5" />
          Reasoning
        </span>
        <div className="whitespace-pre-wrap text-xs text-muted-foreground">{text}</div>
      </div>
    );
  }

  return (
    <MessageDisclosure
      icon={<Brain className="size-3.5" />}
      label="Reasoning"
      open={isOpen}
      onOpenChange={setIsOpen}
      ariaLabel={isOpen ? "Hide reasoning" : "Show reasoning"}
    >
      <div className="whitespace-pre-wrap text-xs text-muted-foreground">{text}</div>
    </MessageDisclosure>
  );
}

/** Adapter for assistant-ui's `Reasoning` part slot. */
export const ReasoningMessagePartComponent = ({
  text,
  nested = false,
}: {
  text: string;
  nested?: boolean;
}) => <ReasoningPart text={text} nested={nested} />;
