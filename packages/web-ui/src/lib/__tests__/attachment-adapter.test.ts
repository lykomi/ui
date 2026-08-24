import { describe, expect, it } from "vitest";
import { FileAttachmentAdapter } from "../attachment-adapter";

const adapter = new FileAttachmentAdapter();

describe("FileAttachmentAdapter.add", () => {
  it("uses browser-supplied MIME type", async () => {
    const file = new File(["x"], "photo.png", { type: "image/png" });
    const result = await adapter.add({ file });
    expect(result.contentType).toBe("image/png");
    expect(result.type).toBe("image");
  });

  it("resolves MIME from extension when browser type is empty", async () => {
    const file = new File(["x"], "report.docx", { type: "" });
    const result = await adapter.add({ file });
    expect(result.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(result.type).toBe("document");
  });

  it("falls back to application/octet-stream for unknown extensions", async () => {
    const file = new File(["x"], "data.xyz", { type: "" });
    const result = await adapter.add({ file });
    expect(result.contentType).toBe("application/octet-stream");
  });

  it("throws for files exceeding 20 MB", async () => {
    const big = new File(["x"], "big.png", { type: "image/png" });
    Object.defineProperty(big, "size", { value: 20 * 1024 * 1024 + 1 });
    await expect(adapter.add({ file: big })).rejects.toThrow("File too large");
  });

  it("accepts a file at exactly 20 MB", async () => {
    const exact = new File(["x"], "ok.png", { type: "image/png" });
    Object.defineProperty(exact, "size", { value: 20 * 1024 * 1024 });
    await expect(adapter.add({ file: exact })).resolves.toBeDefined();
  });

  it("classifies images vs documents correctly", async () => {
    const image = new File(["x"], "pic.jpg", { type: "image/jpeg" });
    const pdf = new File(["x"], "doc.pdf", { type: "application/pdf" });

    expect((await adapter.add({ file: image })).type).toBe("image");
    expect((await adapter.add({ file: pdf })).type).toBe("document");
  });
});

describe("FileAttachmentAdapter.send", () => {
  it("sends documents as base64 file content so the model can read them", async () => {
    const file = new File(["hello"], "brief.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const pending = await adapter.add({ file });
    const complete = await adapter.send(pending);

    expect(complete.content).toEqual([
      {
        type: "file",
        data: "aGVsbG8=",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        filename: "brief.docx",
      },
    ]);
  });

  it("degrades documents to text metadata when documentMode is 'metadata'", async () => {
    const metadataAdapter = new FileAttachmentAdapter({ documentMode: "metadata" });
    const file = new File(["hello"], "brief.pdf", { type: "application/pdf" });
    const pending = await metadataAdapter.add({ file });
    const complete = await metadataAdapter.send(pending);

    const part = complete.content[0] as { type: string; text: string };
    expect(part.type).toBe("text");
    expect(part.text).toContain("[Attached file: brief.pdf");
    expect(part.text).toContain("Contents were not sent");
  });

  it("sends images as base64 file content", async () => {
    const file = new File(["hello"], "photo.png", { type: "image/png" });
    const pending = await adapter.add({ file });
    const complete = await adapter.send(pending);

    expect(complete.content).toEqual([
      {
        type: "file",
        data: "aGVsbG8=",
        mimeType: "image/png",
        filename: "photo.png",
      },
    ]);
  });
});
