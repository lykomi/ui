/**
 * Attachment rendering components for chat messages and composer.
 *
 * Following the official assistant-ui pattern, attachment components
 * live in a separate file from the main thread components.
 *
 * @see https://www.assistant-ui.com/ - assistant-ui Documentation
 */

import { type FC } from "react";
import { AttachmentPrimitive } from "@assistant-ui/react";
import { FileText, X } from "lucide-react";
import { cn } from "@lastspace/web-primitives";

/** Renders a pending file attachment chip in the composer with a remove button. */
export const ComposerAttachment: FC = () => (
  <AttachmentPrimitive.Root
    className={cn(
      "inline-flex items-center gap-2 max-w-[250px]",
      "rounded-lg border border-border bg-muted/50",
      "px-3 py-2",
    )}
  >
    <FileText className="size-4 text-muted-foreground flex-shrink-0" />
    <span className="text-sm truncate">
      <AttachmentPrimitive.Name />
    </span>
    <AttachmentPrimitive.Remove asChild>
      <button
        type="button"
        className="p-0.5 rounded hover:bg-muted flex-shrink-0"
        aria-label="Remove attachment"
      >
        <X className="size-3.5" />
      </button>
    </AttachmentPrimitive.Remove>
  </AttachmentPrimitive.Root>
);

/** Renders a file badge on sent user messages. */
export const UserMessageAttachment: FC = () => (
  <AttachmentPrimitive.Root
    className={cn(
      "inline-flex items-center gap-2 max-w-[250px]",
      "rounded-lg border border-border/50 bg-muted/30",
      "px-3 py-1.5",
    )}
  >
    <FileText className="size-3.5 text-muted-foreground flex-shrink-0" />
    <span className="text-xs truncate">
      <AttachmentPrimitive.Name />
    </span>
  </AttachmentPrimitive.Root>
);

/** Component map for MessagePrimitive.Attachments on user messages. */
export const userAttachmentComponents = {
  Document: UserMessageAttachment,
  Image: UserMessageAttachment,
  File: UserMessageAttachment,
};

/** Component map for ComposerPrimitive.Attachments in the composer. */
export const composerAttachmentComponents = {
  Document: ComposerAttachment,
  Image: ComposerAttachment,
  File: ComposerAttachment,
};
