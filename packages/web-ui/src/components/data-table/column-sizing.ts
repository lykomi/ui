import type { Column, ColumnSizingState } from "@tanstack/react-table";

export const DEFAULT_COLUMN_MIN_SIZE = 80;
export const DEFAULT_COLUMN_MAX_SIZE = 1200;

/** TanStack's unbounded default is not a useful End-key destination. */
export function columnSizingBounds<T>(column: Column<T, unknown>) {
  const minimum = column.columnDef.minSize ?? DEFAULT_COLUMN_MIN_SIZE;
  const declaredMaximum = column.columnDef.maxSize;
  const maximum = Math.max(
    minimum,
    declaredMaximum === undefined || declaredMaximum === Number.MAX_SAFE_INTEGER
      ? DEFAULT_COLUMN_MAX_SIZE
      : declaredMaximum,
  );
  return { minimum, maximum };
}

export function boundedColumnWidth<T>(column: Column<T, unknown>, width: number) {
  const { minimum, maximum } = columnSizingBounds(column);
  return Math.max(minimum, Math.min(maximum, width));
}

/** Size only rendered tracks; responsive visibility and persisted user widths stay separate. */
export function renderedColumnWidths<T>(
  columns: Column<T, unknown>[],
  userWidths: ColumnSizingState,
  availableWidth: number,
  spacer: boolean,
) {
  const sizes = new Map(
    columns.map((column) => [column.id, boundedColumnWidth(column, column.getSize())]),
  );
  const optedIn = columns.filter((column) => {
    const grow = column.columnDef.meta?.grow;
    return typeof grow === "number" && Number.isFinite(grow) && grow > 0;
  });
  let remaining = availableWidth - [...sizes.values()].reduce((sum, size) => sum + size, 0);
  let growing = optedIn.filter(
    (column) => !Object.prototype.hasOwnProperty.call(userWidths, column.id),
  );
  // Redistribute space left by a capped column to the other eligible columns.
  while (remaining > 0.01 && growing.length) {
    const scale = Math.max(...growing.map((column) => column.columnDef.meta!.grow!));
    const weight = growing.reduce((sum, column) => sum + column.columnDef.meta!.grow! / scale, 0);
    let used = 0;
    for (const column of growing) {
      const before = sizes.get(column.id)!;
      const next = boundedColumnWidth(
        column,
        before + (remaining * (column.columnDef.meta!.grow! / scale)) / weight,
      );
      sizes.set(column.id, next);
      used += next - before;
    }
    if (used <= 0.01) break;
    remaining -= used;
    growing = growing.filter(
      (column) => sizes.get(column.id)! < columnSizingBounds(column).maximum,
    );
  }
  // Legacy fill behavior remains for tables that have not declared growth.
  if (!spacer && !optedIn.length && remaining > 0) {
    const first =
      columns.find((column) => column.accessorFn && column.getCanResize()) ??
      columns.find((column) => column.id !== "__select" && column.getCanResize());
    if (first && !Object.prototype.hasOwnProperty.call(userWidths, first.id))
      sizes.set(first.id, boundedColumnWidth(first, sizes.get(first.id)! + remaining));
  }
  return sizes;
}
