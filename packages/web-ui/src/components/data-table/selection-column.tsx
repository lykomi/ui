/** A leading checkbox column: header selects the page, cells select the row. */
import type { ColumnDef } from "@tanstack/react-table";
import { Checkbox } from "@lykomi/web-primitives";

export const SELECTION_COLUMN_ID = "__select";

export function selectionColumn<T>(): ColumnDef<T, unknown> {
  return {
    id: SELECTION_COLUMN_ID,
    size: 36,
    minSize: 36,
    maxSize: 36,
    enableSorting: false,
    enableResizing: false,
    enableHiding: false,
    enableGlobalFilter: false,
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected()
            ? true
            : table.getIsSomePageRowsSelected()
              ? "indeterminate"
              : false
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(Boolean(value))}
        aria-label="Select all"
        className="translate-y-0.5"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        disabled={!row.getCanSelect()}
        onCheckedChange={(value) => row.toggleSelected(Boolean(value))}
        aria-label="Select row"
        className="translate-y-0.5"
      />
    ),
    meta: { label: "Select", align: "center", headerClassName: "w-9 px-1", className: "w-9 px-1" },
  };
}
