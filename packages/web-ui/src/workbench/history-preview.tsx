import { useState } from "react";
import { MessageSquare, Pin, PinOff } from "lucide-react";
import type { NavItem } from "../lib/nav-config.ts";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog.tsx";

const examples = [
  ["Contract renewal review", "Three upcoming renewals need a decision this month."],
  [
    "Prepare the supplier meeting",
    "The agenda includes delivery dates, open risks, and service coverage.",
  ],
  ["Project handover checklist", "Eight items are complete. Two documents still need an owner."],
  [
    "Compare the revised service agreement",
    "The revised draft changes the notice period and support hours.",
  ],
  [
    "Summarize the latest project documents",
    "The summary covers milestones, decisions, and outstanding questions.",
  ],
  [
    "Find the warranty terms",
    "The warranty starts after acceptance and includes the agreed service scope.",
  ],
  [
    "Draft the weekly status update",
    "The draft is ready, including progress and the next three actions.",
  ],
  [
    "Open questions for the commercial review",
    "Payment terms and the delivery schedule still need clarification.",
  ],
  ["Find the signed contract", "The signed version is filed with the project documents."],
  ["Check the delivery milestones", "Two milestones fall in the next six weeks."],
  ["Create a project workspace", "The workspace structure is ready for its first documents."],
  [
    "Prepare the customer follow-up",
    "The draft includes the agreed actions and proposed next meeting.",
  ],
];

/** Explicitly enabled by a local development host; no server chats or permissions are changed. */
export function useHistoryPreview(enabled: boolean, workspaceId: unknown) {
  const [hidden, setHidden] = useState(false);
  const [pins, setPins] = useState(new Set([0, 1, 2]));
  const [selected, setSelected] = useState<NavItem | null>(null);
  const [startedAt] = useState(Date.now());
  const items: NavItem[] =
    !enabled || hidden
      ? []
      : examples.map(([label, description], index) => {
          const pinned = pins.has(index);
          return {
            to: `#sample-conversation-${index}`,
            label,
            description,
            icon: MessageSquare,
            meta: {
              previewSample: true,
              pinned,
              previewSpaceName: workspaceId
                ? "This space · sample"
                : ["Project hub · sample", "Procurement · sample", "General · sample"][index % 3],
              previewEntityName: workspaceId ? "This space · sample" : undefined,
              updatedAt: new Date(startedAt - (index + 1) * 47 * 60_000).toISOString(),
            },
            actions: [
              {
                label: pinned ? "Unpin" : "Pin",
                icon: pinned ? PinOff : Pin,
                handler: () =>
                  setPins((current) => {
                    const next = new Set(current);
                    if (next.has(index)) next.delete(index);
                    else next.add(index);
                    return next;
                  }),
              },
            ],
          };
        });
  return {
    items,
    hidden,
    toggle: () => setHidden((value) => !value),
    open: setSelected,
    dialog: (
      <Dialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selected?.label}</DialogTitle>
            <DialogDescription>Sample conversation · local layout preview</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm leading-relaxed">
            <p className="rounded-lg bg-muted p-3">{selected?.label}</p>
            <p>{selected?.description}</p>
            <p className="text-xs text-muted-foreground">
              This is sample content. Your real conversations open in the normal chat.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    ),
  };
}
