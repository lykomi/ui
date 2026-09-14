import { useRef } from "react";
import { createUiId, useChatLifecycleStore } from "@iloveagents/foundry-web-ui";

/** New-chat intent advances the fallback ID even without a host sticky-ID hook. */
export function useFreshConversationId(sticky: string | null) {
  const version = useChatLifecycleStore((state) => state.newConversationVersion);
  const current = useRef({ id: createUiId(), version, sticky });
  if (current.current.version !== version || (sticky === null && current.current.sticky !== null))
    current.current.id = createUiId();
  current.current.version = version;
  current.current.sticky = sticky;
  return current.current.id;
}
