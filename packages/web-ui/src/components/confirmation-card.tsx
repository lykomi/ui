/**
 * Confirmation Card — informational UI for the ui_confirm tool.
 *
 * Renders a card with action description and optional details.
 * The user responds by typing their confirmation in the chat.
 */

import { ShieldCheck } from "lucide-react";
import { ToolCallCard, type ToolCallStatus } from "./tool-call-card.tsx";

interface ConfirmationCardProps {
  action: string;
  details?: string;
  status: ToolCallStatus;
}

export function ConfirmationCard({ action, details, status }: ConfirmationCardProps) {
  return (
    <ToolCallCard
      icon={<ShieldCheck className="size-3.5" />}
      title="Confirmation Required"
      description={action}
      status={status}
      className="w-full"
    >
      {details && <p className="text-xs text-muted-foreground mt-1">{details}</p>}
      <p className="text-xs text-muted-foreground mt-2 italic">
        Reply to confirm or reject this action.
      </p>
    </ToolCallCard>
  );
}
