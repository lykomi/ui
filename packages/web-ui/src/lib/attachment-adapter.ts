/**
 * File attachment adapter for assistant-ui.
 *
 * Reads files client-side as base64 and produces FileMessagePart content.
 * The AG-UI adapter converts these to BinaryInputContent for the protocol,
 * and the agent framework passes them to the Responses API as input_file
 * or input_image -- no separate upload endpoint needed.
 *
 * Supported: images (PNG, JPEG, WEBP, GIF), PDFs, DOCX
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

export class FileAttachmentAdapter implements AttachmentAdapter {
  accept =
    "image/*,application/pdf,.pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

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
    const base64 = await fileToBase64(attachment.file);

    return {
      ...attachment,
      status: { type: "complete" },
      content: [
        {
          type: "file" as const,
          data: base64,
          mimeType: attachment.contentType ?? "application/octet-stream",
          filename: attachment.name,
        },
      ],
    };
  }

  async remove(_attachment: Attachment): Promise<void> {
    // No-op -- files are read client-side, nothing to clean up
  }
}
