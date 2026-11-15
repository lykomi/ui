import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { OperationProgress } from "./operation-progress.tsx";

describe("OperationProgress", () => {
  it.each([
    ["running", "In progress"],
    ["pending", "Pending"],
    ["success", "Completed"],
    ["warning", "Needs attention"],
    ["error", "Failed"],
    ["cancelled", "Cancelled"],
  ] as const)(
    "announces %s even when the title and description stay unchanged",
    (status, label) => {
      const html = renderToStaticMarkup(
        <OperationProgress title="Upload" description="Project documents" status={status} />,
      );
      expect(html).toMatch(new RegExp(`role="status"[^]*?<span class="sr-only">${label}</span>`));
    },
  );
  it("does not announce a fictional percentage for unknown work", () => {
    const html = renderToStaticMarkup(
      <OperationProgress title="Preparing documents" status="running" progress={null} />,
    );
    expect(html).toContain('role="progressbar"');
    expect(html).not.toContain("aria-valuenow");
    expect(html).toContain("operation-progress-indeterminate");
  });
  it.each([
    [125, 100],
    [-10, 0],
    [37.5, 37.5],
  ])("keeps measured progress %s within accessible bounds", (value, expected) => {
    const html = renderToStaticMarkup(
      <OperationProgress title="Import" status="running" progress={value} />,
    );
    expect(html).toContain(`aria-valuenow="${expected}"`);
    expect(html).not.toContain("operation-progress-indeterminate");
  });
  it("treats a non-finite measurement as unknown", () => {
    const html = renderToStaticMarkup(
      <OperationProgress title="Import" status="running" progress={NaN} />,
    );
    expect(html).not.toContain("aria-valuenow");
    expect(html).toContain("operation-progress-indeterminate");
  });
  it.each(["pending", "success", "warning", "error", "cancelled"] as const)(
    "does not animate a %s operation",
    (status) => {
      const html = renderToStaticMarkup(
        <OperationProgress title="Import" status={status} progress={null} />,
      );
      expect(html).not.toContain("animate-spin");
      expect(html).not.toContain("operation-progress-indeterminate");
    },
  );
  it("keeps recovery actions available without claiming the job runs in the background", () => {
    const html = renderToStaticMarkup(
      <OperationProgress
        title="Upload failed"
        status="error"
        actions={<button>Retry upload</button>}
      />,
    );
    expect(html).toContain("Retry upload");
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("background");
  });
});
