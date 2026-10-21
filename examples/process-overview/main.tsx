import * as React from "react";
import { createRoot } from "react-dom/client";
import {
  ProcessSteps,
  type ProcessStep,
} from "../../packages/web-ui/src/components/process/process-steps.tsx";
import "./generated.css";

const base: ProcessStep[] = [
  { id: "documents", label: "Source documents", status: "complete", selectable: true },
  { id: "details", label: "Project details", status: "complete", selectable: true },
  { id: "review", label: "Review", status: "complete", selectable: true },
];

function Demo() {
  const query = new URLSearchParams(location.search);
  const [selected, setSelected] = React.useState("documents");
  const [dark, setDark] = React.useState(query.has("dark"));
  const variant = query.has("compact") ? "compact" : "overview";
  const orientation = query.has("vertical")
    ? "vertical"
    : query.has("responsive")
      ? "responsive"
      : "horizontal";
  const width = query.has("narrow") ? 360 : 900;
  const steps = query.has("details")
    ? base.map((step) => ({
        ...step,
        description:
          "A longer explanation of the completed work. Details should not move the overflow navigation away from the status markers.",
      }))
    : base;
  React.useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  return (
    <main className="min-h-screen bg-background p-6 text-foreground">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Foundry UI · synthetic layout fixture</p>
            <h1 className="text-xl font-semibold">Process overview</h1>
          </div>
          <button
            type="button"
            onClick={() => setDark(!dark)}
            className="rounded-md border border-border px-3 py-2"
          >
            {dark ? "Light theme" : "Dark theme"}
          </button>
        </header>
        <section
          dir={query.has("rtl") ? "rtl" : "ltr"}
          style={{ maxWidth: width }}
          className="rounded-xl border border-border bg-card p-4"
        >
          <ProcessSteps
            variant={variant}
            orientation={orientation}
            density={query.has("dense") ? "compact" : "comfortable"}
            steps={steps}
            currentStepId="review"
            selectedStepId={selected}
            onStepSelect={setSelected}
            label="Project preparation"
          />
        </section>
        <p className="text-sm text-muted-foreground">
          Inspecting: <span data-inspected="">{selected}</span>. Selection leaves every completed
          status intact.
        </p>
      </div>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<Demo />);
