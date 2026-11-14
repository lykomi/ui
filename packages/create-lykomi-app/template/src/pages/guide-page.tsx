import { MessageSquare, Plus } from "lucide-react";
import { Button } from "@lykomi/web-primitives";
import { WindowWorkbench } from "@lykomi/web-ui/windows";
import {
  useChatBubbleStore,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@lykomi/web-ui";
import { DraftForm } from "./draft-form.tsx";
import { useDraftTools } from "./use-draft-tools.ts";
import { guideWindows, openGuideWindow } from "./guide-windows.ts";

export function GuidePage() {
  useDraftTools();
  return (
    <WindowWorkbench
      controller={guideWindows}
      toolbar={
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" aria-label="Open window">
              <Plus />
              Open
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => openGuideWindow("overview")}>Guide</DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openGuideWindow("architecture")}>
              Architecture
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openGuideWindow("draft")}>
              Working draft
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      }
      empty={
        <div className="p-8">
          <Button onClick={() => openGuideWindow("overview")}>Open guide</Button>
        </div>
      }
      getWindowContext={(tab) => ({
        title: tab.title,
        kind: "document",
        windowId: tab.id,
        content:
          tab.text ??
          (tab.kind === "architecture"
            ? "Browser shell → AG-UI → FastAPI agent. Each page supplies its own context."
            : "The starter guide explains agent configuration, page context, tabs and panels."),
        unsavedChanges: Boolean(tab.dirty),
        ...(tab.kind === "draft"
          ? {
              kind: "form",
              mode: tab.editing ? "edit" : "view",
              fields: {
                name: { label: "App name", value: tab.name },
                text: { label: "Your idea", value: tab.text },
              },
            }
          : {}),
      })}
      renderWindow={(tab) => (
        <main className="mx-auto max-w-3xl px-6 py-8 sm:px-10" aria-label={String(tab.title)}>
          <p className="text-sm font-medium text-primary">LYKOMI UI starter</p>
          {tab.kind === "overview" && (
            <>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight">
                Build an agent app around real work.
              </h1>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Your pages, a persistent conversation, and a shared workbench. Open a draft and the
                architecture, then switch between tabs and panels. Your work stays in place.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button onClick={() => openGuideWindow("draft")}>Open working draft</Button>
                <Button variant="outline" onClick={() => openGuideWindow("architecture")}>
                  Open architecture
                </Button>
              </div>
              <section className="mt-8 rounded-xl border border-border bg-card p-6">
                <h2 className="text-lg font-semibold">Connect your agent</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Set <code>FOUNDRY_PROJECT_ENDPOINT</code> and <code>FOUNDRY_MODEL</code> in{" "}
                  <code>agent/.env</code>, sign in with <code>az login</code>, then run{" "}
                  <code>pnpm dev</code>. Replace the sample tools in <code>agent/app/tools.py</code>
                  .
                </p>
              </section>
            </>
          )}
          {tab.kind === "architecture" && (
            <>
              <h1 className="mt-2 text-2xl font-semibold">Starter architecture</h1>
              <p className="mt-4 leading-relaxed text-muted-foreground">
                <code>bootstrapShell</code> composes your routes, theme, modules and persistent
                chat. The browser sends AG-UI runs to <code>/api/agent</code>, including the active
                page and window context.
              </p>
              <h2 className="mt-6 text-lg font-semibold">Make the workbench yours</h2>
              <p className="mt-2 leading-relaxed text-muted-foreground">
                <code>createWindowStore</code> owns open windows. <code>WindowWorkbench</code>{" "}
                renders the same content as tabs or panels. Your app supplies the content and
                decides how to save drafts.
              </p>
            </>
          )}
          {tab.kind === "draft" && <DraftForm tab={tab} />}
          <Button
            variant="outline"
            className="mt-6 gap-2"
            onClick={() => useChatBubbleStore.getState().open()}
          >
            <MessageSquare className="size-4" aria-hidden />
            Ask the agent about this page
          </Button>
        </main>
      )}
    />
  );
}
