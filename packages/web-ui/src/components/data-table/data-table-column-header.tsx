/** Sortable column header with an asc / desc / hide menu. */
import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ChevronsUpDown, EyeOff } from "lucide-react";
import { Button, cn } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu.tsx";

export interface DataTableColumnHeaderProps<T> {
  column: Column<T, unknown>;
  title: string;
  className?: string;
}

export function DataTableColumnHeader<T>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<T>) {
  if (!column.getCanSort()) {
    return <div className={cn("font-medium", className)}>{title}</div>;
  }
  const sorted = column.getIsSorted();
  const align = column.columnDef.meta?.align;
  return (
    <div className={cn("flex min-w-0 items-center", align === "right" && "justify-end", className)}>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-label={`${title}: ${sorted === "asc" ? "sorted ascending" : sorted === "desc" ? "sorted descending" : "not sorted"}`}
            title={title}
            data-sorted={sorted || undefined}
            className="h-8 min-w-0 max-w-full gap-1.5 rounded-lg px-2 text-xs font-medium text-muted-foreground data-[state=open]:bg-accent data-[sorted]:text-foreground"
          >
            <span className="truncate">{title}</span>
            {sorted === "desc" ? (
              <ArrowDown className="size-3.5" />
            ) : sorted === "asc" ? (
              <ArrowUp className="size-3.5" />
            ) : (
              <ChevronsUpDown className="size-3.5 opacity-60" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="rounded-xl border-border/45 bg-popover/95 shadow-lg"
        >
          <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
            <ArrowUp className="size-3.5 text-muted-foreground" />
            Asc
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
            <ArrowDown className="size-3.5 text-muted-foreground" />
            Desc
          </DropdownMenuItem>
          {sorted ? (
            <DropdownMenuItem onClick={() => column.clearSorting()}>
              <ChevronsUpDown className="size-3.5 text-muted-foreground" />
              Unsorted
            </DropdownMenuItem>
          ) : null}
          {column.getCanHide() ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => column.toggleVisibility(false)}>
                <EyeOff className="size-3.5 text-muted-foreground" />
                Hide
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
