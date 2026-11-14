import { createWindowStore, type WorkbenchWindow } from "@lykomi/web-ui/windows";

export interface GuideWindow extends WorkbenchWindow {
  kind: "overview" | "architecture" | "draft";
  text?: string;
}

// App-owned data; the UI framework owns selection, pinning, ordering and layouts.
// Keeping this store outside the route also retains drafts when visiting Home.
export const guideWindows = createWindowStore<GuideWindow>({
  storageKey: "starter.windows.layout",
});

export function openGuideWindow(kind: GuideWindow["kind"]) {
  const title = { overview: "Guide", architecture: "Architecture", draft: "Working draft" }[kind];
  guideWindows.open(
    {
      id: kind,
      kind,
      title,
      independent: true,
      text: kind === "draft" ? "My agent app will help people…" : undefined,
      close: () => {
        const tab = guideWindows.get().tabs.find((entry) => entry.id === kind);
        if (tab?.dirty && !window.confirm("Close this draft and discard your changes?")) return;
        guideWindows.remove(kind);
      },
    },
    { mode: "new-tab" },
  );
}
openGuideWindow("overview");
