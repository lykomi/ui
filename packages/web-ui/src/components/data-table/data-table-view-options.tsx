/** The "View" menu: toggle column visibility. */
import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button, cn } from "@iloveagents/foundry-web-primitives";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../../ui/dropdown-menu.tsx";
import { columnLabel } from "./facets.ts";

export interface DataTableViewOptionsProps<T> {
  table: Table<T>;
  className?: string;
}

export function DataTableViewOptions<T>({ table, className }: DataTableViewOptionsProps<T>) {
  const columns = table.getAllLeafColumns().filter((column) => column.getCanHide());
  if (!columns.length) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className={cn(
            "h-8 rounded-xl border-border/45 bg-background/65 shadow-none hover:bg-muted/26",
            className,
          )}
        >
          <Settings2 className="size-4" />
          View
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-xl border-border/45 bg-popover/95 shadow-lg"
      >
        <DropdownMenuLabel>Toggle columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
            onSelect={(event) => event.preventDefault()}
            className="capitalize"
          >
            {columnLabel(column)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
