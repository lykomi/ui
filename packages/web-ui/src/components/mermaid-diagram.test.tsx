import { act, type PropsWithChildren } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ReactMarkdown from "react-markdown";
import { MermaidDiagram } from "./mermaid-diagram.tsx";
import { markdownComponents } from "./markdown-text.tsx";

const render = vi.hoisted(() => vi.fn());
vi.mock("../lib/mermaid-render.ts", () => ({
  renderMermaid: render,
  mermaidTheme: () => ({}),
  mermaidDocument: (svg: string) => svg,
}));
vi.mock("./theme-runtime-provider.tsx", () => ({
  useThemeRuntime: () => ({ mode: "light", variables: {} }),
  ThemeScope: ({ children }: PropsWithChildren) => children,
}));
let container: HTMLDivElement;
let root: Root;
let priorAct: boolean | undefined;
beforeEach(() => {
  priorAct = globalThis.IS_REACT_ACT_ENVIRONMENT;
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  vi.useFakeTimers();
  render.mockReset().mockResolvedValue('<svg viewBox="0 0 200 100"><text>Diagram</text></svg>');
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});
afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
  globalThis.IS_REACT_ACT_ENVIRONMENT = priorAct;
});
async function draw() {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(200);
  });
}
it("renders Mermaid Markdown fences in an isolated preview and preserves ordinary code", async () => {
  await act(async () =>
    root.render(
      <ReactMarkdown components={markdownComponents}>
        {"```mermaid\nflowchart TD\nA-->B\n```\n\n```js\nconst x=1\n```"}
      </ReactMarkdown>,
    ),
  );
  await draw();
  expect(render).toHaveBeenCalledWith("flowchart TD\nA-->B", {});
  expect(container.querySelector("iframe")?.getAttribute("sandbox")).toBe("");
  expect(container.querySelector("iframe")?.title).toBe("Mermaid diagram");
  expect(container.querySelector("pre")?.textContent).toBe("const x=1");
});

it("opens the rendered diagram fullscreen and returns focus on Escape", async () => {
  await act(async () =>
    root.render(<MermaidDiagram title="Process map" source="flowchart TD\nA-->B" />),
  );
  const trigger = container.querySelector<HTMLButtonElement>(
    '[aria-label="Open diagram fullscreen"]',
  )!;
  expect(trigger.disabled).toBe(true);
  await draw();
  expect(trigger.disabled).toBe(false);
  trigger.focus();
  act(() => trigger.click());

  const dialog = document.querySelector('[role="dialog"]')!;
  const frame = dialog.querySelector("iframe")!;
  expect(dialog.querySelector("h2")?.textContent).toBe("Process map");
  expect(frame.srcdoc).toBe(container.querySelector("iframe")?.srcdoc);
  expect(frame.getAttribute("sandbox")).toBe("");
  expect(frame.getAttribute("referrerpolicy")).toBe("no-referrer");
  expect(frame.tabIndex).toBe(-1);
  expect(render).toHaveBeenCalledOnce();

  await act(async () => {
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  });
  await act(async () => vi.advanceTimersByTimeAsync(0));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(document.activeElement).toBe(trigger);
  expect(container.querySelector("iframe")).not.toBeNull();
});

it("keeps incomplete streamed source readable and renders when streaming ends", async () => {
  await act(async () => root.render(<MermaidDiagram source="flowchart TD\nA-->B" isStreaming />));
  await draw();
  expect(render).not.toHaveBeenCalled();
  expect(container.querySelector("pre")?.textContent).toContain("A-->B");
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="Open diagram fullscreen"]')?.disabled,
  ).toBe(true);
  await act(async () =>
    root.render(<MermaidDiagram source="flowchart TD\nA-->B" isStreaming={false} />),
  );
  await draw();
  expect(container.querySelector("iframe")).not.toBeNull();
});
it("does not let an older async render overwrite newer source", async () => {
  let finish!: (svg: string) => void;
  render.mockImplementationOnce(
    () =>
      new Promise<string>((resolve) => {
        finish = resolve;
      }),
  );
  await act(async () => root.render(<MermaidDiagram source="flowchart TD\nA-->B" />));
  await draw();
  await act(async () => root.render(<MermaidDiagram source="flowchart TD\nC-->D" />));
  await draw();
  await act(async () => finish("<svg>OLD</svg>"));
  expect(container.querySelector("iframe")?.srcdoc).not.toContain("OLD");
});
it("shows source after a parser error and recovers on the next edit", async () => {
  render.mockRejectedValueOnce(new Error("invalid"));
  await act(async () => root.render(<MermaidDiagram source="broken" />));
  await draw();
  expect(container.querySelector("pre")?.textContent).toBe("broken");
  expect(container.textContent).toContain("Could not render");
  await act(async () => root.render(<MermaidDiagram source="flowchart TD\nA-->B" />));
  await draw();
  expect(container.querySelector("iframe")).not.toBeNull();
});

it("uses Source as the single editor action and keeps read-only source viewing", async () => {
  const edit = vi.fn();
  await act(async () =>
    root.render(<MermaidDiagram source="flowchart TD\nA-->B" onEditSource={edit} />),
  );
  await draw();
  const sourceButton = () =>
    Array.from(container.querySelectorAll("button")).find((item) => item.textContent === "Source");
  expect(container.querySelectorAll("button")).toHaveLength(4);
  expect(container.textContent).not.toContain("Edit source");
  act(() => sourceButton()?.click());
  expect(edit).toHaveBeenCalledOnce();
  expect(container.querySelector("pre")).toBeNull();
  await act(async () => root.render(<MermaidDiagram source="flowchart TD\nA-->B" />));
  act(() => sourceButton()?.click());
  expect(container.querySelector("pre")?.textContent).toContain("A-->B");
  expect(
    container.querySelector<HTMLButtonElement>('[aria-label="Open diagram fullscreen"]')?.disabled,
  ).toBe(true);
  expect(edit).toHaveBeenCalledOnce();
});

it("never submits a host form when using the diagram toolbar", async () => {
  const submit = vi.fn();
  await act(async () =>
    root.render(
      <form
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <MermaidDiagram source="flowchart TD\nA-->B" onEditSource={() => {}} />
      </form>,
    ),
  );
  await draw();
  for (const button of container.querySelectorAll("button")) {
    expect(button.type).toBe("button");
    act(() => button.click());
  }
  expect(submit).not.toHaveBeenCalled();
});
