import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";

/** One continuous contour connects the selected row to the chat boundary. */
export function SelectionBridge({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [anchor, setAnchor] = useState<{
    top: number;
    height: number;
    left: number;
    width: number;
    navHeight: number;
    surfaceWidth: number;
    radius: number;
  } | null>(null);
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const bounds = node.getBoundingClientRect();
        const row = node.querySelector<HTMLElement>(
          '[data-sidebar-surface="desktop"] [data-active-nav-row="true"]',
        );
        const rect = row?.getBoundingClientRect();
        const scroll = row?.closest("nav")?.getBoundingClientRect();
        const visible =
          rect &&
          bounds.width > 80 &&
          rect.height > 0 &&
          (!scroll || (rect.top >= scroll.top && rect.bottom <= scroll.bottom));
        setAnchor(
          visible
            ? {
                top: rect.top - bounds.top,
                height: rect.height,
                left: rect.left - bounds.left + 0.5,
                width: bounds.width,
                navHeight: bounds.height,
                surfaceWidth: node.nextElementSibling?.getBoundingClientRect().width ?? 0,
                radius: Math.min(
                  16,
                  rect.height / 2,
                  Number.parseFloat(getComputedStyle(row!).borderTopLeftRadius) || 0,
                ),
              }
            : null,
        );
      });
    };
    const resize = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const mutation = typeof MutationObserver === "undefined" ? null : new MutationObserver(measure);
    resize?.observe(node);
    if (node.nextElementSibling) resize?.observe(node.nextElementSibling);
    if (node.parentElement) resize?.observe(node.parentElement);
    mutation?.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "style", "data-active-nav-row"],
    });
    mutation?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style"],
    });
    node.addEventListener("scroll", measure, true);
    measure();
    return () => {
      cancelAnimationFrame(frame);
      resize?.disconnect();
      mutation?.disconnect();
      node.removeEventListener("scroll", measure, true);
    };
  }, []);
  return (
    <div
      ref={root}
      data-connected-navigation={anchor ? "true" : undefined}
      className="relative flex shrink-0"
      style={
        {
          "--connected-row-radius": anchor ? `${anchor.radius}px` : undefined,
        } as CSSProperties
      }
    >
      <style>{`
      [data-connected-navigation="true"] + [data-workbench-surface]::after { display: none; }
      .workbench-preview [data-sidebar-surface="desktop"] nav { padding-right: 16px; }
      .workbench-preview [data-sidebar-surface="desktop"] { border-right-color: transparent; }
      [data-connected-navigation="true"] [data-sidebar-surface="desktop"] [data-active-nav-row="true"] {
        /* The selected inset keeps the navigation palette visible around it.
           Painting the content background here creates a light band when a
           dark sidebar sits beside a light workbench. */
        background: transparent;
        border-color: transparent;
        border-top-right-radius: 0;
        border-bottom-right-radius: 0;
      }
      [data-connected-navigation="true"] [data-sidebar-surface="desktop"] [data-active-nav-row="true"]::after {
        content: "";
        position: absolute;
        z-index: 0;
        inset-block: 0;
        left: 100%;
        width: 16px;
        background: var(--background);
      }
      [data-connected-navigation="true"] [data-sidebar-surface="desktop"] [data-active-nav-row="true"]::before {
        content: "";
        position: absolute;
        z-index: 1;
        inset-block: 5px;
        left: 5px;
        right: -10px;
        border-radius: max(0px, calc(var(--connected-row-radius) - 5px));
        background: var(--sidebar-selected);
        pointer-events: none;
      }
      [data-connected-navigation="true"] [data-sidebar-surface="desktop"] [data-active-nav-row="true"] > :not([data-nav-twisty-cell]) {
        z-index: 2;
      }
    `}</style>
      {children}
      {anchor && (
        <svg
          aria-hidden="true"
          className="pointer-events-none absolute z-20"
          style={{ inset: 0, width: anchor.width + anchor.surfaceWidth, height: anchor.navHeight }}
          viewBox={`0 0 ${anchor.width + anchor.surfaceWidth} ${anchor.navHeight}`}
        >
          <path
            fill="none"
            stroke="var(--sidebar-ring)"
            strokeOpacity={0.6}
            strokeWidth={1}
            d={`M ${anchor.width + anchor.radius},0.5
          H ${anchor.width + anchor.surfaceWidth - anchor.radius}
          Q ${anchor.width + anchor.surfaceWidth - 0.5},0.5 ${anchor.width + anchor.surfaceWidth - 0.5},${anchor.radius}
          V ${anchor.navHeight - anchor.radius}
          Q ${anchor.width + anchor.surfaceWidth - 0.5},${anchor.navHeight - 0.5} ${anchor.width + anchor.surfaceWidth - anchor.radius},${anchor.navHeight - 0.5}
          H ${anchor.width + anchor.radius}
          Q ${anchor.width - 0.5},${anchor.navHeight - 0.5} ${anchor.width - 0.5},${anchor.navHeight - anchor.radius}
          V ${anchor.top + anchor.height + anchor.radius}
          Q ${anchor.width - 0.5},${anchor.top + anchor.height - 0.5} ${anchor.width - anchor.radius},${anchor.top + anchor.height - 0.5}
          H ${anchor.left + anchor.radius}
          Q ${anchor.left},${anchor.top + anchor.height - 0.5} ${anchor.left},${anchor.top + anchor.height - anchor.radius}
          V ${anchor.top + anchor.radius}
          Q ${anchor.left},${anchor.top + 0.5} ${anchor.left + anchor.radius},${anchor.top + 0.5}
          H ${anchor.width - anchor.radius}
          Q ${anchor.width - 0.5},${anchor.top + 0.5} ${anchor.width - 0.5},${anchor.top - anchor.radius}
          V ${anchor.radius} Q ${anchor.width - 0.5},0.5 ${anchor.width + anchor.radius},0.5 Z`}
          />
        </svg>
      )}
    </div>
  );
}
