import { Button } from "../../packages/web-primitives/src/index.ts";
import {
  ProcessSteps,
  type ProcessStep,
} from "../../packages/web-ui/src/components/process/process-steps.tsx";

export function ProcessSymbolsDemo({ onBack }: { onBack?: () => void }) {
  const examples: (ProcessStep & {
    key: string;
    name: string;
    meaning: string;
    api: string;
    selected?: boolean;
  })[] = [
    {
      id: "pending",
      key: "pending",
      name: "Waiting",
      label: "Waiting for availability",
      status: "pending",
      meaning: "Not yet ready or scheduled. No known prerequisite blocker.",
      api: 'status="pending"',
    },
    {
      id: "ready",
      key: "ready",
      name: "Ready · not selected",
      label: "Available step",
      status: "ready",
      meaning: "Available to start. Not currently being inspected.",
      api: 'status="ready"',
    },
    {
      id: "selected",
      key: "selected",
      name: "Ready · selected",
      label: "Inspected step",
      status: "ready",
      selected: true,
      meaning:
        "The dot identifies the ready step whose guidance is open. It does not mean running.",
      api: 'status="ready" + selectedStepId',
    },
    {
      id: "running",
      key: "running",
      name: "Running",
      label: "Analysis running",
      status: "running",
      meaning: "Work has actually started. Spinner pauses for reduced motion.",
      api: 'status="running"',
    },
    {
      id: "complete",
      key: "complete",
      name: "Completed",
      label: "Documents confirmed",
      status: "complete",
      meaning: "Required work was completed. Inspecting it again keeps the check.",
      api: 'status="complete"',
    },
    {
      id: "blocked",
      key: "blocked",
      name: "Blocked",
      label: "Review unavailable",
      status: "blocked",
      message: "Confirm the required setup before reviewing.",
      meaning: "A known prerequisite or permission prevents execution. Explain it in message.",
      api: 'status="blocked" + message',
    },
    {
      id: "error",
      key: "error",
      name: "Needs attention",
      label: "Analysis failed",
      status: "error",
      message: "The run failed. Correct the input or retry.",
      meaning: "A failure or invalid result needs attention. The explanation remains visible.",
      api: 'status="error" + message',
    },
    {
      id: "skipped",
      key: "skipped",
      name: "Skipped",
      label: "Extra checks skipped",
      status: "skipped",
      meaning: "An explicit skip decision was recorded by the host. Skipped is not completed.",
      api: 'status="skipped"',
    },
    {
      id: "optional",
      key: "optional",
      name: "Optional · independent",
      label: "AI enrichment",
      status: "ready",
      optional: true,
      meaning:
        "May be omitted if the host allows it. Can independently be ready, blocked, running or skipped.",
      api: "optional={true} + status",
    },
  ];
  return (
    <div style={{ display: "grid", gap: 24 }}>
      <style>
        {
          ".symbol-demo-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}@media(max-width:1050px){.symbol-demo-grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.symbol-demo-grid{grid-template-columns:1fr}}"
        }
      </style>
      <header>
        <h1 style={{ fontSize: 24, fontWeight: 650 }}>Process symbols · Complete reference</h1>
        <p style={{ color: "var(--muted-foreground)" }}>
          Individual state examples, not a single workflow. Status, selection and optionality are
          separate.
        </p>
      </header>
      {onBack ? (
        <div>
          <Button type="button" variant="outline" onClick={onBack}>
            Back to component lab
          </Button>
        </div>
      ) : null}
      <div className="symbol-demo-grid">
        {examples.map((e) => (
          <section
            key={e.key}
            style={{
              minWidth: 0,
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              padding: 16,
              display: "grid",
              alignContent: "start",
              gap: 12,
            }}
          >
            <h2 style={{ fontSize: 14, fontWeight: 650 }}>{e.name}</h2>
            <ProcessSteps
              orientation="horizontal"
              steps={[
                {
                  id: e.key,
                  label: e.label,
                  status: e.status,
                  optional: e.optional,
                  message: e.message,
                },
              ]}
              selectedStepId={e.selected ? e.key : undefined}
            />
            <code style={{ fontSize: 12, color: "var(--primary)" }}>{e.api}</code>
            <p style={{ fontSize: 13, lineHeight: 1.5, color: "var(--muted-foreground)" }}>
              {e.meaning}
            </p>
          </section>
        ))}
      </div>
      <section style={{ borderTop: "1px solid var(--border)", paddingTop: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 650 }}>Developer / agent contract</h2>
        <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--muted-foreground)" }}>
          <strong>status</strong>: execution state · <strong>currentStepId</strong>: actual process
          position · <strong>selectedStepId</strong>: inspected step · <strong>selectable</strong>:
          explicit permission to inspect · <strong>optional</strong>: may be omitted. The host
          validates, saves and records skips; the component never advances by itself.
        </p>
      </section>
    </div>
  );
}
