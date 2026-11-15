import { Sparkles } from "lucide-react";
import type { AssistantContext } from "../lib/assistant-context.ts";
import { Button, type ButtonProps } from "@lykomi/web-primitives";
import { useChatBubbleStore } from "../lib/chat-bubble-store.ts";
import { submitComposerText, useComposerSubmitStore } from "../lib/composer-submit-store.ts";

export interface AskAIButtonProps extends Omit<
  ButtonProps,
  "onClick" | "asChild" | "type" | "children"
> {
  /** A user-facing question with the relevant, authorized context. Never include credentials or raw logs. */
  prompt: string;
  /** Compact UI facts sent as AG-UI context, never as chat bubble text. */
  context?: AssistantContext;
  /** Localize or use the host assistant's name. */
  label?: string;
}

/** Opens the host's existing chat and submits through its normal composer/AG-UI runtime.
 * Requires the host ChatContent or ChatBubble; does not create a second agent or request credentials. */
export function AskAIButton({
  prompt,
  context,
  label = "Ask AI",
  disabled,
  variant = "outline",
  size = "sm",
  ...props
}: AskAIButtonProps) {
  const pending = useComposerSubmitStore((state) => state.pending !== null);
  return (
    <Button
      {...props}
      type="button"
      variant={variant}
      size={size}
      disabled={disabled || pending || !prompt.trim()}
      onClick={() => {
        // Protect a pending request even before React has painted the disabled state.
        if (useComposerSubmitStore.getState().pending || !prompt.trim()) return;
        const chat = useChatBubbleStore.getState();
        if (!chat.isOpen && !chat.isExpanded) chat.open();
        submitComposerText(prompt, context);
      }}
    >
      <Sparkles aria-hidden="true" />
      {label}
    </Button>
  );
}
