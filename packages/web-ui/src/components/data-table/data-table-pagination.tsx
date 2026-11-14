/** Selection summary, rows-per-page, page x of y, first/prev/next/last. */
import type { Table } from "@tanstack/react-table";
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";
import { Button, cn } from "@lykomi/web-primitives";
import { Select } from "../../ui/select.tsx";

export interface DataTablePaginationProps<T> {
  table: Table<T>;
  pageSizeOptions?: number[];
  className?: string;
}

export function DataTablePagination<T>({
  table,
  pageSizeOptions = [10, 20, 50, 100],
  className,
}: DataTablePaginationProps<T>) {
  const total = table.getFilteredRowModel().rows.length;
  const selected = table.getFilteredSelectedRowModel().rows.length;
  const { pageIndex, pageSize } = table.getState().pagination;
  const pageCount = Math.max(1, table.getPageCount());
  const sizes = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);
  const iconButton =
    "size-8 rounded-lg border-border/45 bg-background/65 p-0 shadow-none hover:bg-muted/26";
  return (
    <div
      data-table-footer=""
      data-table-pagination=""
      className={cn("flex flex-wrap items-center gap-x-6 gap-y-2 text-sm", className)}
    >
      <div className="flex-1 text-muted-foreground" aria-live="polite">
        {selected > 0 ? `${selected} of ${total} row(s) selected.` : `${total} row(s)`}
      </div>
      <label className="flex items-center gap-2">
        <span className="font-medium">Rows per page</span>
        <Select
          value={pageSize}
          onChange={(event) => table.setPageSize(Number(event.target.value))}
          className="h-8 w-[4.5rem] rounded-lg px-2 py-0"
        >
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Select>
      </label>
      <div className="font-medium">
        Page {pageIndex + 1} of {pageCount}
      </div>
      <div className="flex items-center gap-1.5">
        <Button
          type="button"
          variant="outline"
          className={cn(iconButton, "hidden lg:inline-flex")}
          onClick={() => table.setPageIndex(0)}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to first page</span>
          <ChevronsLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className={iconButton}
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          <span className="sr-only">Go to previous page</span>
          <ChevronLeft className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className={iconButton}
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to next page</span>
          <ChevronRight className="size-4" />
        </Button>
        <Button
          type="button"
          variant="outline"
          className={cn(iconButton, "hidden lg:inline-flex")}
          onClick={() => table.setPageIndex(pageCount - 1)}
          disabled={!table.getCanNextPage()}
        >
          <span className="sr-only">Go to last page</span>
          <ChevronsRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}
