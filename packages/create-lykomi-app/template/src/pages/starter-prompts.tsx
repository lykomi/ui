import { ThreadPrimitive } from "@assistant-ui/react";
import { Button } from "@lykomi/web-primitives";
import { useChatBubbleStore } from "@lykomi/web-ui";

const prompts = [
  "Say hello world using the hello_world tool",
  "Check the weather in Seattle",
  "What tools can you use?",
];

/** One click demonstrates a real AG-UI turn with the bundled tools. */
export function StarterPrompts() {
  return (
    <div
      className="flex flex-col items-center gap-2 in-[[data-chat-empty-state]]:items-start"
      aria-label="Try a prompt"
    >
      {prompts.map((prompt) => (
        <ThreadPrimitive.Suggestion
          key={prompt}
          prompt={prompt}
          send
          asChild
          onClick={() => useChatBubbleStore.getState().open()}
        >
          <Button
            variant="outline"
            size="sm"
            className="h-auto max-w-full min-h-9 justify-start text-wrap py-2 text-left text-sm"
          >
            {prompt}
          </Button>
        </ThreadPrimitive.Suggestion>
      ))}
    </div>
  );
}
