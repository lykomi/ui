import { type ReactNode } from "react";
import { Button } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  useNavStore,
} from "../index.ts";
import { ChatHomeStartersSlot } from "../components/chat-slots.tsx";
import { Layers } from "lucide-react";
export function WelcomeIntro({
  navGroups,
  historyShortcut,
}: {
  navGroups: ReturnType<typeof useNavStore.getState>["config"];
  historyShortcut: ReactNode;
}) {
  return (
    <div className="mb-4 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">What would you like to get done?</h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Find information, create or edit content, and run actions across your spaces.
      </p>
      <div className="mx-auto mt-4 max-w-sm text-left">
        <ChatHomeStartersSlot priority={10} />
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        {historyShortcut}
        {navGroups.some(
          (group) => group.meta?.type === "spaces-workspaces" && group.createActions?.length,
        ) && (
          <div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-9 gap-2 bg-primary/10 px-3 text-sm font-medium hover:bg-primary/15 [@media(pointer:coarse)]:min-h-11"
                >
                  <Layers className="size-4" aria-hidden="true" />
                  Create a space
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="center">
                {navGroups
                  .filter((group) => group.meta?.type === "spaces-workspaces")
                  .flatMap((group) => group.createActions ?? [])
                  .map((action) => (
                    <DropdownMenuItem key={action.id} onSelect={() => action.handler()}>
                      {action.label}
                    </DropdownMenuItem>
                  ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
    </div>
  );
}
