import { useState } from "react";
import { Button, Checkbox, Field, Input } from "@lykomi/web-primitives";
import { ProcessGuide, type GuidedProcessStep } from "@lykomi/web-ui";

export function ProcessExample() {
  const [phase, setPhase] = useState(0);
  const [selected, setSelected] = useState("define");
  const [goal, setGoal] = useState("Create a shared planting plan");
  const [reviewed, setReviewed] = useState(false);
  const [error, setError] = useState(false);
  const ids = ["define", "review", "finish"];
  const advance = () => {
    if (!goal.trim()) {
      setError(true);
      return;
    }
    const next = phase + 1;
    setPhase(next);
    setSelected(ids[next] ?? "");
  };
  const content = [
    <Field
      key="goal"
      label="Plan goal"
      error={error && !goal.trim() ? "Add a goal before continuing." : undefined}
    >
      <Input
        name="goal"
        value={goal}
        readOnly={phase !== 0}
        onChange={(event) => setGoal(event.target.value)}
      />
    </Field>,
    <div key="review" className="space-y-4">
      <p className="text-sm leading-relaxed">Goal: {goal}</p>
      <Field label="I have reviewed this plan">
        <Checkbox
          name="reviewed"
          checked={reviewed}
          disabled={phase !== 1}
          onCheckedChange={(checked) => setReviewed(checked === true)}
        />
      </Field>
    </div>,
    <p key="finish" className="text-sm leading-relaxed">
      Your plan is ready. Finishing this example only changes local progress; it creates no external
      resources.
    </p>,
  ];
  const steps: GuidedProcessStep[] = ids.map((id, index) => ({
    id,
    label: ["Define", "Review", "Finish"][index],
    title: ["Give the work a clear goal", "Review before moving forward", "Complete the example"][
      index
    ],
    status: index < phase ? "complete" : index === phase ? "ready" : "blocked",
    selectable: index <= phase,
    description: [
      "A short goal gives both you and your agent a useful starting point.",
      "The person owns this decision. The agent may explain the plan, but cannot approve it.",
      "Inspecting guidance and completing work are separate actions.",
    ][index],
    message:
      index > phase
        ? "Complete the previous step to unlock this step."
        : index === 1 && !reviewed
          ? "Confirm the review to continue."
          : undefined,
    content: content[index],
    actions:
      index === phase ? (
        <Button disabled={index === 1 && !reviewed} onClick={advance}>
          {index === 2 ? "Finish example" : "Continue"}
        </Button>
      ) : undefined,
  }));
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Progress with a clear owner</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Explore completed guidance without changing the actual current step.
        </p>
      </div>
      <ProcessGuide
        steps={steps}
        currentStepId={ids[phase]}
        selectedStepId={selected}
        onStepSelect={setSelected}
        variant="overview"
        guidance="expanded"
        agentContext={{
          id: "garden-plan",
          label: "Garden planning",
          sourcePage: "/showcase/process",
          active: true,
        }}
        completion={
          <p role="status" className="text-sm">
            Example complete. No work was submitted to a server.
          </p>
        }
      />
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setPhase(0);
          setSelected("define");
          setReviewed(false);
          setError(false);
        }}
      >
        Reset process
      </Button>
    </div>
  );
}
