import { useEffect, useRef, type RefObject } from "react";

/**
 * A horizontal scroller becomes the sticky containing block for its own thead.
 * Mirror the header outside that scroller so the page can keep column labels in
 * view. The real thead remains the single semantic and interactive header;
 * this copy is visual only and follows the scroller's horizontal position.
 */
export function DataTablePageHeader({
  root,
  scroller,
  header,
  offset,
}: {
  root: RefObject<HTMLDivElement | null>;
  scroller: RefObject<HTMLDivElement | null>;
  header: RefObject<HTMLTableSectionElement | null>;
  offset: number | string;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const mirrorRef = useRef<HTMLTableElement | null>(null);

  // Header content, widths, sorting state and visibility are already rendered
  // by DataTable. Copy that DOM after each render instead of maintaining a
  // second set of column/header controls with subtly different behavior.
  useEffect(() => {
    const host = hostRef.current;
    const mirror = mirrorRef.current;
    const source = header.current;
    const element = scroller.current;
    const boundary = root.current;
    if (!host || !mirror || !source || !element || !boundary) return;

    const sourceTable = source.closest("table");
    const columns = sourceTable?.querySelector("colgroup")?.cloneNode(true);
    const clonedHeader = source.cloneNode(true) as HTMLTableSectionElement;
    clonedHeader.classList.remove("sticky", "top-0", "z-10");
    clonedHeader.style.position = "static";
    clonedHeader.style.top = "auto";
    clonedHeader.querySelectorAll("[id]").forEach((node) => node.removeAttribute("id"));
    mirror.replaceChildren(...(columns ? [columns, clonedHeader] : [clonedHeader]));
    mirror.style.width =
      sourceTable?.style.width || `${sourceTable?.getBoundingClientRect().width ?? 0}px`;
    const pinned = [...clonedHeader.querySelectorAll<HTMLElement>('[data-pinned="header"]')];
    // The mirror has no horizontal scrollport of its own. Disable native
    // sticky positioning here and counter-translate the copied cells exactly
    // once; otherwise their CSS stickiness can add a second offset.
    for (const cell of pinned) {
      cell.style.position = "relative";
      cell.style.left = "0px";
    }

    let frame = 0;
    const read = () => {
      frame = 0;
      const height = Math.ceil(source.getBoundingClientRect().height) || 40;
      host.style.height = `${height}px`;
      host.style.marginBottom = `-${height}px`;
      const top = Number.parseFloat(getComputedStyle(host).top) || 0;
      const sourceBox = source.getBoundingClientRect();
      const rootBox = boundary.getBoundingClientRect();
      host.style.visibility =
        sourceBox.bottom <= top && rootBox.bottom > top + height ? "visible" : "hidden";
      const left = element.scrollLeft;
      mirror.style.transform = `translate3d(${-left}px, 0, 0)`;
      for (const cell of pinned) cell.style.transform = `translate3d(${left}px, 0, 0)`;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(read);
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    observer?.observe(source);
    observer?.observe(element);
    observer?.observe(boundary);
    element.addEventListener("scroll", schedule, { passive: true });
    // Capture reaches either the window or the nearest page/panel scroll owner.
    window.addEventListener("scroll", schedule, true);
    schedule();
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer?.disconnect();
      element.removeEventListener("scroll", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  });

  return (
    <div
      ref={hostRef}
      data-page-table-header=""
      aria-hidden="true"
      inert
      style={{
        position: "sticky",
        top: offset,
        zIndex: 11,
        height: 40,
        marginBottom: -40,
        visibility: "hidden",
        pointerEvents: "none",
        overflowAnchor: "none",
      }}
    >
      <div className="w-full overflow-hidden border-b border-border/45 bg-card shadow-sm">
        <table
          ref={mirrorRef}
          className="caption-bottom text-sm"
          style={{ tableLayout: "fixed" }}
        />
      </div>
    </div>
  );
}
