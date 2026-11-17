import { ComposerPrimitive, ThreadPrimitive, useAuiEvent } from "@assistant-ui/react";
import { ComposerInput } from "../components/composer-input.tsx";
import { ComposerAddMenu } from "../components/composer-add-menu.tsx";
import { ComposerActionButton } from "../components/assistant-chat.tsx";
import { composerAttachmentComponents } from "../components/chat-attachments.tsx";
import type { NavGroup } from "../lib/nav-config.ts";
import { WelcomeIntro } from "./welcome-intro.tsx";
import { HomeDestinations } from "./home-destinations.tsx";

function OpenConversationOnSend({ onOpen }: { onOpen: () => void }) {
  useAuiEvent("composer.send", onOpen);
  return null;
}

/** An entry point into the existing composer/runtime, never a second conversation. */
export function HomeContent({
  groups,
  chatOpen,
  onOpenChat,
}: {
  groups: NavGroup[];
  chatOpen: boolean;
  onOpenChat: (focus?: boolean) => void;
}) {
  if (chatOpen) return null;
  return (
    <div data-home-content className="flex min-h-0 flex-1 flex-col">
      <div data-home-scroll className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 py-10">
        <div data-home-welcome className="mx-auto w-full max-w-3xl shrink-0">
          <WelcomeIntro navGroups={groups} historyShortcut={null} />
          <div className="mt-8 mb-6">
            <ThreadPrimitive.Root>
              <OpenConversationOnSend onOpen={onOpenChat} />
              <ComposerPrimitive.Root className="@container [--composer-action-size:2.5rem] rounded-2xl border border-input bg-muted/30 px-4 py-2 focus-within:border-primary/50">
                <ComposerPrimitive.Attachments components={composerAttachmentComponents} />
                <div className="flex items-center gap-2">
                  <ComposerAddMenu />
                  <ComposerInput
                    aria-label="Message"
                    placeholder="Do anything"
                    rows={1}
                    className="min-w-0 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-muted-foreground"
                  />
                  <div className="flex shrink-0 items-center gap-2">
                    <ComposerActionButton onAction={() => onOpenChat()} />
                  </div>
                </div>
              </ComposerPrimitive.Root>
            </ThreadPrimitive.Root>
          </div>
          <HomeDestinations groups={groups} />
        </div>
      </div>
    </div>
  );
}
