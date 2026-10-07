import type { Column } from "@tanstack/react-table";

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
