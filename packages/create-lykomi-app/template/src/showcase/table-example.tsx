import { useEffect, useState } from "react";
import {
  DataTable,
  DataTableColumnHeader,
  DataTableFrame,
  DataTablePagination,
  DataTableSelectionBar,
  DataTableToolbar,
  facetFilterFn,
  selectionColumn,
  useDataTable,
  useAppStore,
  usePageTools,
} from "@lykomi/web-ui";

const tasks = [
  { id: "t1", name: "Choose a garden site", status: "Ready", owner: "Alex" },
  { id: "t2", name: "Gather planting ideas", status: "In progress", owner: "Sam" },
  { id: "t3", name: "Plan shared watering", status: "Ready", owner: "Mika" },
  { id: "t4", name: "Check access to water", status: "Blocked", owner: "Alex" },
  { id: "t5", name: "Invite neighbors", status: "Complete", owner: "Sam" },
  { id: "t6", name: "Estimate supply costs", status: "Ready", owner: "Mika" },
];

export function TableExample() {
  const [renderedColumns, setRenderedColumns] = useState<string[]>([]);
  const table = useDataTable({
    data: tasks,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    pageSize: 5,
    columns: [
      selectionColumn<(typeof tasks)[number]>(),
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Task" />,
        size: 280,
        meta: { label: "Task" },
      },
      {
        accessorKey: "status",
        header: "Status",
        size: 140,
        filterFn: facetFilterFn,
        meta: { label: "Status" },
      },
      {
        accessorKey: "owner",
        header: "Owner",
        size: 100,
        meta: { label: "Owner", breakpoint: "lg" },
      },
    ],
  });
  const visibleColumns = renderedColumns.filter((id) => id !== "__select");
  const rows = table.getRowModel().rows.map((row) => ({
    id: row.id,
    ...Object.fromEntries(visibleColumns.map((id) => [id, row.getValue(id)])),
  }));
  const selection = table.getSelectedRowModel().rows.map((row) => row.id);
  const context = JSON.stringify({
    columns: visibleColumns,
    rows,
    selectedIds: selection,
    search: table.getState().globalFilter,
    filters: table.getState().columnFilters,
    sorting: table.getState().sorting,
    page: table.getState().pagination.pageIndex + 1,
    matchingCount: table.getFilteredRowModel().rows.length,
  });
  useEffect(() => {
    useAppStore.getState().setContextItem("showcase-table", {
      type: "ref",
      label: "Garden tasks",
      sourcePage: "/showcase/collections",
      persistence: "ephemeral",
      payload: { kind: "ref", refType: "table", refId: "garden-tasks", meta: JSON.parse(context) },
    });
  }, [context]);
  useEffect(() => () => useAppStore.getState().setContextItem("showcase-table", null), []);
  usePageTools([
    {
      name: "page_filter_tasks",
      description:
        "Filter the example task table by a search phrase. Changes the visible table only; does not modify task records.",
      parameters: {
        type: "object",
        properties: { search: { type: "string", maxLength: 100 } },
        required: ["search"],
        additionalProperties: false,
      },
      execute: async (json) => {
        let args: { search?: unknown };
        try {
          args = JSON.parse(json);
        } catch {
          return JSON.stringify({ error: "Invalid JSON." });
        }
        if (!args || typeof args.search !== "string" || args.search.length > 100)
          return JSON.stringify({ error: "Supply a search phrase of at most 100 characters." });
        table.setGlobalFilter(args.search);
        return JSON.stringify({
          search: args.search,
          matchingCount: table.getFilteredRowModel().rows.length,
        });
      },
    },
  ]);
  return (
    <DataTableFrame aria-label="Garden tasks" className="min-w-0 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">A shared plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Search, filter or select tasks. Context follows the rendered columns and the current page.
        </p>
      </div>
      <DataTableToolbar
        table={table}
        searchPlaceholder="Search garden tasks…"
        facets={[{ columnId: "status", title: "Status" }]}
        selectionBar={<DataTableSelectionBar table={table} label="task" />}
      />
      <DataTable
        table={table}
        aria-label="Garden tasks"
        onRenderedColumnsChange={setRenderedColumns}
        onRowClick={(row) => row.toggleSelected()}
        maxHeight="24rem"
      />
      <DataTablePagination table={table} />
    </DataTableFrame>
  );
}
