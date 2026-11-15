import { useLayoutEffect, useRef } from "react";
import { Link, Navigate, useParams } from "react-router";
import {
  Braces,
  ChartNoAxesCombined,
  Check,
  Columns2,
  ListChecks,
  ListFilter,
  TextCursorInput,
  Workflow,
} from "lucide-react";
import { cn } from "@lykomi/web-primitives";
import { DashboardExample } from "./dashboard-example.tsx";
import dashboardSource from "./dashboard-example.tsx?raw";
import { FormExample } from "./form-example.tsx";
import { TableExample } from "./table-example.tsx";
import { ProcessExample } from "./process-example.tsx";
import { WindowsExample } from "./windows-example.tsx";
import { FeedbackExample } from "./feedback-example.tsx";
import { ContextInspector } from "./context-inspector.tsx";
import { SourcePanel } from "./source-panel.tsx";
import formSource from "./form-example.tsx?raw";
import modelSource from "./form-model.ts?raw";
import tableSource from "./table-example.tsx?raw";
import processSource from "./process-example.tsx?raw";
import windowsSource from "./windows-example.tsx?raw";
import feedbackSource from "./feedback-example.tsx?raw";

const examples = [
  {
    id: "forms",
    label: "Forms",
    icon: TextCursorInput,
    title: "A field is shared context.",
    description:
      "Select a value or a few words. The framework carries the current field into chat; your application owns edits and saving.",
    component: FormExample,
    prompt: "Make the selected project brief more specific. Leave the change unsaved.",
    tags: ["Field", "FormLayout", "usePageTools"],
    sources: [
      { name: "form-example.tsx", code: formSource },
      { name: "form-model.ts", code: modelSource },
    ],
  },
  {
    id: "collections",
    label: "Collections",
    icon: ListFilter,
    title: "Work with what is on screen.",
    description:
      "A table, its filters and its selection form one coherent view. The context includes rendered columns, visible rows and selection IDs.",
    component: TableExample,
    prompt: "Show me the tasks about watering, then summarize the visible results.",
    tags: ["DataTable", "useDataTable", "setContextItem"],
    sources: [{ name: "table-example.tsx", code: tableSource }],
  },
  {
    id: "dashboard",
    label: "Dashboards",
    icon: ChartNoAxesCombined,
    title: "Give every number its context.",
    description:
      "Explore KPI cards, trends, breakdowns and goals. The selected period drives both the visible charts and the data shared with your agent.",
    component: DashboardExample,
    prompt:
      "Summarize the dashboard for the selected period. Compare activities and explain progress toward the goal using the example data.",
    tags: ["DashboardGrid", "StatCard", "@lykomi/web-ui/chart"],
    sources: [{ name: "dashboard-example.tsx", code: dashboardSource }],
  },
  {
    id: "process",
    label: "Processes",
    icon: Workflow,
    title: "Keep guidance close to the work.",
    description:
      "Make progress and blockers explicit. Your agent can inspect a step; completing work remains a deliberate application action.",
    component: ProcessExample,
    prompt: "Which step am I on, and what needs to happen before I can continue?",
    tags: ["ProcessGuide", "agentContext", "Host actions"],
    sources: [{ name: "process-example.tsx", code: processSource }],
  },
  {
    id: "windows",
    label: "Workbench",
    icon: Columns2,
    title: "Change the layout. Keep the work.",
    description:
      "The same content moves between tabs and panels. The active window tells the agent which piece of work you mean.",
    component: WindowsExample,
    prompt: "Summarize the active note and suggest a useful next step.",
    tags: ["WindowWorkbench", "createWindowStore", "Window context"],
    sources: [{ name: "windows-example.tsx", code: windowsSource }],
  },
  {
    id: "feedback",
    label: "Feedback",
    icon: ListChecks,
    title: "Show what happened, and what is next.",
    description:
      "Explore empty, running, successful and failed states, plus an accessible confirmation dialog. Every simulation is labelled as one.",
    component: FeedbackExample,
    prompt: "Explain the current simulated status and what I can do next.",
    tags: ["ToolCallCard", "Dialog", "Status feedback"],
    sources: [{ name: "feedback-example.tsx", code: feedbackSource }],
  },
];

export default function ShowcasePage() {
  const { example = "forms" } = useParams();
  const selected = examples.find((item) => item.id === example);
  const surface = useRef<HTMLElement>(null);
  const page = useRef<HTMLElement>(null);
  useLayoutEffect(() => {
    // Each route is a new example, not another view of the previous scroll position.
    let viewport = page.current?.parentElement;
    while (viewport) {
      if (/auto|scroll/.test(getComputedStyle(viewport).overflowY)) {
        viewport.scrollTop = 0;
        break;
      }
      viewport = viewport.parentElement;
    }
  }, [example]);
  if (!selected) return <Navigate to="/showcase" replace />;
  const Example = selected.component;
  return (
    <div
      data-showcase-scroll
      role="region"
      aria-label="Showcase content"
      tabIndex={0}
      className="min-h-0 flex-1 overflow-y-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
    >
      <main
        ref={page}
        className="@container mx-auto w-full max-w-6xl px-4 py-6 sm:px-8 sm:py-10"
        aria-label="Component showcase"
      >
        <header className="max-w-3xl">
          <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-primary">
            <Braces className="size-4" /> LYKOMI UI / Components
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            Interfaces an agent can work with.
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Real components. Working examples. The actual context behind every interaction.
          </p>
          <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Check className="size-3.5 text-primary" /> Explore locally · connect your agent when
            you are ready
          </p>
        </header>
        <nav
          aria-label="Showcase examples"
          className="my-7 flex flex-wrap gap-1 border-b border-border pb-2"
        >
          {examples.map(({ id, label, icon: Icon }) => (
            <Link
              key={id}
              to={`/showcase/${id}`}
              aria-current={example === id ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                example === id
                  ? "bg-primary/10 font-medium text-primary"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          ))}
        </nav>
        <div className="grid min-w-0 items-start gap-6 @5xl:grid-cols-[minmax(0,1fr)_19rem]">
          <div className="min-w-0 space-y-5">
            <div>
              <h2 className="text-xl font-semibold tracking-tight">{selected.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {selected.description}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.tags.map((tag) => (
                  <code
                    key={tag}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground"
                  >
                    {tag}
                  </code>
                ))}
              </div>
            </div>
            <section
              ref={surface}
              aria-label={`${selected.label} interactive example`}
              className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6"
            >
              <Example key={selected.id} />
            </section>
            <SourcePanel key={selected.id} files={selected.sources} />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Built from the published @lykomi packages. Example data resets when you leave an
              example. Remove showcaseModule from src/main.tsx when you make this app your own.
            </p>
          </div>
          <ContextInspector key={selected.id} surface={surface} prompt={selected.prompt} />
        </div>
      </main>
    </div>
  );
}
