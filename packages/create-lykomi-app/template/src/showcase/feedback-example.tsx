import { useEffect, useState } from "react";
import { Button } from "@lykomi/web-primitives";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  ToolCallCard,
  useAppStore,
  type ToolCallStatus,
} from "@lykomi/web-ui";

const states = {
  idle: { label: "Ready", description: "Choose a simulated outcome to explore its presentation." },
  running: { label: "Running", description: "Preparing a plan…" },
  complete: { label: "Complete", description: "A local example result is ready to inspect." },
  error: { label: "Error", description: "The simulated request failed. Your draft is unchanged." },
} as const;

export function FeedbackExample() {
  const [state, setState] = useState<keyof typeof states>("idle");
  const [dialog, setDialog] = useState(false);
  const [notice, setNotice] = useState("");
  const status: ToolCallStatus =
    state === "error"
      ? { type: "incomplete", reason: "error" }
      : state === "running"
        ? { type: "running" }
        : { type: "complete" };
  useEffect(() => {
    useAppStore.getState().setContextItem("showcase-feedback", {
      type: "ref",
      label: "Feedback example",
      sourcePage: "/showcase/feedback",
      persistence: "ephemeral",
      payload: {
        kind: "ref",
        refType: "example",
        refId: "feedback",
        meta: {
          simulated: true,
          status: state,
          description: states[state].description,
          dialogOpen: dialog,
        },
      },
    });
  }, [state, dialog]);
  useEffect(() => () => useAppStore.getState().setContextItem("showcase-feedback", null), []);
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Make every outcome understandable</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          These are explicit UI simulations. They do not run an agent or a network request.
        </p>
      </div>
      <div aria-label="Simulated outcome" className="flex flex-wrap gap-2">
        {(Object.keys(states) as Array<keyof typeof states>).map((key) => (
          <Button
            key={key}
            size="sm"
            variant={state === key ? "default" : "outline"}
            aria-pressed={state === key}
            onClick={() => setState(key)}
          >
            {states[key].label}
          </Button>
        ))}
      </div>
      {state === "idle" ? (
        <div
          role="status"
          className="rounded-xl border border-dashed border-border p-8 text-center"
        >
          <p className="font-medium">No result yet</p>
          <p className="mt-2 text-sm text-muted-foreground">{states.idle.description}</p>
        </div>
      ) : (
        <ToolCallCard
          title="Prepare a plan"
          description={states[state].description}
          status={status}
          defaultOpen
          action={
            state === "error"
              ? { label: "Retry simulation", onClick: () => setState("running") }
              : undefined
          }
        >
          <p className="text-sm">
            {state === "complete"
              ? "Three suggested tasks: choose a site, gather ideas, and agree on a watering schedule."
              : "The example remains available while this status changes."}
          </p>
        </ToolCallCard>
      )}
      <div className="border-t border-border pt-5">
        <Dialog open={dialog} onOpenChange={setDialog}>
          <DialogTrigger asChild>
            <Button variant="outline">Open confirmation dialog</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reset this example?</DialogTitle>
              <DialogDescription>
                This only clears the simulated result. No project or remote data will be changed.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialog(false)}>
                Keep result
              </Button>
              <Button
                onClick={() => {
                  setState("idle");
                  setNotice("Example reset. No remote data changed.");
                  setDialog(false);
                }}
              >
                Reset example
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <p role="status" className="mt-3 text-xs text-muted-foreground">
          {notice || "Try Tab, Escape and return focus on close."}
        </p>
      </div>
    </div>
  );
}
