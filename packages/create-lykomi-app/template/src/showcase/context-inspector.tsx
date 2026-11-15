import type { RefObject } from "react";
import { Braces, MessageSquare, Radio } from "lucide-react";
import { Button } from "@lykomi/web-primitives";
import { useChatBubbleStore } from "@lykomi/web-ui";
import { useContextPreview } from "./use-context-preview.ts";

export function ContextInspector({
  surface,
  prompt,
}: {
  surface: RefObject<HTMLElement | null>;
  prompt: string;
}) {
  const snapshot = useContextPreview(surface);
  const data = snapshot
    ? (JSON.parse(snapshot) as {
        state: {
          navigation: { page: string };
          contextItems: Array<{
            label?: string;
            refType?: string;
            target?: { label?: string };
            meta?: { fieldLabel?: string };
          }>;
        };
        tools: Array<{ name: string }>;
      })
    : null;
  const items = data?.state.contextItems ?? [];
  const tools =
    data?.tools.filter(
      (tool) =>
        tool.name.startsWith("page_") ||
        (items.some((item) => item.refType === "process") && tool.name.startsWith("ui_process_")),
    ) ?? [];
  return (
    <aside
      aria-label="Agent context inspector"
      className="min-w-0 self-start rounded-xl border border-border bg-card p-5 @5xl:sticky @5xl:top-6"
    >
      <div className="flex items-center gap-2 text-sm font-medium">
        <Radio className="size-4 text-primary" /> Live agent context
      </div>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
        Interact with the example. This is the state the framework prepares for the next AG-UI turn.
      </p>
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground">CURRENT SUBJECTS</p>
        {items.length ? (
          <ul className="mt-2 space-y-2 text-sm">
            {items.map((item, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                <span className="min-w-0 break-words">
                  {item.label ??
                    item.target?.label ??
                    item.meta?.fieldLabel ??
                    item.refType ??
                    "Context item"}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">
            Select a field, or explore an example with shared state.
          </p>
        )}
      </div>
      <details className="mt-4 border-t border-border pt-4">
        <summary className="cursor-pointer text-sm font-medium">
          Example tools <span className="text-muted-foreground">({tools.length})</span>
        </summary>
        <ul className="mt-3 space-y-2">
          {tools.map((tool) => (
            <li key={tool.name} className="break-all font-mono text-xs text-muted-foreground">
              {tool.name}
            </li>
          ))}
        </ul>
      </details>
      <details className="mt-4 border-t border-border pt-4">
        <summary className="cursor-pointer text-sm font-medium">
          <Braces className="mr-1 inline size-4" /> Inspect AG-UI state
        </summary>
        <pre
          aria-label="AG-UI context JSON"
          className="mt-3 max-h-80 overflow-auto rounded-lg bg-muted p-3 font-mono text-xs leading-relaxed"
          tabIndex={0}
        >
          {snapshot || "Preparing context…"}
        </pre>
      </details>
      <div className="mt-5 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted-foreground">TRY WITH YOUR AGENT</p>
        <p className="mt-2 text-sm leading-relaxed">“{prompt}”</p>
        <Button
          variant="outline"
          className="mt-3 w-full gap-2"
          onClick={() => useChatBubbleStore.getState().open()}
        >
          <MessageSquare className="size-4" /> Open chat
        </Button>
        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
          Examples and context work offline. Replies require your configured agent service.
        </p>
      </div>
    </aside>
  );
}
