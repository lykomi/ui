import * as React from "react";

import { cn } from "@lykomi/web-primitives";

/**
 * The frame every dashboard chart sits in, and the bento grid that lays the
 * frames out. A shared frame is what makes a dashboard read as one surface:
 * the same header anatomy, the same padding, the same border on every tile,
 * so only the DATA differs from card to card.
 */
export interface ChartCardProps extends Omit<React.ComponentProps<"div">, "title"> {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Right-aligned header slot (a select, a toggle, a menu). */
  action?: React.ReactNode;
  footer?: React.ReactNode;
}

const ChartCard = React.forwardRef<HTMLDivElement, ChartCardProps>(
  ({ title, description, action, footer, className, children, ...props }, ref) => (
    <div
      ref={ref}
      data-chart-card=""
      className={cn(
        "flex min-w-0 flex-col rounded-xl border border-border bg-card p-4 text-card-foreground",
        className,
      )}
      {...props}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-semibold">{title}</h3>
          {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
        </div>
        {action && <div className="flex shrink-0 items-center gap-1.5">{action}</div>}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
      {footer && (
        <div className="mt-3 border-t border-border pt-2 text-xs text-muted-foreground">
          {footer}
        </div>
      )}
    </div>
  ),
);
ChartCard.displayName = "ChartCard";

export interface DashboardGridProps extends React.ComponentProps<"div"> {
  /** Columns at the desktop breakpoint (1–4). Tiles span via `DashboardTile`. */
  columns?: 1 | 2 | 3 | 4;
}

const GRID_COLUMNS: Record<NonNullable<DashboardGridProps["columns"]>, string> = {
  1: "lg:grid-cols-1",
  2: "lg:grid-cols-2",
  3: "lg:grid-cols-3",
  4: "lg:grid-cols-4",
};

/** Mobile-first: one column on small screens, `columns` from `lg:` up. */
const DashboardGrid = React.forwardRef<HTMLDivElement, DashboardGridProps>(
  ({ columns = 3, className, ...props }, ref) => (
    <div
      ref={ref}
      data-dashboard-grid=""
      className={cn("grid grid-cols-1 gap-4", GRID_COLUMNS[columns], className)}
      {...props}
    />
  ),
);
DashboardGrid.displayName = "DashboardGrid";

export interface DashboardTileProps extends React.ComponentProps<"div"> {
  /** How many grid columns this tile spans at the desktop breakpoint. */
  span?: 1 | 2 | 3 | 4;
}

const TILE_SPANS: Record<NonNullable<DashboardTileProps["span"]>, string> = {
  1: "lg:col-span-1",
  2: "lg:col-span-2",
  3: "lg:col-span-3",
  4: "lg:col-span-4",
};

const DashboardTile = React.forwardRef<HTMLDivElement, DashboardTileProps>(
  ({ span = 1, className, ...props }, ref) => (
    <div ref={ref} className={cn("min-w-0", TILE_SPANS[span], className)} {...props} />
  ),
);
DashboardTile.displayName = "DashboardTile";

export { ChartCard, DashboardGrid, DashboardTile };
