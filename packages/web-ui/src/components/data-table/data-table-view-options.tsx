/** The "Columns" menu: toggle column visibility. */
import type { Table } from "@tanstack/react-table";
import { Settings2 } from "lucide-react";
import { Button } from "@lykomi/web-primitives";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuItem,
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
  const resizable = table.getAllLeafColumns().some((column) => column.getCanResize());
  if (!columns.length && !resizable) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="outline" size="sm" className={className}>
          <Settings2 className="size-4" />
          Columns
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 rounded-xl border-border/45 bg-popover/95 shadow-lg"
      >
        <DropdownMenuLabel>Show columns</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {resizable && (
          <DropdownMenuItem onSelect={() => table.resetColumnSizing()}>
            Reset column widths
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        {columns.map((column) => (
          <DropdownMenuCheckboxItem
            key={column.id}
            checked={column.getIsVisible()}
            onCheckedChange={(checked) => column.toggleVisibility(Boolean(checked))}
            onSelect={(event) => event.preventDefault()}
          >
            {columnLabel(column)}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
