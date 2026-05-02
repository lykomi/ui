import { useCallback, useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router";
import { Ellipsis, Layers, PanelLeft, PanelLeftOpen, SquarePen, ChevronRight, GripVertical, Plus, Upload } from "lucide-react";
import { cn } from "@iloveagents/foundry-web-primitives";
import {
  useSidebarStore,
  RAIL_WIDTH,
  SIDEBAR_MIN_WIDTH,
  SIDEBAR_MAX_WIDTH,
} from "../lib/sidebar-store.ts";
import { useToolPanelStore } from "../lib/tool-panel-store.ts";
import { useNewConversation } from "../lib/use-new-conversation.ts";
import { useNavStore } from "../lib/nav-store.ts";
import { useAppStore } from "../lib/app-store.ts";
import type { NavItem, NavItemDnd } from "../lib/nav-config.ts";
import { getContainerDropZoneLabel, hasAnyDropTarget, hasExternalFilesData } from "../lib/nav-dnd.ts";
import { TooltipIconButton } from "./tooltip-icon-button.tsx";
import { Button } from "@iloveagents/foundry-web-primitives";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "../ui/dropdown-menu.tsx";
import { AppBrand } from "./app-brand.tsx";

const ACTIVE_NAV_ROW_CLASS =
  "border border-transparent bg-sidebar-selected shadow-none";
const ACTIVE_NAV_TEXT_CLASS = "font-semibold text-sidebar-foreground";
const ACTIVE_NAV_ICON_CLASS = "text-primary";
const ACTIVE_NAV_BADGE_CLASS =
  "border border-sidebar-border bg-background/60 text-sidebar-foreground";
const NESTED_NAV_INDENTS = ["pl-5", "pl-7", "pl-9", "pl-11", "pl-13"] as const;

function getNestedNavIndent(depth: number) {
  return NESTED_NAV_INDENTS[depth] ?? NESTED_NAV_INDENTS[NESTED_NAV_INDENTS.length - 1];
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

  const hasExternalFiles = useCallback((e: React.DragEvent) => hasExternalFilesData(e.dataTransfer), []);

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
      const draggedData =
        isDropTarget && dndType ? e.dataTransfer.getData(dndType) : "";
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
        "mx-2 rounded-md transition-all overflow-hidden",
        isDragOver
          ? cn(
              "h-7 flex items-center justify-center gap-1",
              isFileDragOver
                ? "bg-primary/10 border border-dashed border-primary"
                : "bg-primary/10 border border-dashed border-primary/30",
            )
          : "h-1",
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
              className={cn("gap-2", action.destructive && "text-destructive focus:text-destructive")}
            >
              <action.icon className={cn("size-3.5", action.destructive ? "text-destructive" : "text-muted-foreground")} />
              <span>{action.label}</span>
            </DropdownMenuItem>
          </span>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NavRowControls({
  item,
  hasChildren,
  isExpanded,
  onToggleExpand,
}: {
  item: NavItem;
  hasChildren: boolean;
  isExpanded: boolean;
  onToggleExpand?: () => void;
}) {
  const isDisabled = item.disabled === true;
  const hasActions = !isDisabled && item.actions && item.actions.length > 0;

  return (
    <div className="absolute inset-y-0 right-1 flex items-center gap-1 px-1 opacity-0 translate-x-1 pointer-events-none transition-all group-hover:opacity-100 group-hover:translate-x-0 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:translate-x-0 group-focus-within:pointer-events-auto">
      {hasActions && <NavItemActions actions={item.actions!} />}
      {hasChildren && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onToggleExpand?.();
          }}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
          aria-label={isExpanded ? "Collapse" : "Expand"}
        >
          <ChevronRight className={cn("size-3.5 transition-transform", isExpanded && "rotate-90")} />
        </button>
      )}
    </div>
  );
}

