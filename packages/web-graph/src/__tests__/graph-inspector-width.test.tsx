import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { GraphInspector } from "../graph-inspector.tsx";

it("resizes immediately from the rendered width in a narrow pane", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const resize = vi.fn();
  try {
    await act(async () =>
      root.render(
        <GraphInspector
          selection={{ node: { id: "node", labels: ["Document"], properties: {} }, edge: null }}
          colorForLabel={() => "gray"}
          captionOf={() => "Document"}
          onClose={() => {}}
          width={640}
          maxWidth={300}
          onWidthChange={resize}
        />,
      ),
    );
    const separator = host.querySelector('[role="separator"]')!;
    expect(separator.getAttribute("aria-valuenow")).toBe("300");
    expect(separator.getAttribute("aria-valuemax")).toBe("300");
    await act(async () =>
      separator.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
    );
    expect(resize).toHaveBeenLastCalledWith(268);
    await act(async () =>
      separator.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true })),
    );
    expect(resize).toHaveBeenLastCalledWith(300);
  } finally {
    await act(async () => root.unmount());
    host.remove();
  }
});
