import {
  type ReactNode,
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { NavLink, useLocation, useNavigate } from "react-router";
import {
  Ellipsis,
  Layers,
  PanelLeft,
  PanelLeftOpen,
  SquarePen,
  ChevronDown,
  ChevronRight,
  GripVertical,
  Plus,
  Upload,
  ChevronLeft,
} from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import {
  useSidebarStore,
  RAIL_WIDTH,
  SIDEBAR_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "../lib/sidebar-store.ts";
import { useToolPanelStore } from "../lib/tool-panel-store.ts";
import { useNewConversation } from "../lib/use-new-conversation.ts";
import { useNavStore } from "../lib/nav-store.ts";
import { useAppStore } from "../lib/app-store.ts";
import type { NavGroup, NavItem, NavItemDnd } from "../lib/nav-config.ts";
import {
  getContainerDropZoneLabel,
  hasAnyDropTarget,
  hasExternalFilesData,
} from "../lib/nav-dnd.ts";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";
import { Button } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";
import { AppBrand } from "./app-brand.tsx";

const ACTIVE_NAV_ROW_CLASS =
  "border border-transparent bg-sidebar-selected text-sidebar-selected-foreground shadow-none";
const ACTIVE_NAV_TEXT_CLASS = "font-semibold text-sidebar-selected-foreground";
const ACTIVE_NAV_ICON_CLASS = "text-sidebar-selected-foreground";
const ACTIVE_NAV_BADGE_CLASS =
  "border border-sidebar-border bg-background/60 text-sidebar-foreground";
// Indent ladder for the nav tree, indexed by depth (0 = top-level item).
//
// ONE array of PAIRS rather than two parallel arrays, because the two
// numbers are not independent: ``body`` is always ``column`` plus the 20px
// disclosure cluster (16px cell + 4px gap). Split into separate lists they
// drift apart, and the tree stops looking like a tree.
//
// ``column`` is a LEFT OFFSET, not padding, because the twisty is absolutely
// positioned: it floats over the row body's own left padding instead of
// occupying a flex cell. That is what keeps the entire row — indent strip
// and disclosure cell included — a live click target for navigation, while
// the branch chevron still catches its own clicks on top. Laying the twisty
// out in flow instead makes every pixel left of the icon dead.
//
// Depth 0 sits at 12px so the twisty shares a column with the group-header
// chevron; every further level adds 8px, which keeps deep trees readable
// inside a ~260px sidebar.
const NAV_DEPTH_OFFSETS = [
  { column: "left-3", body: "pl-8" },
  { column: "left-5", body: "pl-10" },
  { column: "left-7", body: "pl-12" },
  { column: "left-9", body: "pl-14" },
  { column: "left-11", body: "pl-16" },
  { column: "left-13", body: "pl-18" },
] as const;
// Fixed-width cell every nav row leads with, holding either a chevron
// (branch) or a dot (leaf). Same width as ``SIDEBAR_ITEM_ICON_CLASS`` so
// the disclosure column and the group-header chevron share one x.
const NAV_TWISTY_CLASS = "absolute inset-y-0 flex w-4 items-center justify-center";
// The chevron is a real control, so it needs a real touch target: it draws
// at ``size-3.5`` but CLICKS in 24px (WCAG 2.2 target-size minimum). It can
// simply overflow the 16px cell — the cell is absolutely positioned, so
// nothing downstream moves. The leaf dot needs no target at all; it is
// decorative and passes its clicks through to the row.
const NAV_TWISTY_HIT_CLASS = "size-6 shrink-0";
// Hover-reveal clearance for the right-hand actions menu. That control is a
// 28px button inside ``right-1`` + ``px-1`` (4 + 4 + 28 + 4 = 40px), so 44px
// keeps the label from butting straight into it. Applied ONLY to rows that
// actually have an actions menu — on a row without one the reserved padding
// buys nothing and just re-truncates the label on every hover.
const NAV_ROW_ACTIONS_CLEARANCE = "group-hover:pr-11 group-focus-within:pr-11";

// Shared icon-column geometry. The group-header chevron and the
// per-row disclosure cell (``NavTwisty``) are the SAME width, and the
// header wrapper below pads to the same x as
// ``NAV_DEPTH_OFFSETS[0].column`` — the depth-0 rung the rows use — so
// every chevron in the sidebar (section headers and tree rows
// alike) stacks on one vertical line. That single line is what makes
// the tree scan as a tree; when the columns drift the sidebar looks
// ragged (an earlier regression had the header chevron defaulting to
// ``size-6`` = 24px). Item labels now sit one cell further right than
// group labels, because item rows carry a twisty AND an icon while
// group headers carry only the chevron.
const SIDEBAR_ITEM_ICON_CLASS = "size-4 shrink-0";
const SIDEBAR_ITEM_GAP_CLASS = "gap-2";
// Outer padding for the group-header wrapper. The group header lays its
// chevron out in normal flow, so it needs the depth-0 column expressed as
// a PADDING where rows express it as an offset — the same number, two
// spellings, which is exactly how columns silently desync when the indent
// ladder is retuned. The group-header alignment test in
// ``sidebar.test.tsx`` parses both numbers back out and fails if they
// ever diverge.
// Vertical is asymmetric: ``pt-4`` above gives breathing room between
// sections, ``pb-0`` below bonds the header to its first child — the
// ChatGPT / Linear / Notion "header sits on its children" pattern.
// Symmetric ``py-2`` made the header float midway between sections
// instead of belonging to the group below it.
// Vertical rhythm: rows are tight (depth-0 ``py-1.5``, nested ``py-1``) and
// sections keep their ``pt-4`` gap, so what separates is the group, not
// every row; the header label sits a step brighter than the rows' muted
// text so the section reads above its items (user's test: rows were
// airy and headers lighter than their children).
const SIDEBAR_GROUP_HEADER_PADDING = "pt-4 pb-0";
// The header's own box: the hover surface spans the row exactly like an
// item row's does — same radius, same transparent border (part of the box
// model that decides where the padding box starts: without it the chevron
// lands 1px left of every row's disclosure cell) and the same horizontal
// inset, so header and rows highlight on one outline (user's test: the
// narrower inset box read as misaligned and cramped).
const SIDEBAR_GROUP_HEADER_BOX = "rounded-xl border border-transparent pl-3 pr-3";
// Typography for the group-header LABEL text (CHATS / WORKSPACES /
// ADMIN / …). Stays at ``text-xs`` (12px) — same size as before —
// but bumps weight from ``font-medium`` to ``font-semibold``. The
// extra weight gives section headers the structural presence they
// need to feel like section dividers without spending vertical
// space; combined with ``uppercase tracking-wider`` it's the
// ChatGPT / Linear / Notion small-caps section-label rhythm.
// Bumping size AND weight together stacked too much visual mass
// against the already-wide uppercase tracking — felt shouty.
const SIDEBAR_GROUP_HEADER_LABEL_CLASS = "text-xs font-semibold uppercase tracking-wider";

type NavStatusDot = NonNullable<NavItem["statusDot"]>;
type NavStatusIcon = NonNullable<NavItem["statusIcon"]>;

/** Body padding for a flat row with nothing to indent under: a row in a
 *  group without a visible header (New Thread, Activity) sits with the
 *  sidebar's other flat chrome, and a focused group's heading sits under
 *  its header's chevron. Flat rows UNDER a visible header indent like
 *  depth-0 tree rows instead, so their icon sits under the header label
 *  and the group reads as a group (user's test: Build's rows sat level
 *  with their header). */
const NAV_FLAT_BODY_CLASS = "pl-3";

function getNavDepthOffsets(depth: number) {
  return NAV_DEPTH_OFFSETS[depth] ?? NAV_DEPTH_OFFSETS[NAV_DEPTH_OFFSETS.length - 1];
}

function scrollNavRowIntoView(nav: HTMLElement, row: HTMLElement) {
  const navRect = nav.getBoundingClientRect();
  const rowRect = row.getBoundingClientRect();
  if (rowRect.top < navRect.top || rowRect.bottom > navRect.bottom) {
    const rowCenter = rowRect.top - navRect.top + rowRect.height / 2;
    nav.scrollTop += rowCenter - nav.clientHeight / 2;
  }
}

export const _scrollNavRowIntoViewForTest = scrollNavRowIntoView;

function useActiveNavRowScroll<T extends HTMLElement>(isActive: boolean) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!isActive) return;
    const scroll = () => {
      const element = ref.current;
      if (!element) return;
      const rect = element.getBoundingClientRect();
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const isOnScreen =
        rect.width > 0 && rect.height > 0 && rect.right > 0 && rect.left < viewportWidth;
      if (!isOnScreen) return;
      const nav = element.closest<HTMLElement>("nav");
      if (!nav) return;
      scrollNavRowIntoView(nav, element);
    };

    const frame = window.requestAnimationFrame(scroll);
    const retry = window.setTimeout(scroll, 120);
    const finalRetry = window.setTimeout(scroll, 400);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      window.clearTimeout(finalRetry);
    };
  }, [isActive]);

  return ref;
}

function useScrollActiveNavRow(currentPage: string, navConfig: NavGroup[], collapsed: boolean) {
  useEffect(() => {
    if (collapsed) return;
    const scroll = () => {
      const viewportWidth = window.innerWidth || document.documentElement.clientWidth;
      const navs = Array.from(document.querySelectorAll<HTMLElement>("nav")).filter((nav) => {
        const rect = nav.getBoundingClientRect();
        return rect.width > 0 && rect.right > 0 && rect.left < viewportWidth;
      });
      for (const nav of navs) {
        const row = nav.querySelector<HTMLElement>('[data-active-nav-row="true"]');
        if (!row) continue;
        scrollNavRowIntoView(nav, row);
        break;
      }
    };

    const frame = window.requestAnimationFrame(scroll);
    const retry = window.setTimeout(scroll, 120);
    const finalRetry = window.setTimeout(scroll, 400);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(retry);
      window.clearTimeout(finalRetry);
    };
  }, [collapsed, currentPage, navConfig]);
}

