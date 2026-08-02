/**
 * File attachment adapter for assistant-ui.
 *
 * Reads attachments client-side as base64 and produces FileMessagePart content
 * for both images and documents. The AG-UI adapter turns those into `binary`
 * message parts (mimeType + data + filename), which the protocol carries
 * natively and model providers accept as file input.
 *
 * Documents used to degrade to a text stub (`[Attached file: x.pdf; ...]`) so
 * the starter wouldn't send payloads to providers lacking file input. That
 * silently discarded the bytes: the user attaches a PDF, the model receives
 * only its filename, and — having been told a file was attached — goes hunting
 * for a matching document in the backend and reports that it can't read it.
 * Losing user data silently is the worse failure, so documents are sent by
 * default. Pass `{ documentMode: "metadata" }` to restore the stub for agents
 * whose model genuinely can't accept file input.
 *
 * Note for hosts: the bytes ride along on every turn of the live conversation
 * and land in persisted history unless the backend elides them — see
 * lastspace's `_elide_inline_media` for the pattern.
 */

import type {
  AttachmentAdapter,
  PendingAttachment,
  CompleteAttachment,
  Attachment,
} from "@assistant-ui/react";

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB

/** Infer MIME type from extension when browser reports empty file.type (common for .docx) */
const EXTENSION_MIME: Record<string, string> = {
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

function resolveMimeType(file: File): string {
  if (file.type) return file.type;
  const ext = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MIME[ext] ?? "application/octet-stream";
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      // Strip the data URI prefix (e.g. "data:image/png;base64,"), keep raw base64
      resolve(result.split(",")[1]);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface FileAttachmentAdapterOptions {
  /**
   * How non-image documents (PDF, DOCX) are sent.
   *
   * - `"binary"` (default) — base64 bytes as a file part, so the model can
   *   actually read the document.
   * - `"metadata"` — filename/type/size as text only. For agents whose model
   *   cannot accept file input; the agent sees that a file was attached but
   *   never its contents.
   */
  documentMode?: "binary" | "metadata";
}

export class FileAttachmentAdapter implements AttachmentAdapter {
  accept =
    "image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  private readonly documentMode: "binary" | "metadata";

  constructor(options: FileAttachmentAdapterOptions = {}) {
    this.documentMode = options.documentMode ?? "binary";
  }

  async add({ file }: { file: File }): Promise<PendingAttachment> {
    if (file.size > MAX_FILE_SIZE) {
      throw new Error(`File too large (${Math.round(file.size / 1024 / 1024)} MB). Max 20 MB.`);
    }

    const mimeType = resolveMimeType(file);

    return {
      id: crypto.randomUUID(),
      type: mimeType.startsWith("image/") ? "image" : "document",
      name: file.name,
      contentType: mimeType,
      file,
      status: { type: "requires-action", reason: "composer-send" },
    };
  }

  async send(attachment: PendingAttachment): Promise<CompleteAttachment> {
    const mimeType = attachment.contentType ?? "application/octet-stream";

    if (!mimeType.startsWith("image/") && this.documentMode === "metadata") {
      return {
        ...attachment,
        status: { type: "complete" },
        content: [
          {
            type: "text" as const,
            text:
              `[Attached file: ${attachment.name}` +
              `; type: ${mimeType}` +
              `; size: ${formatFileSize(attachment.file.size)}` +
              `. Contents were not sent — this agent is configured for ` +
              `metadata-only attachments, so tell the user you cannot read it.]`,
          },
        ],
      };
    }

    const base64 = await fileToBase64(attachment.file);

    return {
      ...attachment,
      status: { type: "complete" },
      content: [
        {
          type: "file" as const,
          data: base64,
          mimeType,
          filename: attachment.name,
        },
      ],
    };
  }

  async remove(_attachment: Attachment): Promise<void> {
    // No-op -- files are read client-side, nothing to clean up
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${Math.round((bytes / 1024 / 1024) * 10) / 10} MB`;
}
