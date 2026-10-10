import { useEffect, useState } from "react";
import { MemoryRouter } from "react-router";
import { ChatContext } from "../../packages/web-ui/src/components/chat-context.tsx";
import { useAppStore } from "../../packages/web-ui/src/lib/app-store.ts";
import { createRoot } from "react-dom/client";
import {
  ProcessGuide,
  type GuidedProcessStep,
} from "../../packages/web-ui/src/components/process/process-guide.tsx";
import { Button, Input, Field } from "../../packages/web-primitives/src/index.ts";
import "./styles.css";

function Preview() {
  const [selected, setSelected] = useState("review");
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
    return () => document.documentElement.classList.remove("dark");
  }, [dark]);
  const [note, setNote] = useState("Check the detected findings");
  const steps: GuidedProcessStep[] = [
    {
      id: "documents",
      label: "Documents",
      status: "complete",
      selectable: true,
      title: "Select the source documents",
      description: "Choose the documents for this assessment.",
      content: (
        <Field label="Document">
          <Input value="Contract assessment.pdf" readOnly />
        </Field>
      ),
    },
    {
      id: "review",
      label: "Review",
      status: "ready",
      selectable: true,
      title: "Review the findings",
      description: "Check the findings before confirming.",
      content: (
        <Field label="Review notes">
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      ),
    },
    {
      id: "confirm",
      label: "Confirm",
      status: "blocked",
      selectable: true,
      title: "Confirm the assessment",
      message: "Complete the review before confirming.",
      description: "Your final confirmation will be available after the review.",
    },
  ];
  return (
    <main>
      <div className="preview-shell">
        <header>
          <div>
            <small>Foundry UI · local preview</small>
            <h1>Process guidance</h1>
          </div>
          <Button variant="outline" onClick={() => setDark(!dark)}>
            {dark ? "Light theme" : "Dark theme"}
          </Button>
        </header>
        <div className="preview-context">
          <ChatContext />
        </div>
        <ProcessGuide
          agentContext={{ id: "assessment", label: "Assessment", sourcePage: "/", active: true }}
          framed
          variant="compact"
          showChevrons
          currentStepId="review"
          selectedStepId={selected}
          onStepSelect={setSelected}
          steps={steps}
          density="compact"
          guidance="collapsible"
          guidanceTogglePlacement="step"
          guidanceOpen={open}
          onGuidanceOpenChange={setOpen}
        />
      </div>
    </main>
  );
}
useAppStore
  .getState()
  .setNavContext({ ...useAppStore.getInitialState().navContext, label: "Process guidance" });
createRoot(document.getElementById("root")!).render(
  <MemoryRouter>
    <Preview />
  </MemoryRouter>,
);