function statusDotColor(tone: NavStatusDot["tone"]) {
  switch (tone) {
    case "low-impact":
      return "var(--impact-low, currentColor)";
    case "medium-impact":
      return "var(--impact-medium, currentColor)";
    case "high-impact":
      return "var(--impact-high, currentColor)";
    case "pending":
      return "var(--impact-unknown, currentColor)";
    case "info":
      return "var(--primary, currentColor)";
    case "neutral":
    default:
      return "currentColor";
  }
}

function NavStatusDot({ statusDot }: { statusDot?: NavStatusDot }) {
  if (!statusDot) return null;
  // Both "pending" (impact in progress) and "info" (live / active —
  // e.g. the currently-resumed chat conversation) pulse so the eye is
  // drawn to "something is happening / you are here right now".
  // Other tones render static.
  const pulse = statusDot.tone === "pending" || statusDot.tone === "info";
  return (
    <span
      data-nav-status-dot
      data-nav-status-tone={statusDot.tone}
      aria-label={statusDot.label}
      title={statusDot.label}
      className={cn("size-1.5 shrink-0 rounded-full opacity-90", pulse && "animate-pulse")}
      style={{ backgroundColor: statusDotColor(statusDot.tone) }}
    />
  );
}

function statusIconClass(tone: NavStatusIcon["tone"]) {
  switch (tone) {
    case "warning":
      return "text-warning";
    case "danger":
      return "text-destructive";
    case "info":
      return "text-primary";
    case "neutral":
    default:
      return "text-sidebar-icon";
  }
}

function NavStatusIcon({ statusIcon }: { statusIcon?: NavStatusIcon }) {
  if (!statusIcon) return null;
  const Icon = statusIcon.icon;
  // Wrap in a ``<span>`` so the browser tooltip (``title``) and the
  // screen-reader announcement (``aria-label``) attach to a real DOM
  // node — lucide-react's icon types don't accept ``title`` as a
  // prop. Kept small (size-3) so the icon doesn't compete with the
  // entity icon on the left of the row.
  return (
    <span
      role="img"
      aria-label={statusIcon.label}
      title={statusIcon.label}
      className="inline-flex shrink-0"
    >
      <Icon
        aria-hidden="true"
        className={cn("size-3 shrink-0", statusIconClass(statusIcon.tone))}
      />
    </span>
  );
}

// --- Generic drag-and-drop via NavItem.dnd ---

/** Shared drag-and-drop props derived from NavItem.dnd (feature-provided). */
function useNavItemDnd(dnd?: NavItemDnd) {
  const [isDragOver, setIsDragOver] = useState(false);
  // Tracked separately from ``isDragOver`` so consumers can render a
  // distinct file-drop affordance (dashed primary ring + Upload icon)
  // instead of the subtle entity-move ring. Without the split, a user
  // dragging files from the desktop sees the same hover state as a
  // user dragging another tree node — they can't tell the container
  // accepts the drop.
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const dragCounter = useRef(0);

  const isDraggable = dnd?.canDrag() ?? false;
  const isDropTarget = dnd?.canDrop() ?? false;
  const isFileDropTarget = dnd?.canDropFiles?.() ?? false;
  const dndType = dnd?.type;

  const hasExternalFiles = useCallback(
    (e: React.DragEvent) => hasExternalFilesData(e.dataTransfer),
    [],
  );

  const hasMatchingDragData = useCallback(
    (e: React.DragEvent) =>
      Boolean(
        (isDropTarget && dndType && e.dataTransfer.types.includes(dndType)) ||
        (isFileDropTarget && hasExternalFiles(e)),
      ),
    [isDropTarget, dndType, isFileDropTarget, hasExternalFiles],
  );

  const onDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!dnd) return;
      const data = dnd.getData();
      if (!data) return;
      e.dataTransfer.setData(dnd.type, data);
      e.dataTransfer.effectAllowed = "move";
    },
    [dnd],
  );

  const onDragEnter = useCallback(
    (e: React.DragEvent) => {
      if (!hasMatchingDragData(e)) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current++;
      setIsDragOver(true);
      if (isFileDropTarget && hasExternalFiles(e)) {
        setIsFileDragOver(true);
      }
    },
    [hasMatchingDragData, isFileDropTarget, hasExternalFiles],
  );

  // ``dragenter`` / ``dragleave`` fire on every parent-to-child crossing
  // inside the drop target (entering the inner button, then a span, etc.).
  // The counter pattern only flips ``isDragOver`` back to false when the
  // cursor truly leaves the OUTER element. There's a transient between
  // crossings where leave fires before the matching enter — React 18
  // auto-batches setState calls within a single task so the user doesn't
  // see a flicker. If you ever observe one, switch to a relatedTarget
  // ``contains()`` check instead of the counter.
  const onDragLeave = useCallback(
    (e: React.DragEvent) => {
      if (!hasAnyDropTarget(isDropTarget, isFileDropTarget)) return;
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current <= 0) {
        dragCounter.current = 0;
        setIsDragOver(false);
        setIsFileDragOver(false);
      }
    },
    [isDropTarget, isFileDropTarget],
  );

  const onDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!hasMatchingDragData(e)) return;
      e.preventDefault();
      e.stopPropagation();
      e.dataTransfer.dropEffect = hasExternalFiles(e) ? "copy" : "move";
    },
    [hasMatchingDragData, hasExternalFiles],
  );

  // Capture-phase handlers run BEFORE the bubble-phase ``onDragEnter`` /
  // ``onDragOver`` on the same node. They MUST NOT call
  // ``e.stopPropagation()``: in React's synthetic event system, stopping
  // propagation in the capture phase short-circuits the dispatch — neither
  // the bubble-phase handler on the same node (which actually mutates
  // ``isDragOver`` / ``isFileDragOver``) nor any ancestor handler runs.
  //
  // We keep ``preventDefault()`` here because some browsers (Chrome) need
  // it on ``dragenter``/``dragover`` to mark the element as droppable —
  // doing it in the capture phase makes the visual cue stable while the
  // user is still hovering inside descendant elements (button, span,
  // action controls).
  const onDragEnterCapture = useCallback(
    (e: React.DragEvent) => {
      if (!hasMatchingDragData(e)) return;
      e.preventDefault();
    },
    [hasMatchingDragData],
  );

  const onDragOverCapture = useCallback(
    (e: React.DragEvent) => {
      if (!hasMatchingDragData(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = hasExternalFiles(e) ? "copy" : "move";
    },
    [hasMatchingDragData, hasExternalFiles],
  );

  const onDrop = useCallback(
    async (e: React.DragEvent) => {
      if (!dnd) return;
      const files = Array.from(e.dataTransfer.files ?? []);
      const hasFiles = isFileDropTarget && files.length > 0 && dnd.onFileDrop;
      const draggedData = isDropTarget && dndType ? e.dataTransfer.getData(dndType) : "";
      const hasEntityDrop = Boolean(isDropTarget && draggedData);
      if (!hasFiles && !hasEntityDrop) return;
      e.preventDefault();
      e.stopPropagation();
      dragCounter.current = 0;
      setIsDragOver(false);
      setIsFileDragOver(false);
      if (hasFiles) {
        await dnd.onFileDrop!(files);
        return;
      }
      await dnd.onDrop(draggedData);
    },
    [isDropTarget, isFileDropTarget, dnd, dndType],
  );

  return {
    isDragOver,
    isFileDragOver,
    draggableProps: isDraggable ? { draggable: true, onDragStart } : {},
    dropTargetProps:
      isDropTarget || isFileDropTarget
        ? {
            onDragEnterCapture,
            onDragOverCapture,
            onDragEnter,
            onDragLeave,
            onDragOver,
            onDrop,
          }
        : {},
  };
}

/** Drop zone rendered inside expanded containers so users can move items back to the container root. */
function ContainerDropZone({ dnd }: { dnd: NavItemDnd }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFileDragOver, setIsFileDragOver] = useState(false);
  const dragCounter = useRef(0);
  const acceptsFiles = dnd.canDropFiles?.() ?? false;
  const acceptsEntities = dnd.canDrop();

  const hasExternalFiles = (e: React.DragEvent) => hasExternalFilesData(e.dataTransfer);

  const hasMatchingDragData = (e: React.DragEvent) =>
    Boolean(
      (acceptsEntities && e.dataTransfer.types.includes(dnd.type)) ||
      (acceptsFiles && hasExternalFiles(e)),
    );

  return (
    <div
      onDragEnter={(e) => {
        if (!hasMatchingDragData(e)) return;
        e.preventDefault();
        dragCounter.current++;
        setIsFileDragOver(hasExternalFiles(e));
        setIsDragOver(true);
      }}
      onDragLeave={() => {
        dragCounter.current--;
        if (dragCounter.current <= 0) {
          dragCounter.current = 0;
          setIsFileDragOver(false);
          setIsDragOver(false);
        }
      }}
      onDragOver={(e) => {
        if (!hasMatchingDragData(e)) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = hasExternalFiles(e) ? "copy" : "move";
      }}
      onDrop={async (e) => {
        const files = Array.from(e.dataTransfer.files ?? []);
        const draggedData = acceptsEntities ? e.dataTransfer.getData(dnd.type) : "";
        const hasFiles = acceptsFiles && files.length > 0 && dnd.onFileDrop;
        const hasEntityDrop = Boolean(acceptsEntities && draggedData);
        if (!hasFiles && !hasEntityDrop) return;
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current = 0;
        setIsFileDragOver(false);
        setIsDragOver(false);
        if (hasFiles) {
          await dnd.onFileDrop!(files);
          return;
        }
        await dnd.onDrop(draggedData);
      }}
      className={cn(
        "relative mx-2 rounded-md overflow-hidden",
        isDragOver
          ? cn(
              "h-7 flex items-center justify-center gap-1",
              isFileDragOver
                ? "bg-primary/10 border border-dashed border-primary"
                : "bg-primary/10 border border-dashed border-primary/30",
            )
          : "-mt-1 h-1",
      )}
    >
      {isDragOver && (
        <>
          {isFileDragOver && <Upload className="size-3 text-primary" />}
          <span className="text-[10px] text-primary/70">
            {getContainerDropZoneLabel(isFileDragOver)}
          </span>
        </>
      )}
    </div>
  );
}

