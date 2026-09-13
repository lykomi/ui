/** Request-time projection of the focused surface, not a persistent page pin. */
export function collectFocusContext() {
  if (typeof document === "undefined") return null;
  const candidates = Array.from(document.querySelectorAll<HTMLElement>("[data-focused]"));
  const frame = candidates
    .reverse()
    .find((node) => !node.closest('[hidden], [inert], [aria-hidden="true"]'));
  if (!frame) return null;
  const isDocument = frame.dataset.focusKind === "document";
  const block = isDocument ? null : frame.querySelector<HTMLElement>("[data-block-id]");
  const table = isDocument ? null : frame.querySelector("table");
  let remaining = 8000;
  let truncated = false;
  const text = (node: Element) => {
    const raw = (node.textContent || "").replace(/\s+/g, " ").trim();
    const value = raw.slice(0, Math.min(remaining, 300));
    remaining -= value.length;
    if (value.length < raw.length) truncated = true;
    return value;
  };
  const headers = table
    ? Array.from(table.querySelectorAll('thead th:not([aria-hidden="true"])'))
        .slice(0, 12)
        .map(text)
    : [];
  const allRows = table ? Array.from(table.querySelectorAll("tbody tr")) : [];
  const rows: string[][] = [];
  for (const row of allRows.slice(0, 40)) {
    if (!remaining) {
      truncated = true;
      break;
    }
    rows.push(
      Array.from(row.querySelectorAll('td:not([aria-hidden="true"])')).slice(0, 12).map(text),
    );
  }
  if (allRows.length > rows.length) truncated = true;
  const source = frame
    .closest('[role="dialog"]')
    ?.querySelector<HTMLElement>("[data-focus-source-title]");
  return {
    title: frame.dataset.focusTitle || frame.getAttribute("aria-label") || "Focused content",
    kind: table ? "table" : "document",
    entityId: frame.dataset.entityId || block?.dataset.entityId || null,
    blockId: block?.dataset.blockId || null,
    ...(isDocument
      ? {
          content: (
            frame.querySelector("[data-document-prose]")?.textContent ||
            frame.textContent ||
            ""
          )
            .trim()
            .slice(0, 8000),
        }
      : {}),
    ...(table ? { table: { headers, rows, renderedRowCount: allRows.length, truncated } } : {}),
    ...(source
      ? {
          citationSource: {
            title: source.dataset.focusSourceTitle,
            entityId: source.dataset.focusSourceEntity,
          },
        }
      : {}),
  };
}
