import { useEffect, useState } from "react";
import { ConfirmDialog } from "./confirm-dialog.tsx";
import { allowConfirmedChatUnload, isChatRunActive, useChatRuns } from "../lib/chat-runs-store.ts";

export function ChatLeaveGuard() {
  const [destination, setDestination] = useState<HTMLAnchorElement | null>(null);
  const active = useChatRuns((s) =>
    Object.values(s.runs)
      .filter(isChatRunActive)
      .map((r) => r.title)
      .join(", "),
  );
  useEffect(() => {
    if (!active) {
      setDestination(null);
      return;
    }
    const follow = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      )
        return;
      const link = event
        .composedPath()
        .find((node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement);
      if (!link?.href || link.hasAttribute("download")) return;
      const target =
        link.getAttribute("target") ??
        document.querySelector("base[target]")?.getAttribute("target");
      if (target && target.toLowerCase() !== "_self") return;
      const url = new URL(link.href);
      if (!["https:", "http:"].includes(url.protocol) || url.origin === location.origin) return;
      event.preventDefault();
      // Snapshot the native link (including referrer policy and rel). The
      // original node may change while the confirmation is open.
      const copy = link.cloneNode(false) as HTMLAnchorElement;
      copy.href = url.href;
      copy.target = "_self";
      copy.removeAttribute("onclick");
      setDestination(copy);
    };
    document.addEventListener("click", follow);
    return () => document.removeEventListener("click", follow);
  }, [active]);
  return (
    <ConfirmDialog
      open={Boolean(destination && active)}
      onOpenChange={() => setDestination(null)}
      title="Leave this site?"
      description={`Still working in “${active}”. Leaving for ${destination?.host} will disconnect the live chat.`}
      cancelLabel="Stay here"
      confirmLabel="Leave site"
      onConfirm={() => {
        if (!destination) return;
        setDestination(null);
        allowConfirmedChatUnload();
        destination.click();
      }}
    />
  );
}
