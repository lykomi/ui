import { BookOpen, MessageSquare, PanelRightOpen } from "lucide-react";
import * as Tabs from "@radix-ui/react-tabs";
import { Button } from "@lykomi/web-primitives";
import { useChatBubbleStore, useToolPanelStore } from "@lykomi/web-ui";

const tabClass =
  "min-h-11 border-b-2 border-transparent px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring data-[state=active]:border-primary data-[state=active]:text-foreground";

function openArchitecturePanel() {
  useToolPanelStore.getState().openPanel({
    type: "markdown",
    title: "Starter architecture",
    content:
      "### Browser\n`bootstrapShell` composes this page, the persistent chat, the theme, and the Guide `ChatModule`.\n\n" +
      "### Agent\nFastAPI exposes `/api/agent`. The shell sends AG-UI runs there, including the current page context.\n\n" +
      "### Your next step\nReplace the sample tools in `agent/app/tools.py`, then add your own page and module.",
  });
}

export function GuidePage() {
  return (
    <main className="h-full overflow-y-auto px-6 py-10 sm:px-10" aria-labelledby="guide-title">
      <div className="mx-auto max-w-3xl">
        <p className="text-sm font-medium text-primary">LYKOMI UI starter</p>
        <h1 id="guide-title" className="mt-2 text-3xl font-semibold tracking-tight">
          Build an agent app around real work.
        </h1>
        <p className="mt-4 max-w-2xl text-base leading-relaxed text-muted-foreground">
          This page is a regular route beside a persistent chat. Open the chat pane to ask about the
          guide, then return to Home without losing the conversation.
        </p>
        <Button
          variant="outline"
          className="mt-6 gap-2"
          onClick={() => useChatBubbleStore.getState().open()}
        >
          <MessageSquare className="size-4" aria-hidden />
          Ask the agent about this page
        </Button>
        <Tabs.Root defaultValue="overview" className="mt-10">
          <Tabs.List aria-label="Guide sections" className="flex border-b border-border">
            <Tabs.Trigger value="overview" className={tabClass}>
              Overview
            </Tabs.Trigger>
            <Tabs.Trigger value="agent" className={tabClass}>
              Agent
            </Tabs.Trigger>
            <Tabs.Trigger value="ui" className={tabClass}>
              UI
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content
            value="overview"
            className="pt-6 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <section className="rounded-xl border border-border bg-card p-6">
              <BookOpen className="size-5 text-primary" aria-hidden />
              <h2 className="mt-4 text-lg font-semibold">A page with its own context</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                The Guide route is registered in <code>src/pages/index.tsx</code>. Its navigation
                item declares a description and agent instructions in{" "}
                <code>src/starter-module.ts</code>. Ask the agent about this page to see that the
                context travels with an AG-UI turn.
              </p>
            </section>
          </Tabs.Content>

          <Tabs.Content
            value="agent"
            className="pt-6 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Connect your agent</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Set <code>FOUNDRY_PROJECT_ENDPOINT</code> and <code>FOUNDRY_MODEL</code> in
                <code> agent/.env</code>, sign in with <code>az login</code>, then run
                <code> pnpm dev</code>. Replace the sample tools in <code>agent/app/tools.py</code>.
              </p>
            </section>
          </Tabs.Content>

          <Tabs.Content
            value="ui"
            className="pt-6 focus-visible:outline-2 focus-visible:outline-ring"
          >
            <section className="rounded-xl border border-border bg-card p-6">
              <h2 className="text-lg font-semibold">Compose your app</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Add a page or a module through <code>bootstrapShell</code>. The same chat can work
                beside your page, while the built-in panel shows source details or tool results.
              </p>
              <Button variant="outline" className="mt-5 gap-2" onClick={openArchitecturePanel}>
                <PanelRightOpen className="size-4" aria-hidden />
                Open architecture panel
              </Button>
            </section>
          </Tabs.Content>
        </Tabs.Root>
      </div>
    </main>
  );
}