/**
 * Leading disclosure cell on every nav row — the Confluence page-tree
 * affordance.
 *
 * A BRANCH (item with children) gets a chevron that is always visible and
 * rotates on expand; a LEAF gets a small dot. Both occupy the identical
 * cell, so the whole tree shares one disclosure column and "does this row
 * go deeper?" is answerable without hovering. That was the flaw in the
 * previous design: the chevron lived in the hover-only right-hand controls,
 * so a sidebar at rest carried no branch/leaf information at all.
 *
 * ABSOLUTELY POSITIONED over the row's own left padding, for two reasons:
 *
 *  - The row stays clickable edge to edge. In flow the cell would be a dead
 *    strip — a <button> may not nest, so the twisty cannot live inside the
 *    navigate button, and everything left of the icon would stop navigating.
 *  - The chevron can take a 24px hit area out of a 16px cell without
 *    pushing the icon column right.
 *
 * The leaf dot is ``pointer-events-none`` so its clicks fall through to the
 * row underneath; the branch chevron keeps its own, since positioned
 * elements paint above the static button and win the hit test.
 */
function NavTwisty({
  hasChildren,
  childrenUnloaded = false,
  isExpanded,
  onToggle,
  label,
  isActive,
  depth,
  inTree = true,
}: {
  hasChildren: boolean;
  /** Nobody has fetched this row's children yet — see {@link NavItem.childrenUnloaded}. */
  childrenUnloaded?: boolean;
  isExpanded?: boolean;
  onToggle?: () => void;
  label: string;
  isActive?: boolean;
  depth: number;
  /** Is this row part of a tree — a list where something can branch?
   *  The leaf dot says "this one has nothing under it", which is only
   *  information where a sibling might. In a flat list (New Thread,
   *  Activity, a chat) nothing branches, so a dot on every row states a
   *  fact no one asked and reads as a bullet. The cell still renders, so
   *  flat rows keep the same label column as tree rows. */
  inTree?: boolean;
}) {
  const cell = cn(NAV_TWISTY_CLASS, getNavDepthOffsets(depth).column);

  if (!hasChildren) {
    return (
      <span data-nav-twisty-cell aria-hidden="true" className={cn(cell, "pointer-events-none")}>
        {/* No dot when the children simply have not been fetched. The dot is
            an ASSERTION — "nothing under this one" — and a caller that loads
            subtrees lazily would otherwise have every unvisited row make a
            claim on the strength of a request it never sent. The cell still
            occupies its column, so labels stay aligned and no marker jumps
            sideways when the answer arrives. */}
        {inTree && !childrenUnloaded && (
          <span
            data-nav-leaf-dot
            className={cn(
              "block size-1 shrink-0 rounded-full",
              isActive ? "bg-sidebar-selected-foreground/70" : "bg-sidebar-foreground/30",
            )}
          />
        )}
      </span>
    );
  }

  return (
    <span data-nav-twisty-cell className={cell}>
      <button
        type="button"
        data-nav-twisty
        aria-expanded={isExpanded}
        aria-label={isExpanded ? `Collapse ${label}` : `Expand ${label}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onToggle?.();
        }}
        className={cn(
          "flex items-center justify-center rounded",
          NAV_TWISTY_HIT_CLASS,
          isActive
            ? "text-sidebar-selected-foreground"
            : "text-sidebar-foreground/50 hover:text-sidebar-foreground",
        )}
      >
        <ChevronRight
          className={cn("size-3.5 transition-transform duration-150", isExpanded && "rotate-90")}
        />
      </button>
    </span>
  );
}

function NavItemActions({ actions }: { actions: NonNullable<NavItem["actions"]> }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7 rounded-md text-muted-foreground hover:bg-muted/80 hover:text-foreground"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          aria-label="More actions"
        >
          <Ellipsis className="size-3.5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        {actions.map((action) => (
          <span key={action.label}>
            {action.separator && <DropdownMenuSeparator />}
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                void action.handler();
              }}
              className={cn(
                "gap-2",
                action.destructive && "text-destructive focus:text-destructive",
              )}
            >
              <action.icon
                className={cn(
                  "size-3.5",
                  action.destructive ? "text-destructive" : "text-muted-foreground",
                )}
              />
              <span>{action.label}</span>
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Hover-revealed controls pinned to the right edge of a nav row.
 *
 * Expand/collapse deliberately does NOT live here — it's the leading
 * ``NavTwisty`` cell instead (see that component). This slot is for the
 * item's own actions menu only.
 */
function NavRowControls({ item }: { item: NavItem }) {
  const isDisabled = item.disabled === true;
  const hasActions = !isDisabled && item.actions && item.actions.length > 0;
  if (!hasActions) return null;

  return (
    <div className="absolute inset-y-0 right-1 flex items-center gap-1 px-1 opacity-0 translate-x-1 pointer-events-none transition-all group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-x-0 group-focus-within:pointer-events-auto">
      <NavItemActions actions={item.actions!} />
    </div>
  );
}

/** Leaf nav item with optional drag-and-drop support via NavItem.dnd. */
function NavLeafItem({
  item,
  isActive,
  onClick,
  depth = 0,
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  depth?: number;
}) {
  const bodyPl = getNavDepthOffsets(depth).body;
  const isDisabled = item.disabled === true;
  const hasActions = Boolean(!isDisabled && item.actions && item.actions.length > 0);
  const { draggableProps, dropTargetProps, isDragOver, isFileDragOver } = useNavItemDnd(item.dnd);
  const activeRowRef = useActiveNavRowScroll<HTMLDivElement>(isActive && hasActions);
  const activeButtonRef = useActiveNavRowScroll<HTMLButtonElement>(isActive && !hasActions);

  // Items with actions use the group layout (button + action controls)
  if (hasActions) {
    return (
      <div
        ref={activeRowRef}
        data-active-nav-row={isActive ? "true" : undefined}
        data-nav-depth={depth}
        style={{ "--nav-depth": depth } as React.CSSProperties}
        {...(isDisabled ? {} : dropTargetProps)}
        {...(isDisabled ? {} : draggableProps)}
        className={cn(
          "group relative flex items-center w-full rounded-xl border border-transparent transition-colors",
          isDisabled
            ? "opacity-40"
            : isActive
              ? ACTIVE_NAV_ROW_CLASS
              : "hover:bg-sidebar-accent/70",
          isDragOver &&
            !isFileDragOver &&
            !isDisabled &&
            "ring-2 ring-inset ring-sidebar-ring/50 bg-sidebar-selected",
          isFileDragOver &&
            !isDisabled &&
            "outline-dashed outline-2 -outline-offset-2 outline-primary bg-primary/10",
          item.dimmed && !isDisabled && "opacity-50",
        )}
      >
        <NavTwisty
          hasChildren={false}
          childrenUnloaded={item.childrenUnloaded}
          label={item.label}
          isActive={isActive && !isDisabled}
          depth={depth}
        />
        <button
          type="button"
          disabled={isDisabled}
          onClick={isDisabled ? undefined : onClick}
          className={cn(
            "flex items-center gap-2 flex-1 min-w-0 py-1 text-sm text-left",
            bodyPl,
            "pr-3 transition-[padding] duration-150",
            NAV_ROW_ACTIONS_CLEARANCE,
            isDisabled
              ? "text-sidebar-foreground/45 cursor-default"
              : isActive
                ? ACTIVE_NAV_TEXT_CLASS
                : "text-sidebar-foreground/80",
          )}
        >
          <item.icon
            className={cn(
              "size-3.5 shrink-0",
              isActive && !isDisabled ? ACTIVE_NAV_ICON_CLASS : "text-sidebar-icon",
            )}
          />
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
                isActive
                  ? ACTIVE_NAV_BADGE_CLASS
                  : "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {item.badge}
            </span>
          )}
          <NavStatusIcon statusIcon={item.statusIcon} />
          <NavStatusDot statusDot={item.statusDot} />
        </button>
        {/* File-drop hint icon — rendered as an inline flex sibling so it
            naturally sits to the LEFT of the action controls instead of
            overlapping them at a magic-number offset. */}
        {isFileDragOver && !isDisabled && (
          <Upload
            aria-hidden="true"
            className="size-3.5 mr-2 shrink-0 text-primary pointer-events-none"
          />
        )}
        <NavRowControls item={item} />
      </div>
    );
  }

  return (
    <button
      ref={activeButtonRef}
      data-active-nav-row={isActive ? "true" : undefined}
      data-nav-depth={depth}
      style={{ "--nav-depth": depth } as React.CSSProperties}
      type="button"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      {...(isDisabled ? {} : draggableProps)}
      {...(isDisabled ? {} : dropTargetProps)}
      className={cn(
        "relative flex items-center gap-2 w-full",
        "rounded-lg border border-transparent pr-3 py-1 text-sm text-left",
        bodyPl,
        isDisabled
          ? "opacity-40 cursor-default"
          : "text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent/70",
        !isDisabled && isActive && ACTIVE_NAV_ROW_CLASS,
        isDragOver &&
          !isFileDragOver &&
          !isDisabled &&
          "ring-2 ring-inset ring-sidebar-ring/50 bg-sidebar-selected",
        isFileDragOver &&
          !isDisabled &&
          "outline-dashed outline-2 -outline-offset-2 outline-primary bg-primary/10",
        item.dimmed && !isDisabled && "opacity-50",
      )}
    >
      <NavTwisty
        hasChildren={false}
        childrenUnloaded={item.childrenUnloaded}
        label={item.label}
        isActive={isActive && !isDisabled}
        depth={depth}
      />
      <item.icon
        className={cn(
          "size-3.5 shrink-0",
          isActive && !isDisabled ? ACTIVE_NAV_ICON_CLASS : "text-sidebar-icon",
        )}
      />
      <span className={cn("truncate", isActive && !isDisabled && ACTIVE_NAV_TEXT_CLASS)}>
        {item.label}
      </span>
      {item.badge && (
        <span
          className={cn(
            "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
            isActive ? ACTIVE_NAV_BADGE_CLASS : "bg-sidebar-accent text-sidebar-accent-foreground",
          )}
        >
          {item.badge}
        </span>
      )}
      <NavStatusIcon statusIcon={item.statusIcon} />
      <NavStatusDot statusDot={item.statusDot} />
      {isFileDragOver && !isDisabled && (
        <Upload
          aria-hidden="true"
          className="ml-auto size-3.5 shrink-0 text-primary pointer-events-none"
        />
      )}
    </button>
  );
}

function SubNavItems({
  items,
  parentPath,
  depth = 1,
}: {
  items: NavItem[];
  parentPath: string;
  depth?: number;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  const setNavContext = useAppStore((s) => s.setNavContext);
  const navContext = useAppStore((s) => s.navContext);
  const isOnParent = matchesNavLocation(currentPath, parentPath);
  const [activeLabel, setActiveLabel] = useState(items[0]?.label ?? "");

  // Children with unique paths (e.g., SPACES documents) use URL matching;
  // children sharing the parent path (e.g., Documents sub-filters) use label matching.
  const allShareParent = items.every((c) => c.to === parentPath);

  return (
    <div>
      {items.map((child) => {
        const hasNestedChildren =
          !child.childrenHidden && child.children && child.children.length > 0;

        // Folders with children render as collapsible nested items
        if (hasNestedChildren) {
          return <NestedFolderItem key={child.to + child.label} item={child} depth={depth} />;
        }

        // Items sharing parent path use label matching (e.g., Documents sub-filters).
        // Items with unique paths use URL matching. Items whose path equals the
        // parent path (e.g., folders) are never highlighted on the parent page.
        const isActive = allShareParent
          ? isOnParent && activeLabel === child.label
          : child.to !== parentPath && isSelectedNavItem(currentPath, child);
        return (
          <NavLeafItem
            key={child.to + child.label}
            item={child}
            isActive={isActive}
            depth={depth}
            onClick={() => {
              setActiveLabel(child.label);
              setNavContext({
                ...navContext,
                label: child.label,
                description: child.description ?? navContext.description,
                meta: child.meta ?? {},
                contextInstructions:
                  [navContext.contextInstructions, child.contextInstructions]
                    .filter(Boolean)
                    .join("\n") || null,
              });
              navigate(child.to);
            }}
          />
        );
      })}
    </div>
  );
}

/** Check if current page is inside a nav item's subtree. */
function isInSubtree(currentPage: string, item: NavItem): boolean {
  if (matchesNavLocation(currentPage, item.to)) return true;
  return item.children?.some((c) => isInSubtree(currentPage, c)) ?? false;
}

/** A navigation target may declare stable scope parameters while the page
 * adds transient state such as a selected row or table sort. */
function matchesNavLocation(currentPage: string, target: string): boolean {
  const current = new URL(currentPage, "http://navigation.local");
  const destination = new URL(target, current.origin);
  if (current.pathname.replace(/\/+$/, "") !== destination.pathname.replace(/\/+$/, "")) {
    return false;
  }
  if (destination.searchParams.size === 0) return true;
  return [...destination.searchParams].every(([key, value]) =>
    current.searchParams.getAll(key).includes(value),
  );
}

function hasMoreSpecificNavMatch(currentPage: string, target: string): boolean {
  const count = new URL(target, "http://navigation.local").searchParams.size;
  const walk = (items: NavItem[]): boolean =>
    items.some(
      (item) =>
        (matchesNavLocation(currentPage, item.to) &&
          new URL(item.to, "http://navigation.local").searchParams.size > count) ||
        walk(item.children ?? []),
    );
  return useNavStore.getState().config.some((group) => walk(group.items));
}

/** A list owns the sidebar selection of descendants it deliberately does not draw.
 * The route lookup still resolves the actual descendant for chat and page actions. */
function isSelectedNavItem(currentPage: string, item: NavItem): boolean {
  return (
    (matchesNavLocation(currentPage, item.to) && !hasMoreSpecificNavMatch(currentPage, item.to)) ||
    Boolean(item.childrenHidden && isInSubtree(currentPage, item))
  );
}

/** Nested folder with collapsible children (used inside SubNavItems). */
function NestedFolderItem({ item, depth }: { item: NavItem; depth: number }) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  const setNavContext = useAppStore((s) => s.setNavContext);
  const navContext = useAppStore((s) => s.navContext);
  const isInsideSubtree = isInSubtree(currentPath, item);
  const isActive = isSelectedNavItem(currentPath, item);
  const isAncestorActive = isInsideSubtree && !isActive;
  const [isExpanded, setExpanded] = useTreeExpanded(item.to, isInsideSubtree);
  const { draggableProps, dropTargetProps, isDragOver, isFileDragOver } = useNavItemDnd(item.dnd);
  const bodyPl = getNavDepthOffsets(depth).body;

  const isDisabled = item.disabled === true;
  const hasActions = Boolean(!isDisabled && item.actions && item.actions.length > 0);
  const activeRowRef = useActiveNavRowScroll<HTMLDivElement>(isActive);

  return (
    <div {...(isDisabled ? {} : dropTargetProps)}>
      <div
        ref={activeRowRef}
        data-active-nav-row={isActive ? "true" : undefined}
        data-nav-depth={depth}
        style={{ "--nav-depth": depth } as React.CSSProperties}
        {...(isDisabled ? {} : draggableProps)}
        className={cn(
          "group relative flex items-center w-full",
          "rounded-xl border border-transparent transition-colors",
          isDisabled
            ? "opacity-40"
            : isActive
              ? ACTIVE_NAV_ROW_CLASS
              : "hover:bg-sidebar-accent/70",
          isDragOver &&
            !isFileDragOver &&
            !isDisabled &&
            "ring-2 ring-inset ring-sidebar-ring/50 bg-sidebar-selected",
          isFileDragOver &&
            !isDisabled &&
            "outline-dashed outline-2 -outline-offset-2 outline-primary bg-primary/10",
          item.dimmed && !isDisabled && "opacity-50",
        )}
      >
        <NavTwisty
          hasChildren
          isExpanded={isExpanded}
          onToggle={() => setExpanded(!isExpanded)}
          label={item.label}
          isActive={(isActive || isAncestorActive) && !isDisabled}
          depth={depth}
        />
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return;
            setExpanded(true);
            setNavContext({
              ...navContext,
              label: item.label,
              description: item.description ?? navContext.description,
              meta: item.meta ?? {},
              contextInstructions:
                [navContext.contextInstructions, item.contextInstructions]
                  .filter(Boolean)
                  .join("\n") || null,
            });
            navigate(item.to);
          }}
          className={cn(
            "flex items-center gap-2 flex-1 min-w-0",
            bodyPl,
            "pr-3 py-1 text-sm text-left transition-[padding] duration-150",
            hasActions && NAV_ROW_ACTIONS_CLEARANCE,
            isDisabled
              ? "text-sidebar-foreground/45 cursor-default"
              : isActive
                ? ACTIVE_NAV_TEXT_CLASS
                : isAncestorActive
                  ? "text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/80",
          )}
        >
          <item.icon
            className={cn(
              "size-3.5 shrink-0",
              isActive && !isDisabled
                ? ACTIVE_NAV_ICON_CLASS
                : isAncestorActive
                  ? "text-sidebar-foreground/80"
                  : "text-sidebar-icon",
            )}
          />
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
                isActive
                  ? ACTIVE_NAV_BADGE_CLASS
                  : "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {item.badge}
            </span>
          )}
          <NavStatusIcon statusIcon={item.statusIcon} />
          <NavStatusDot statusDot={item.statusDot} />
        </button>
        {/* File-drop hint icon — inline flex sibling so it sits to the
            LEFT of the action controls instead of overlapping them. */}
        {isFileDragOver && !isDisabled && (
          <Upload
            aria-hidden="true"
            className="size-3.5 mr-2 shrink-0 text-primary pointer-events-none"
          />
        )}
        <NavRowControls item={item} />
      </div>
      {isExpanded && item.children && (
        <div>
          {item.children.map((child) => {
            const hasNestedChildren =
              !child.childrenHidden && child.children && child.children.length > 0;
            if (hasNestedChildren) {
              return (
                <NestedFolderItem key={child.to + child.label} item={child} depth={depth + 1} />
              );
            }
            const isChildActive = isSelectedNavItem(currentPath, child);
            return (
              <NavLeafItem
                key={child.to + child.label}
                item={child}
                isActive={isChildActive}
                depth={depth + 1}
                onClick={() => {
                  setNavContext({
                    ...navContext,
                    label: child.label,
                    description: child.description ?? navContext.description,
                    meta: child.meta ?? {},
                    contextInstructions:
                      [navContext.contextInstructions, child.contextInstructions]
                        .filter(Boolean)
                        .join("\n") || null,
                  });
                  navigate(child.to);
                }}
              />
            );
          })}
          {item.dnd?.canDrop() && <ContainerDropZone dnd={item.dnd} />}
        </div>
      )}
    </div>
  );
}

function CollapsibleNavItem({
  item,
  inTree = true,
  heading = false,
  underHeader = false,
}: {
  item: NavItem;
  inTree?: boolean;
  /** The item a focused group is focused on — see ``NavGroup.focusOn``:
   *  flat, emphasised, never collapsed, its children one step left. */
  heading?: boolean;
  /** Whether the group draws a header this row should indent under. */
  underHeader?: boolean;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const currentPath = location.pathname + location.search;
  const setNavContext = useAppStore((s) => s.setNavContext);
  const navContext = useAppStore((s) => s.navContext);
  const isInsideSubtree = isInSubtree(currentPath, item);
  const isActive = isSelectedNavItem(currentPath, item);
  const isAncestorActive = isInsideSubtree && !isActive;
  const [treeExpanded, setExpanded] = useTreeExpanded(item.to, isInsideSubtree);
  // A heading is never collapsed and carries no chevron: its children ARE
  // the tree it stands for.
  const isExpanded = heading ? true : treeExpanded;
  const hasChildren = Boolean(!item.childrenHidden && item.children && item.children.length > 0);
  const isDisabled = item.disabled === true;
  const hasActions = Boolean(!isDisabled && item.actions && item.actions.length > 0);
  const rowInTree = inTree && !heading;
  const bodyClass = rowInTree
    ? getNavDepthOffsets(0).body
    : heading || !underHeader
      ? NAV_FLAT_BODY_CLASS
      : getNavDepthOffsets(0).body;
  const headingClass =
    heading &&
    !isDisabled &&
    `font-semibold ${isActive ? "text-sidebar-selected-foreground" : "text-sidebar-primary"}`;
  const { draggableProps, dropTargetProps, isDragOver, isFileDragOver } = useNavItemDnd(item.dnd);
  const rendersRow = Boolean(hasChildren || hasActions);
  const activeRowRef = useActiveNavRowScroll<HTMLDivElement>(isActive && rendersRow);
  const activeLinkRef = useActiveNavRowScroll<HTMLAnchorElement>(isActive && !rendersRow);

  if (rendersRow) {
    const inner = (selected: boolean, ancestor: boolean) => (
      <div
        ref={activeRowRef}
        data-active-nav-row={selected ? "true" : undefined}
        data-nav-depth={0}
        className={cn(
          "group relative flex items-center w-full rounded-xl border border-transparent transition-colors",
          isDisabled
            ? "opacity-40"
            : selected
              ? ACTIVE_NAV_ROW_CLASS
              : "hover:bg-sidebar-accent/70",
          isDragOver &&
            !isFileDragOver &&
            !isDisabled &&
            "ring-2 ring-inset ring-sidebar-ring/50 bg-sidebar-selected",
          isFileDragOver &&
            !isDisabled &&
            "outline-dashed outline-2 -outline-offset-2 outline-primary bg-primary/10",
          item.dimmed && !isDisabled && "opacity-50",
        )}
      >
        <NavTwisty
          hasChildren={hasChildren && !heading}
          childrenUnloaded={item.childrenUnloaded}
          inTree={rowInTree}
          isExpanded={isExpanded}
          onToggle={hasChildren && !heading ? () => setExpanded(!isExpanded) : undefined}
          label={item.label}
          isActive={(selected || ancestor) && !isDisabled}
          depth={0}
        />
        <button
          type="button"
          onClick={() => {
            if (isDisabled) return;
            setNavContext({
              ...navContext,
              label: item.label,
              description: item.description ?? navContext.description,
              meta: item.meta ?? {},
              contextInstructions:
                [navContext.contextInstructions, item.contextInstructions]
                  .filter(Boolean)
                  .join("\n") || null,
            });
            if (hasChildren) setExpanded(true);
            navigate(item.to);
          }}
          className={cn(
            "flex items-center gap-2 flex-1 min-w-0 py-1.5 text-sm text-left",
            bodyClass,
            "pr-3 transition-[padding] duration-150",
            hasActions && NAV_ROW_ACTIONS_CLEARANCE,
            isDisabled
              ? "text-sidebar-foreground/45 cursor-default"
              : selected
                ? ACTIVE_NAV_TEXT_CLASS
                : ancestor
                  ? "text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/85",
            headingClass,
          )}
          disabled={isDisabled}
        >
          <item.icon
            className={cn(
              "size-4 shrink-0",
              selected && !isDisabled
                ? ACTIVE_NAV_ICON_CLASS
                : ancestor
                  ? "text-sidebar-foreground/80"
                  : "text-sidebar-icon",
            )}
          />
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
                selected
                  ? ACTIVE_NAV_BADGE_CLASS
                  : "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {item.badge}
            </span>
          )}
          <NavStatusIcon statusIcon={item.statusIcon} />
          <NavStatusDot statusDot={item.statusDot} />
        </button>
        {/* File-drop hint icon — inline flex sibling so it sits to the
            LEFT of the action controls instead of overlapping them. */}
        {isFileDragOver && !isDisabled && (
          <Upload
            aria-hidden="true"
            className="size-3.5 mr-2 shrink-0 text-primary pointer-events-none"
          />
        )}
        <NavRowControls item={item} />
      </div>
    );

    return (
      <div {...(isDisabled ? {} : dropTargetProps)} {...(isDisabled ? {} : draggableProps)}>
        {inner(isActive, isAncestorActive)}
        {hasChildren && isExpanded && (
          <>
            {/* A heading's children sit one step further left than a
                branch's: the heading is flat, so its own column is free and
                the hierarchy still reads. Same row metrics either way. */}
            <SubNavItems items={item.children!} parentPath={item.to} depth={heading ? 0 : 1} />
            {item.dnd?.canDrop() && <ContainerDropZone dnd={item.dnd} />}
          </>
        )}
      </div>
    );
  }

  if (isDisabled) {
    return (
      <div
        data-nav-depth={0}
        className={cn(
          "relative flex items-center gap-2 w-full opacity-40",
          bodyClass,
          // Transparent border for box-model parity — see the NavLink variant.
          "rounded-lg border border-transparent pr-3 py-1.5 text-left text-sm text-sidebar-foreground/45",
        )}
      >
        <NavTwisty
          hasChildren={false}
          childrenUnloaded={item.childrenUnloaded}
          inTree={rowInTree}
          label={item.label}
          depth={0}
        />
        <item.icon className="size-4 shrink-0 text-sidebar-foreground/45" />
        <span className="truncate">{item.label}</span>
      </div>
    );
  }

  return (
    <NavLink
      ref={activeLinkRef}
      data-active-nav-row={isActive ? "true" : undefined}
      data-nav-depth={0}
      to={item.to}
      onClick={(event) => {
        if (!isActive || !matchesNavLocation(currentPath, item.to)) return;
        event.preventDefault();
        useSidebarStore.getState().closeMobile();
      }}
      {...draggableProps}
      {...dropTargetProps}
      className={() =>
        cn(
          "relative flex items-center gap-2 w-full",
          bodyClass,
          // The transparent border is NOT decoration: it is what makes this
          // row's box model match every other variant. An absolutely
          // positioned twisty resolves against the PADDING box, so a row
          // without the border puts its disclosure cell 1px left of its
          // siblings' and the column goes ragged.
          "rounded-xl border border-transparent pr-3 py-1.5 text-sm text-left",
          "text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70",
          headingClass,
          isActive && cn(ACTIVE_NAV_ROW_CLASS, ACTIVE_NAV_TEXT_CLASS),
          isDragOver &&
            !isFileDragOver &&
            "bg-sidebar-selected ring-2 ring-inset ring-sidebar-ring/50",
          isFileDragOver &&
            "outline-dashed outline-2 -outline-offset-2 outline-primary bg-primary/10",
          item.dimmed && "opacity-50",
        )
      }
    >
      {() => (
        <>
          <NavTwisty
            hasChildren={false}
            childrenUnloaded={item.childrenUnloaded}
            inTree={rowInTree}
            label={item.label}
            isActive={isActive}
            depth={0}
          />
          <item.icon
            className={cn(
              "size-4 shrink-0",
              isActive ? ACTIVE_NAV_ICON_CLASS : "text-sidebar-icon",
            )}
          />
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
                isActive
                  ? ACTIVE_NAV_BADGE_CLASS
                  : "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {item.badge}
            </span>
          )}
          <NavStatusIcon statusIcon={item.statusIcon} />
          <NavStatusDot statusDot={item.statusDot} />
          {isFileDragOver && (
            <Upload
              aria-hidden="true"
              className="ml-auto size-3.5 shrink-0 text-primary pointer-events-none"
            />
          )}
        </>
      )}
    </NavLink>
  );
}

function SidebarResizeHandle() {
  const setWidth = useSidebarStore((s) => s.setWidth);
  const width = useSidebarStore((s) => s.width);
  const dragState = useRef<{ startX: number; startWidth: number; pointerId: number } | null>(null);

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      if (!dragState.current) return;
      const nextWidth = dragState.current.startWidth + (event.clientX - dragState.current.startX);
      setWidth(nextWidth);
    };

    const onPointerUp = (event: PointerEvent) => {
      if (dragState.current && event.pointerId !== dragState.current.pointerId) return;
      dragState.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
    };
  }, [setWidth]);

  return (
    <div
      data-panel-resize
      title="Drag to resize navigation. Double-click to reset."
      onDoubleClick={() => setWidth(SIDEBAR_WIDTH)}
      className="absolute inset-y-0 right-0 z-20 hidden w-3 cursor-col-resize md:block"
      onPointerDown={(event) => {
        event.preventDefault();
        dragState.current = {
          startX: event.clientX,
          startWidth: width,
          pointerId: event.pointerId,
        };
        document.body.style.cursor = "col-resize";
        document.body.style.userSelect = "none";
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowLeft") {
          event.preventDefault();
          setWidth(width - (event.shiftKey ? 40 : 16));
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setWidth(width + (event.shiftKey ? 40 : 16));
        }
        if (event.key === "Home") {
          event.preventDefault();
          setWidth(SIDEBAR_MIN_WIDTH);
        }
        if (event.key === "End") {
          event.preventDefault();
          setWidth(SIDEBAR_MAX_WIDTH);
        }
      }}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize navigation sidebar"
      aria-valuemin={SIDEBAR_MIN_WIDTH}
      aria-valuemax={SIDEBAR_MAX_WIDTH}
      aria-valuenow={Math.round(width)}
      tabIndex={0}
    >
      <div className="absolute inset-y-6 right-0 flex w-3 items-center justify-center opacity-0 transition-opacity group-hover/sidebar:opacity-100">
        <div className="flex h-14 w-1.5 items-center justify-center rounded-full bg-border/90 text-muted-foreground shadow-sm">
          <GripVertical className="size-3" />
        </div>
      </div>
    </div>
  );
}

// ThreadIndicator (the "Active thread •" badge under New Thread) was
// removed — the active conversation's selected row in the Recents
// group is now the source of truth for "you're in a chat right now".
// Kept as a comment so future spelunkers know it was intentional.

function CollapsedNavShortcut({
  to,
  label,
  icon: Icon,
  isActive,
}: {
  to: string;
  label: string;
  icon: typeof Layers;
  isActive: boolean;
}) {
  return (
    <NavLink key={to} to={to}>
      <TooltipIconButton
        tooltip={label}
        side="right"
        className={cn(
          isActive &&
            "border border-transparent bg-sidebar-selected text-sidebar-selected-foreground",
        )}
      >
        <Icon
          className={cn(
            "size-4",
            isActive ? "text-sidebar-selected-foreground" : "text-sidebar-icon",
          )}
        />
      </TooltipIconButton>
    </NavLink>
  );
}

// ---------------------------------------------------------------------------
// Collapsible nav-group state — persisted per-label in localStorage so the
// user's "minimised Admin section" choice survives reloads. A single JSON
// blob keyed on label means we only touch one storage key per render and
// we can subscribe via useSyncExternalStore for cheap cross-component
// updates (toggle one group, all SidebarContent instances re-render).
// ---------------------------------------------------------------------------

// Generic package-scoped key — ``foundry-web-ui`` is consumed beyond
// the Spaces app, so we avoid consumer-specific names like
// ``spaces.nav.collapsed``. Matches the keying style used by the
// adjacent sidebar-store helpers (``sidebar``, ``sidebar-width``,
// ``theme``).
const COLLAPSE_STORAGE_KEY = "sidebar-nav-collapsed";
type CollapseMap = Record<string, boolean>;

let _collapseCache: CollapseMap | null = null;
const _collapseListeners = new Set<() => void>();

function readCollapseMap(): CollapseMap {
  if (_collapseCache) return _collapseCache;
  if (typeof window === "undefined") {
    _collapseCache = {};
    return _collapseCache;
  }
  try {
    const raw = window.localStorage.getItem(COLLAPSE_STORAGE_KEY);
    _collapseCache = raw ? (JSON.parse(raw) as CollapseMap) : {};
  } catch {
    _collapseCache = {};
  }
  return _collapseCache;
}

function writeCollapseMap(next: CollapseMap): void {
  _collapseCache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // localStorage full / disabled — toggle still works in-memory for
      // this page session.
    }
  }
  for (const fn of _collapseListeners) fn();
}

function subscribeCollapse(fn: () => void): () => void {
  _collapseListeners.add(fn);
  return () => {
    _collapseListeners.delete(fn);
  };
}

/**
 * Read the persisted collapse state for a single group. ``defaultCollapsed``
 * is the fallback when the user has never toggled this group.
 */
function useGroupCollapsed(label: string, defaultCollapsed: boolean | undefined): boolean {
  const map = useSyncExternalStore(subscribeCollapse, readCollapseMap, readCollapseMap);
  // Use ``hasOwnProperty`` instead of the ``in`` operator so a label
  // that happens to collide with a prototype key (e.g. ``toString``,
  // ``__proto__``, ``constructor``) is not treated as a persisted
  // entry. ``map`` is parsed JSON so its prototype is ``Object``'s.
  return Object.prototype.hasOwnProperty.call(map, label) ? map[label] : Boolean(defaultCollapsed);
}

/** Keep opened branches stable while routes and asynchronously loaded children change. */
function useTreeExpanded(to: string, inside: boolean): [boolean, (expanded: boolean) => void] {
  const key = `tree:${to}`;
  const collapsed = useGroupCollapsed(key, !inside);
  useEffect(() => {
    if (inside && !Object.prototype.hasOwnProperty.call(readCollapseMap(), key)) {
      writeCollapseMap({ ...readCollapseMap(), [key]: false });
    }
  }, [inside, key]);
  return [!collapsed, (expanded) => writeCollapseMap({ ...readCollapseMap(), [key]: !expanded })];
}

function toggleGroupCollapsed(label: string, current: boolean): void {
  writeCollapseMap({ ...readCollapseMap(), [label]: !current });
}

/**
 * Walk a group's items (and their children) to find the first statusDot.
 * Used to "bubble up" the active-chat indicator onto a collapsed group
 * header — so the user never loses sight of "your active conversation is
 * inside this minimised section".
 */
function findFirstStatusDot(items: readonly NavItem[]): NavStatusDot | undefined {
  for (const item of items) {
    if (item.statusDot) return item.statusDot;
    if (item.children && item.children.length > 0) {
      const nested = findFirstStatusDot(item.children);
      if (nested) return nested;
    }
  }
  return undefined;
}

/**
 * Render a single nav group: label header (with optional collapse
 * chevron + bubbled-up status dot) + child items. Pulled out into its
 * own component so each group's collapse state is its own hook scope
 * — toggling one doesn't re-render siblings.
 */
function NavGroupSection({ group }: { group: NavGroup }) {
  // Does anything in THIS group branch? The leaf dot exists to say "this
  // row has nothing under it", which is only information where a sibling
  // might — a tree. In a flat group (New Thread, Activity, a list of
  // chats) nothing branches, so a dot on every row marks a distinction
  // that does not exist and reads as a bullet. The disclosure cell still
  // renders either way, so flat rows keep the same label column as tree
  // rows and the sidebar stays on one grid.
  const groupHasBranches = group.items.some((item) =>
    Boolean(!item.childrenHidden && item.children && item.children.length > 0),
  );
  // hideLabel + collapsible are mutually exclusive — a hidden label
  // can't host a chevron. The collapsible flag is the opt-in; legacy
  // groups stay uncollapsable so behaviour is unchanged.
  // Focus — see ``NavGroup.focusOn``: the group draws one item as a heading
  // under a header that leads back. Needs a visible label to lead back
  // from and a ``to`` to lead back to; otherwise it draws as usual.
  const focusedItem =
    group.focusOn !== undefined && !group.hideLabel && group.to
      ? group.items.find((item) => item.to === group.focusOn)
      : undefined;
  const focused = focusedItem !== undefined;
  // The new shape fades in over the old one's place: keyed on the focus,
  // and only after a CHANGE in either direction — not on first paint
  // (user's test: the hard swap felt abrupt). The previous key is read
  // during render and written after it, so a focus that returns to its
  // initial value still counts as a change.
  const focusKey = focused ? focusedItem.to : "";
  const previousFocusKey = useRef(focusKey);
  const animateRows = previousFocusKey.current !== focusKey;
  useEffect(() => {
    previousFocusKey.current = focusKey;
  });
  // Focus takes precedence over collapsing: a focused header is the way back.
  const isCollapsible = !group.hideLabel && Boolean(group.collapsible) && !focused;
  const persistedCollapsed = useGroupCollapsed(group.label, group.defaultCollapsed);
  const collapsed = isCollapsible && persistedCollapsed;
  // Bubble: show the first child statusDot on the collapsed header so
  // the user never loses sight of "the active chat is inside this
  // minimised group". Only render when actually collapsed.
  const bubbledStatusDot = collapsed ? findFirstStatusDot(group.items) : undefined;

  return (
    <div data-nav-group-label={group.label}>
      {!group.hideLabel && (
        // Outer padding matches the depth-0 item button's ``px-3`` so
        // the chevron / leading spacer sits in the SAME icon column as
        // item icons, and the group label ends up at the exact x-coordinate
        // as item labels. See ``SIDEBAR_GROUP_HEADER_PADDING`` definition
        // for the alignment invariant.
        <div className={SIDEBAR_GROUP_HEADER_PADDING}>
          {isCollapsible ? (
            // Collapsible header is a flex of three siblings: chevron
            // toggle (own button), label (NavLink when ``group.to``
            // is set so the user can still navigate to the group
            // landing page — Workspaces does this), createActions
            // menu. Three SIBLINGS, not nested, so HTML stays valid
            // (no <button> inside <button> / inside Radix's button).
            //
            // Geometry: the chevron occupies the SAME width as item
            // icons (``SIDEBAR_ITEM_ICON_CLASS``) followed by
            // ``SIDEBAR_ITEM_GAP_CLASS``, so the group label and the
            // item labels share an exact x-coordinate. The chevron's
            // click target is larger than its visual size — extended
            // via padding on the wrapper button — so users don't have
            // to hit a tiny target. The clickable invisible padding
            // OVERLAPS the gap rather than pushing the label right
            // (negative-margin + extra padding cancel out).
            <div
              data-nav-group-header
              className={cn(
                "group/header flex items-center justify-between transition-colors hover:bg-sidebar-accent/70",
                SIDEBAR_GROUP_HEADER_BOX,
                SIDEBAR_ITEM_GAP_CLASS,
              )}
            >
              <button
                type="button"
                data-nav-group-toggle
                onClick={() => toggleGroupCollapsed(group.label, persistedCollapsed)}
                aria-expanded={!collapsed}
                aria-label={collapsed ? `Expand ${group.label}` : `Collapse ${group.label}`}
                // Visual cell width = ``SIDEBAR_ITEM_ICON_CLASS`` (14px)
                // so the chevron sits in the same column as item icons
                // and the group label aligns with item labels. The
                // chevron SVG (``size-3`` = 12px) is smaller than the
                // cell so it reads as a hint, not a primary control.
                // Hit area is the cell width; the row's ``group/header``
                // hover state covers the rest of the strip so users get
                // visual feedback even on near-misses.
                className={cn(
                  "inline-flex items-center justify-center rounded text-sidebar-foreground/50 hover:text-sidebar-foreground",
                  SIDEBAR_ITEM_ICON_CLASS,
                )}
              >
                {collapsed ? (
                  <ChevronRight className="size-3.5 transition-transform" />
                ) : (
                  <ChevronDown className="size-3.5 transition-transform" />
                )}
              </button>
              {group.to ? (
                <NavLink
                  to={group.to}
                  end
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5"
                >
                  {({ isActive }) => (
                    <>
                      <span
                        className={cn(
                          "truncate",
                          SIDEBAR_GROUP_HEADER_LABEL_CLASS,
                          isActive
                            ? "text-sidebar-selected-foreground"
                            : "text-sidebar-foreground/75 group-hover/header:text-sidebar-foreground",
                        )}
                      >
                        {group.label}
                      </span>
                      <NavStatusDot statusDot={bubbledStatusDot} />
                    </>
                  )}
                </NavLink>
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroupCollapsed(group.label, persistedCollapsed)}
                  className="flex min-w-0 flex-1 items-center gap-1.5 py-1.5 text-left"
                >
                  <span
                    className={cn(
                      "truncate text-sidebar-foreground/75 group-hover/header:text-sidebar-foreground",
                      SIDEBAR_GROUP_HEADER_LABEL_CLASS,
                    )}
                  >
                    {group.label}
                  </span>
                  <NavStatusDot statusDot={bubbledStatusDot} />
                </button>
              )}
              {group.createActions && group.createActions.length > 0 && (
                <CreateActionsMenu group={group} />
              )}
            </div>
          ) : focused ? (
            // The focused header is the way back: the collapse chevron's
            // cell holds a back chevron, the label links to the group's
            // page, and the metrics are the collapsible header's — so the
            // header stays put, in the same type, when the group focuses.
            <div
              data-nav-group-header
              className={cn(
                "flex items-center justify-between py-1.5 transition-colors hover:bg-sidebar-accent/70",
                SIDEBAR_GROUP_HEADER_BOX,
                SIDEBAR_ITEM_GAP_CLASS,
              )}
            >
              <NavLink
                to={group.to!}
                end
                data-nav-group-back
                title={group.description}
                className={cn("flex min-w-0 flex-1 items-center", SIDEBAR_ITEM_GAP_CLASS)}
              >
                <span
                  aria-hidden="true"
                  className={cn(SIDEBAR_ITEM_ICON_CLASS, "flex items-center justify-center")}
                >
                  <ChevronLeft className="size-3.5 text-sidebar-foreground/75" />
                </span>
                <span
                  className={cn(
                    "truncate",
                    SIDEBAR_GROUP_HEADER_LABEL_CLASS,
                    "text-sidebar-foreground/75 hover:text-sidebar-foreground",
                  )}
                >
                  {group.label}
                </span>
              </NavLink>
              {group.createActions && group.createActions.length > 0 && (
                <CreateActionsMenu group={group} />
              )}
            </div>
          ) : group.to ? (
            // Non-collapsible header: no chevron, but we still emit an
            // invisible spacer of ``SIDEBAR_ITEM_ICON_CLASS`` width + the
            // shared gap so the group label lands in the same column as
            // collapsible headers and item labels.
            <div
              data-nav-group-header
              className={cn(
                "flex items-center justify-between py-1.5 transition-colors hover:bg-sidebar-accent/70",
                SIDEBAR_GROUP_HEADER_BOX,
                SIDEBAR_ITEM_GAP_CLASS,
              )}
            >
              <span aria-hidden="true" className={SIDEBAR_ITEM_ICON_CLASS} />
              <NavLink to={group.to} end className="min-w-0 flex-1">
                {({ isActive }) => (
                  <span
                    className={cn(
                      "block",
                      SIDEBAR_GROUP_HEADER_LABEL_CLASS,
                      isActive
                        ? "text-sidebar-selected-foreground"
                        : "text-sidebar-foreground/75 hover:text-sidebar-foreground",
                    )}
                  >
                    {group.label}
                  </span>
                )}
              </NavLink>
              {group.createActions && group.createActions.length > 0 && (
                <CreateActionsMenu group={group} />
              )}
            </div>
          ) : (
            <div
              data-nav-group-header
              className={cn("flex items-center", SIDEBAR_GROUP_HEADER_BOX, SIDEBAR_ITEM_GAP_CLASS)}
            >
              <span aria-hidden="true" className={SIDEBAR_ITEM_ICON_CLASS} />
              <span className={cn("text-sidebar-foreground/75", SIDEBAR_GROUP_HEADER_LABEL_CLASS)}>
                {group.label}
              </span>
            </div>
          )}
        </div>
      )}
      {!collapsed && (
        <div
          data-nav-group-items
          key={focusKey}
          className={cn(
            animateRows &&
              "motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-top-1 motion-safe:duration-200",
          )}
        >
          {(focused ? [focusedItem] : group.items).map((item) => (
            <CollapsibleNavItem
              key={item.to + item.label}
              item={item}
              // A leaf dot distinguishes "nothing under this" from a sibling
              // that branches. Decided per GROUP: Workspaces has branches, so
              // its leaves are marked; Chats has none, so a dot on every row
              // would mark a distinction that does not exist.
              inTree={group.tree ?? groupHasBranches}
              heading={focused}
              underHeader={!group.hideLabel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * The "+" dropdown shown next to a group label when the group declares
 * ``createActions``. Pulled out so both the collapsible-button branch
 * and the legacy plain-label branch can render it identically.
 *
 * The trigger button stops click propagation so opening the menu
 * doesn't also toggle the surrounding collapsible-header button.
 */
function CreateActionsMenu({ group }: { group: NavGroup }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="inline-flex size-6 items-center justify-center text-sidebar-foreground/75 transition-colors hover:text-sidebar-foreground"
          aria-label={`Create in ${group.label}`}
        >
          <Plus className="size-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {(group.createActions ?? []).map((action) => (
          <DropdownMenuItem
            key={action.id}
            onSelect={(e) => {
              e.preventDefault();
              action.handler();
            }}
          >
            {action.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

interface SidebarViewProps {
  /** Display-only navigation override; the navigation registry remains intact. */
  groups?: NavGroup[];
  onNewConversation?: () => void;
  hideFooterActions?: boolean;
  hideNewConversation?: boolean;
  /** Compact rail shows group entry points instead of every child item. */
  collapsedGroupsOnly?: boolean;
  /** Place the primary action beneath a scope heading instead of above navigation. */
  newConversationAfterGroup?: string;
  newConversationLabel?: string;
}

function SidebarContent({
  collapsed,
  groups,
  onNewConversation,
  hideFooterActions,
  hideNewConversation,
  collapsedGroupsOnly,
  newConversationAfterGroup,
  newConversationLabel = "New chat",
}: SidebarViewProps & { collapsed: boolean }) {
  const toggle = useSidebarStore((s) => s.toggle);
  const defaultNewConversation = useNewConversation();
  const handleNewConversation = onNewConversation ?? defaultNewConversation;
  const rawNavConfig = useNavStore((s) => s.config);
  const navLoading = useNavStore((s) => s.navLoading);
  // Sort by `priority` descending so feature hooks can declare slot
  // intent (e.g. "Recents above Tasks") instead of relying on the
  // order in which addGroup() happened to be called. Stable sort: ties
  // preserve insertion order, so groups that don't set a priority keep
  // the legacy append-where-you-arrive behaviour.
  const navConfig = useMemo(
    () =>
      [...(groups ?? rawNavConfig)]
        .map((g, i) => ({ g, i, p: g.priority ?? 0 }))
        .sort((a, b) => b.p - a.p || a.i - b.i)
        .map(({ g }) => g),
    [rawNavConfig, groups],
  );
  // Show skeleton rows during the cold nav fetch — but only until the
  // integrator's primary dynamic group ("Workspaces") has been published.
  // Once it exists, real rows render even if a later phase (status dots) is
  // still resolving, so the skeleton never flashes over a populated tree.
  const hasWorkspacesGroup = navConfig.some(
    (group) => group.label === "Workspaces" || group.meta?.type === "spaces-workspaces",
  );
  const showNavSkeleton = navLoading && !hasWorkspacesGroup;
  const location = useLocation();
  const currentPage = location.pathname + location.search;
  const navContext = useAppStore((s) => s.navContext);
  useScrollActiveNavRow(currentPage, navConfig, collapsed);

  const preventNativeFileDrop = useCallback((e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
  }, []);

  if (collapsed) {
    return (
      <div className="flex flex-col items-center gap-1 py-3 flex-1">
        <TooltipIconButton tooltip="Expand sidebar" side="right" onClick={toggle}>
          <PanelLeftOpen className="size-5" />
        </TooltipIconButton>
        {!hideNewConversation && !collapsedGroupsOnly && (
          <TooltipIconButton
            tooltip={newConversationLabel}
            side="right"
            onClick={handleNewConversation}
          >
            <SquarePen className="size-4 text-sidebar-icon" />
          </TooltipIconButton>
        )}
        <div className="mt-4 flex w-full flex-col items-stretch gap-1">
          {/* `w-full` on this inner column makes children resolve to the
              rail width even though the outer rail uses `items-center`
              — that way the per-group `border-t` divider spans the
              full rail instead of just icon-column width. */}
          {/* Resolve each group's items first, drop the empties, THEN
              render — so the separator is keyed off visible-index
              (not array-index). Without this an empty group at idx 0
              would push a `border-t` onto whatever group renders first,
              giving the rail a stray divider above the very first icon. */}
          {collapsedGroupsOnly
            ? navConfig
                .filter(
                  (group) =>
                    !group.meta?.hideInCollapsedRail &&
                    (group.to || group.items.length > 0) &&
                    group.collapsedRail?.({ currentPage, navContextMeta: navContext.meta ?? {} })
                      .length !== 0,
                )
                .map((group) => {
                  const rail = group.collapsedRail?.({
                    currentPage,
                    navContextMeta: navContext.meta ?? {},
                  });
                  const active =
                    currentPage === group.to ||
                    group.items.some((item) => isInSubtree(currentPage, item)) ||
                    Boolean(rail?.some((item) => item.isActive));
                  const Icon =
                    group.icon ??
                    group.collapsedRail?.({ currentPage, navContextMeta: navContext.meta ?? {} })[0]
                      ?.icon ??
                    group.items[0]?.icon ??
                    Layers;
                  return group.to ? (
                    <CollapsedNavShortcut
                      key={group.label}
                      to={group.to}
                      label={group.label}
                      icon={Icon}
                      isActive={active}
                    />
                  ) : (
                    <TooltipIconButton
                      key={group.label}
                      tooltip={group.label}
                      side="right"
                      aria-label={`Open ${group.label}`}
                      aria-current={active ? "page" : undefined}
                      className={active ? ACTIVE_NAV_ROW_CLASS : undefined}
                      onClick={() => {
                        toggleGroupCollapsed(group.label, true);
                        toggle();
                      }}
                    >
                      <Icon className="size-4" />
                    </TooltipIconButton>
                  );
                })
            : navConfig
                .map((group, groupIndex) => {
                  // Modules with a non-flat collapsed rail (e.g. Spaces'
                  // "header + active workspace") supply `collapsedRail`; the
                  // shell stays module-agnostic.
                  const items = group.collapsedRail
                    ? group
                        .collapsedRail({
                          currentPage,
                          navContextMeta: navContext.meta ?? {},
                        })
                        .map((it) => ({
                          to: it.to,
                          label: it.label,
                          icon: it.icon,
                          isActive: it.isActive,
                        }))
                    : group.items.map((it) => ({
                        to: it.to,
                        label: it.label,
                        icon: it.icon,
                        isActive: isSelectedNavItem(currentPage, it),
                      }));
                  return { group, groupIndex, items };
                })
                .filter(({ items }) => items.length > 0)
                .map(({ group, groupIndex, items }, visibleIndex) => (
                  // Each non-first VISIBLE group gets a thin top border —
                  // visually separates groups (e.g. user Workspaces vs
                  // Admin) in the collapsed rail without changing the
                  // CollapsedRailItem shape. The wrapper itself is a centred
                  // column so icons stay aligned with the rail.
                  <div
                    key={`${group.label || ""}-${groupIndex}`}
                    className={cn(
                      "flex flex-col items-center gap-1",
                      visibleIndex > 0 && "mt-2 pt-2 border-t border-sidebar-border/40",
                    )}
                  >
                    {items.map(({ to, label, icon, isActive }) => (
                      <CollapsedNavShortcut
                        key={to}
                        to={to}
                        label={label}
                        icon={icon}
                        isActive={isActive}
                      />
                    ))}
                  </div>
                ))}
        </div>
      </div>
    );
  }

  const newConversationAction = (
    <div className="px-1 mb-0.5">
      <button
        type="button"
        onClick={handleNewConversation}
        className={cn(
          "flex items-center gap-2 w-full",
          "rounded-xl px-3 py-2 text-sm text-left",
          "text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70",
        )}
      >
        <SquarePen className="size-4 shrink-0 text-sidebar-icon" />
        {newConversationLabel}
      </button>
    </div>
  );

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div data-navigation-header className="flex items-center justify-between px-3 py-3">
        <NavLink to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
          <AppBrand
            iconClassName="text-primary"
            labelClassName="truncate text-sm font-semibold text-sidebar-foreground"
          />
        </NavLink>
        <TooltipIconButton tooltip="Collapse sidebar" side="right" onClick={toggle}>
          <PanelLeft className="size-5" />
        </TooltipIconButton>
      </div>

      {!hideNewConversation && !newConversationAfterGroup && newConversationAction}

      {/* ThreadIndicator removed — the active conversation's row in
          the Recents group is now the source of truth for "you're in a
          chat right now". A separate pulsing dot was redundant noise. */}

      {/* Navigation groups */}
      <nav
        className="flex-1 overflow-y-auto px-1 pb-16"
        onDragOverCapture={preventNativeFileDrop}
        onDropCapture={preventNativeFileDrop}
      >
        {navConfig.map((group) => (
          <Fragment key={group.label}>
            <NavGroupSection group={group} />
            {!hideNewConversation &&
              group.label === newConversationAfterGroup &&
              newConversationAction}
          </Fragment>
        ))}
        {showNavSkeleton && (
          <div className="space-y-1 px-1 pt-2" aria-hidden="true">
            {Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-7 mx-1 rounded-lg animate-pulse bg-sidebar-accent/40" />
            ))}
          </div>
        )}
      </nav>

      {/* Footer actions — registered by feature modules */}
      {!hideFooterActions && <SidebarFooterActions />}
    </div>
  );
}

function SidebarFooterActions() {
  const footerActions = useNavStore((s) => s.footerActions);
  if (footerActions.length === 0) return null;

  return (
    <div className="shrink-0 space-y-0.5 px-3 py-2">
      {footerActions.map((action) => (
        <button
          key={action.id}
          type="button"
          onClick={action.onToggle}
          className={cn(
            "w-full flex items-center gap-2 px-2 py-1.5 rounded-md",
            "text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground",
          )}
        >
          <span
            className={cn(
              "size-2 rounded-full border",
              action.active
                ? "border-sidebar-primary bg-sidebar-primary"
                : "border-sidebar-foreground/30",
            )}
          />
          {action.active ? (action.activeLabel ?? action.label) : action.label}
        </button>
      ))}
    </div>
  );
}

/** Mobile drawer overlay */
function MobileDrawer({ footer, ...view }: SidebarViewProps & { footer?: ReactNode }) {
  const isMobileOpen = useSidebarStore((s) => s.isMobileOpen);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const locationKey = useLocation().key;
  const previousLocationKey = useRef(locationKey);
  useEffect(() => {
    if (previousLocationKey.current !== locationKey) closeMobile();
    previousLocationKey.current = locationKey;
  }, [locationKey, closeMobile]);
  const isToolPanelOpen = useToolPanelStore((s) => s.isOpen);
  const width = useSidebarStore((s) => s.width);
  const drawerWidth = Math.min(
    width,
    typeof window !== "undefined" ? window.innerWidth - 24 : width,
  );

  // Close on Escape — but only if ToolPanel is not open (it has its own Escape handler)
  useEffect(() => {
    if (!isMobileOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isToolPanelOpen) {
        closeMobile();
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isMobileOpen, isToolPanelOpen, closeMobile]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-50 bg-black/50 transition-opacity duration-200",
          isMobileOpen ? "opacity-100" : "opacity-0 pointer-events-none",
        )}
        onClick={closeMobile}
        aria-hidden="true"
      />

      {/* Drawer */}
      <aside
        // Both surfaces mount at once (one hidden by CSS). This attribute is
        // the only stable way for a test or an E2E selector to say WHICH one
        // it means — they carry identical roles, labels and inner markup, and
        // each keeps its own expand/collapse state, so an unscoped query
        // silently mixes the two.
        data-sidebar-surface="mobile"
        className={cn(
          "fixed top-0 left-0 z-50 h-dvh",
          "flex flex-col",
          "border-r border-sidebar-border/60 bg-sidebar text-sidebar-foreground shadow-xl",
          "transition-transform duration-200 ease-in-out",
          isMobileOpen ? "translate-x-0" : "-translate-x-full",
        )}
        style={{ width: drawerWidth }}
        role="complementary"
        aria-label="Navigation sidebar"
      >
        <SidebarContent collapsed={false} {...view} />
        {footer}
      </aside>
    </>
  );
}

/** Desktop inline sidebar (expanded or collapsed rail) */
function DesktopSidebar({
  footer,
  collapsedFooter,
  ...view
}: SidebarViewProps & {
  footer?: ReactNode;
  collapsedFooter?: ReactNode;
}) {
  const isOpen = useSidebarStore((s) => s.isOpen);
  const width = useSidebarStore((s) => s.width);

  return (
    <aside
      data-sidebar-surface="desktop"
      data-sidebar-collapsed={!isOpen || undefined}
      className={cn(
        "group/sidebar relative hidden md:flex flex-col shrink-0",
        "h-full",
        "border-r border-sidebar-border/60 bg-sidebar text-sidebar-foreground",
        "transition-[width] duration-200 ease-in-out",
        "overflow-hidden",
      )}
      style={{ width: isOpen ? width : RAIL_WIDTH }}
      role="complementary"
      aria-label="Navigation sidebar"
    >
      <SidebarContent collapsed={!isOpen} {...view} />
      {isOpen ? footer : collapsedFooter}
      {isOpen && <SidebarResizeHandle />}
    </aside>
  );
}

export function Sidebar({
  footer,
  collapsedFooter,
  ...view
}: SidebarViewProps & { footer?: ReactNode; collapsedFooter?: ReactNode } = {}) {
  return (
    <>
      <MobileDrawer footer={footer} {...view} />
      <DesktopSidebar footer={footer} collapsedFooter={collapsedFooter} {...view} />
    </>
  );
}