/** Leaf nav item with optional drag-and-drop support via NavItem.dnd. */
function NavLeafItem({
  item,
  isActive,
  onClick,
  depthPl = getNestedNavIndent(0),
}: {
  item: NavItem;
  isActive: boolean;
  onClick: () => void;
  depthPl?: string;
}) {
  const isDisabled = item.disabled === true;
  const hasActions = !isDisabled && item.actions && item.actions.length > 0;
  const { draggableProps, dropTargetProps, isDragOver, isFileDragOver } = useNavItemDnd(item.dnd);

  // Items with actions use the group layout (button + action controls)
  if (hasActions) {
    return (
      <div
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
        {isFileDragOver && !isDisabled && (
          <Upload className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-primary pointer-events-none" />
        )}
        <button
          type="button"
          disabled={isDisabled}
          onClick={isDisabled ? undefined : onClick}
          className={cn(
            "flex items-center gap-2 flex-1 min-w-0 py-1.5 text-sm text-left",
            depthPl,
            "pr-3 transition-[padding] duration-150 group-hover:pr-10 group-focus-within:pr-10",
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
              isActive && !isDisabled ? ACTIVE_NAV_ICON_CLASS : "text-sidebar-foreground/60",
            )}
          />
          <span className="truncate">{item.label}</span>
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
        </button>
        <NavRowControls item={item} hasChildren={false} isExpanded={false} />
      </div>
    );
  }

  return (
    <button
      type="button"
      disabled={isDisabled}
      onClick={isDisabled ? undefined : onClick}
      {...(isDisabled ? {} : draggableProps)}
      {...(isDisabled ? {} : dropTargetProps)}
      className={cn(
        "relative flex items-center gap-2 w-full",
        "rounded-lg border border-transparent pr-3 py-1.5 text-sm text-left",
        depthPl,
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
      {isFileDragOver && !isDisabled && (
        <Upload className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-primary pointer-events-none" />
      )}
      <item.icon
        className={cn(
          "size-3.5 shrink-0",
          isActive && !isDisabled ? ACTIVE_NAV_ICON_CLASS : "text-sidebar-foreground/60",
        )}
      />
      <span className={cn("truncate", isActive && !isDisabled && ACTIVE_NAV_TEXT_CLASS)}>{item.label}</span>
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
  const currentPage = useAppStore((s) => s.currentPage);
  const setNavContext = useAppStore((s) => s.setNavContext);
  const navContext = useAppStore((s) => s.navContext);
  const isOnParent = currentPage === parentPath;
  const [activeLabel, setActiveLabel] = useState(items[0]?.label ?? "");
  const childDepthPl = getNestedNavIndent(depth);

  // Children with unique paths (e.g., SPACES documents) use URL matching;
  // children sharing the parent path (e.g., Documents sub-filters) use label matching.
  const allShareParent = items.every((c) => c.to === parentPath);

  return (
    <div>
      {items.map((child) => {
        const hasNestedChildren = child.children && child.children.length > 0;

        // Folders with children render as collapsible nested items
        if (hasNestedChildren) {
          return <NestedFolderItem key={child.to + child.label} item={child} depth={depth} />;
        }

        // Items sharing parent path use label matching (e.g., Documents sub-filters).
        // Items with unique paths use URL matching. Items whose path equals the
        // parent path (e.g., folders) are never highlighted on the parent page.
        const isActive = allShareParent
          ? isOnParent && activeLabel === child.label
          : child.to !== parentPath && currentPage === child.to;
        return (
          <NavLeafItem
            key={child.to + child.label}
            item={child}
            isActive={isActive}
            depthPl={childDepthPl}
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
  if (currentPage === item.to) return true;
  return item.children?.some((c) => isInSubtree(currentPage, c)) ?? false;
}

/** Nested folder with collapsible children (used inside SubNavItems). */
function NestedFolderItem({ item, depth }: { item: NavItem; depth: number }) {
  const navigate = useNavigate();
  const currentPage = useAppStore((s) => s.currentPage);
  const setNavContext = useAppStore((s) => s.setNavContext);
  const navContext = useAppStore((s) => s.navContext);
  const isInsideSubtree = isInSubtree(currentPage, item);
  const isActive = currentPage === item.to;
  const isAncestorActive = isInsideSubtree && !isActive;
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);
  const isExpanded = manualOverride ?? isInsideSubtree;
  const { draggableProps, dropTargetProps, isDragOver, isFileDragOver } = useNavItemDnd(item.dnd);
  const depthPl = getNestedNavIndent(depth);

  const isDisabled = item.disabled === true;

  return (
    <div {...(isDisabled ? {} : dropTargetProps)}>
      <div
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
        {isFileDragOver && !isDisabled && (
          <Upload className="absolute right-12 top-1/2 -translate-y-1/2 size-3.5 text-primary pointer-events-none" />
        )}
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => {
            if (isDisabled) return;
            setManualOverride(true);
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
            depthPl,
            "pr-3 py-1.5 text-sm text-left transition-[padding] duration-150 group-hover:pr-16 group-focus-within:pr-16",
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
                  : "text-sidebar-foreground/60",
            )}
          />
          <span className="truncate">{item.label}</span>
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
        </button>
        <NavRowControls
          item={item}
          hasChildren
          isExpanded={isExpanded}
          onToggleExpand={() => setManualOverride(!isExpanded)}
        />
      </div>
      {isExpanded && item.children && (
        <div>
          {item.children.map((child) => {
            const hasNestedChildren = child.children && child.children.length > 0;
            if (hasNestedChildren) {
              return (
                <NestedFolderItem key={child.to + child.label} item={child} depth={depth + 1} />
              );
            }
            const isChildActive = currentPage === child.to;
            return (
              <NavLeafItem
                key={child.to + child.label}
                item={child}
                isActive={isChildActive}
                depthPl={getNestedNavIndent(depth + 1)}
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

function CollapsibleNavItem({ item }: { item: NavItem }) {
  const navigate = useNavigate();
  const currentPage = useAppStore((s) => s.currentPage);
  const setNavContext = useAppStore((s) => s.setNavContext);
  const navContext = useAppStore((s) => s.navContext);
  const isInsideSubtree = isInSubtree(currentPage, item);
  const isActive = currentPage === item.to;
  const isAncestorActive = isInsideSubtree && !isActive;
  const [manualOverride, setManualOverride] = useState<boolean | null>(null);
  const isExpanded = manualOverride ?? isInsideSubtree;
  const hasChildren = item.children && item.children.length > 0;
  const isDisabled = item.disabled === true;
  const hasActions = !isDisabled && item.actions && item.actions.length > 0;
  const { draggableProps, dropTargetProps, isDragOver, isFileDragOver } = useNavItemDnd(item.dnd);

  if (hasChildren || hasActions) {
    const inner = (selected: boolean, ancestor: boolean) => (
      <div
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
        {isFileDragOver && !isDisabled && (
          <Upload className="absolute right-12 top-1/2 -translate-y-1/2 size-3.5 text-primary pointer-events-none" />
        )}
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
            if (hasChildren) setManualOverride(true);
            navigate(item.to);
          }}
          className={cn(
            "flex items-center gap-2 flex-1 min-w-0 px-3 py-2 text-sm text-left",
            "pr-3 transition-[padding] duration-150 group-hover:pr-16 group-focus-within:pr-16",
            isDisabled
              ? "text-sidebar-foreground/45 cursor-default"
              : selected
                ? ACTIVE_NAV_TEXT_CLASS
                : ancestor
                  ? "text-sidebar-foreground font-medium"
                  : "text-sidebar-foreground/85",
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
                  : "text-sidebar-foreground/60",
            )}
          />
          <span className="truncate">{item.label}</span>
          {item.badge && (
            <span
              className={cn(
                "shrink-0 rounded px-1 py-0.5 text-[10px] font-medium",
                selected ? ACTIVE_NAV_BADGE_CLASS : "bg-sidebar-accent text-sidebar-accent-foreground",
              )}
            >
              {item.badge}
            </span>
          )}
        </button>
        <NavRowControls
          item={item}
          hasChildren={Boolean(hasChildren)}
          isExpanded={Boolean(isExpanded)}
          onToggleExpand={hasChildren ? () => setManualOverride(!isExpanded) : undefined}
        />
      </div>
    );

    return (
      <div {...(isDisabled ? {} : dropTargetProps)} {...(isDisabled ? {} : draggableProps)}>
        {inner(isActive, isAncestorActive)}
        {hasChildren && isExpanded && (
          <>
            <SubNavItems items={item.children!} parentPath={item.to} />
            {item.dnd?.canDrop() && <ContainerDropZone dnd={item.dnd} />}
          </>
        )}
      </div>
    );
  }

  if (isDisabled) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 w-full opacity-40",
          "rounded-lg px-3 py-2 text-left text-sm text-sidebar-foreground/45",
        )}
      >
        <item.icon className="size-4 shrink-0 text-sidebar-foreground/45" />
        <span className="truncate">{item.label}</span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      {...draggableProps}
      {...dropTargetProps}
      className={({ isActive }) =>
        cn(
          "relative flex items-center gap-2 w-full",
          "rounded-xl px-3 py-2 text-sm text-left",
          "text-sidebar-foreground/85 transition-colors hover:bg-sidebar-accent/70",
          isActive && cn(ACTIVE_NAV_ROW_CLASS, ACTIVE_NAV_TEXT_CLASS),
          isDragOver &&
            !isFileDragOver &&
            "bg-sidebar-selected ring-2 ring-inset ring-sidebar-ring/50",
          isFileDragOver && "outline-dashed outline-2 -outline-offset-2 outline-primary bg-primary/10",
          item.dimmed && "opacity-50",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isFileDragOver && (
            <Upload className="absolute right-2 top-1/2 -translate-y-1/2 size-3.5 text-primary pointer-events-none" />
          )}
          <item.icon
            className={cn(
              "size-4 shrink-0",
              isActive ? ACTIVE_NAV_ICON_CLASS : "text-sidebar-foreground/60",
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
          setWidth(width - 16);
        }
        if (event.key === "ArrowRight") {
          event.preventDefault();
          setWidth(width + 16);
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

function ThreadIndicator() {
  const threadActive = useAppStore((s) => s.threadActive);
  if (!threadActive) return null;

  return (
    <div className="px-4 pb-2 flex items-center gap-2">
      <span className="text-xs text-muted-foreground">Active thread</span>
      <div className="size-1.5 rounded-full bg-primary animate-pulse" />
    </div>
  );
}

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
        className={cn(isActive && "border border-transparent bg-sidebar-selected text-sidebar-foreground")}
      >
        <Icon className={cn("size-4", isActive && "text-primary")} />
      </TooltipIconButton>
    </NavLink>
  );
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const toggle = useSidebarStore((s) => s.toggle);
  const handleNewConversation = useNewConversation();
  const navConfig = useNavStore((s) => s.config);
  const currentPage = useAppStore((s) => s.currentPage);
  const navContext = useAppStore((s) => s.navContext);

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
        <TooltipIconButton tooltip="New Thread" side="right" onClick={handleNewConversation}>
          <SquarePen className="size-4" />
        </TooltipIconButton>
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
          {navConfig
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
                    isActive: currentPage === it.to,
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

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-3">
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

      {/* New Thread */}
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
          <SquarePen className="size-4 shrink-0 text-sidebar-foreground/60" />
          New Thread
        </button>
      </div>

      <ThreadIndicator />

      {/* Navigation groups */}
      <nav
        className="flex-1 overflow-y-auto px-1 pb-16"
        onDragOverCapture={preventNativeFileDrop}
        onDropCapture={preventNativeFileDrop}
      >
        {navConfig.map((group) => (
          <div key={group.label}>
            {!group.hideLabel && (
              <div className="px-3 py-2">
                {group.to ? (
                  <div className="flex items-center justify-between rounded-lg py-1.5 transition-colors hover:bg-sidebar-accent/70">
                    <NavLink to={group.to} end className="min-w-0 flex-1">
                      {({ isActive }) => (
                        <span
                          className={cn(
                            "block text-xs font-medium uppercase tracking-wider",
                            isActive
                              ? "text-sidebar-selected-foreground"
                              : "text-sidebar-foreground/65 hover:text-sidebar-foreground",
                          )}
                        >
                          {group.label}
                        </span>
                      )}
                    </NavLink>
                    {group.createActions && group.createActions.length > 0 && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex size-6 items-center justify-center text-sidebar-foreground/65 transition-colors hover:text-sidebar-foreground"
                            aria-label={`Create in ${group.label}`}
                          >
                            <Plus className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          {group.createActions.map((action) => (
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
                    )}
                  </div>
                ) : (
                  <span className="text-xs font-medium uppercase tracking-wider text-sidebar-foreground/65">
                    {group.label}
                  </span>
                )}
              </div>
            )}
            {group.items.map((item) => (
              <CollapsibleNavItem key={item.to + item.label} item={item} />
            ))}
          </div>
        ))}
      </nav>

      {/* Footer actions — registered by feature modules */}
      <SidebarFooterActions />
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
function MobileDrawer() {
  const isMobileOpen = useSidebarStore((s) => s.isMobileOpen);
  const closeMobile = useSidebarStore((s) => s.closeMobile);
  const isToolPanelOpen = useToolPanelStore((s) => s.isOpen);
  const width = useSidebarStore((s) => s.width);
  const drawerWidth = Math.min(width, typeof window !== "undefined" ? window.innerWidth - 24 : width);

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
        <SidebarContent collapsed={false} />
      </aside>
    </>
  );
}

/** Desktop inline sidebar (expanded or collapsed rail) */
function DesktopSidebar() {
  const isOpen = useSidebarStore((s) => s.isOpen);
  const width = useSidebarStore((s) => s.width);

  return (
    <aside
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
      <SidebarContent collapsed={!isOpen} />
      {isOpen && <SidebarResizeHandle />}
    </aside>
  );
}

export function Sidebar() {
  return (
    <>
      <MobileDrawer />
      <DesktopSidebar />
    </>
  );
}
