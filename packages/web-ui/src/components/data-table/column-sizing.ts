import type { Column } from "@tanstack/react-table";

/** TanStack's unbounded default is not a useful End-key destination. */
export function columnSizingBounds<T>(column: Column<T, unknown>) {
  const minimum = column.columnDef.minSize ?? 80;
  const declaredMaximum = column.columnDef.maxSize;
  const maximum = Math.max(
    minimum,
    declaredMaximum === undefined || declaredMaximum === Number.MAX_SAFE_INTEGER
      ? 1200
      : declaredMaximum,
  );
  return { minimum, maximum };
}

export function boundedColumnWidth<T>(column: Column<T, unknown>, width: number) {
  const { minimum, maximum } = columnSizingBounds(column);
  return Math.max(minimum, Math.min(maximum, width));
}
