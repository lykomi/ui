import { useMemo, useRef, useState } from "react";
import { Check, Trash2 } from "lucide-react";
import { Button } from "@lykomi/web-primitives";
import {
  ConfirmDialog,
  DataTable,
  DataTableColumnHeader,
  DataTableFrame,
  DataTableRowActions,
  DataTableSelectionBar,
  DataTableToolbar,
  EMPTY_DATA_TABLE_STATE,
  selectionColumn,
  useDataTable,
  useDataTableActions,
  type DataTableState,
} from "@lykomi/web-ui";
import { useTaskContext } from "./use-task-context.ts";
import { createTasks, queryTasks, type GardenTask } from "./table-model.ts";

export function TableExample() {
  const [tasks, setTasks] = useState(createTasks);
  const [state, setState] = useState<DataTableState>(EMPTY_DATA_TABLE_STATE);
  const [renderedColumns, setRenderedColumns] = useState<string[]>([]);
  const queryKey = JSON.stringify([state.globalFilter, state.columnFilters, state.sorting]);
  const queryRef = useRef(queryKey);
  queryRef.current = queryKey;
  const [batch, setBatch] = useState({ key: queryKey, count: 20 });
  const limit = batch.key === queryKey ? batch.count : 20;
  const matches = useMemo(() => queryTasks(tasks, state), [tasks, state]);
  const loaded = useMemo(() => matches.slice(0, limit), [matches, limit]);
  const table = useDataTable({
    data: loaded,
    getRowId: (row) => row.id,
    enableRowSelection: true,
    state,
    onStateChange: (next) => {
      const changedQuery =
        JSON.stringify([next.globalFilter, next.columnFilters, next.sorting]) !== queryKey;
      setState(changedQuery ? { ...next, rowSelection: {} } : next);
    },
    manualFiltering: true,
    manualSorting: true,
    columns: [
      selectionColumn<GardenTask>(),
      {
        accessorKey: "name",
        header: ({ column }) => <DataTableColumnHeader column={column} title="Task" />,
        size: 280,
        meta: { label: "Task" },
      },
      { accessorKey: "status", header: "Status", size: 140, meta: { label: "Status" } },
      {
        accessorKey: "owner",
        header: "Owner",
        size: 100,
        meta: { label: "Owner", breakpoint: "lg" },
      },
      {
        id: "__actions",
        header: "",
        size: 48,
        minSize: 48,
        maxSize: 48,
        enableHiding: false,
        enableSorting: false,
        enableResizing: false,
        cell: ({ row }) => (
          <DataTableRowActions
            label={`Actions for ${row.original.name}`}
            actions={actions.forRows([row.id])}
          />
        ),
      },
    ],
  });
  const actions = useDataTableActions({
    table,
    itemLabel: "task",
    actions: [
      {
        id: "complete",
        label: "Mark complete",
        icon: Check,
        isAvailable: (rows) => rows.some((row) => row.status !== "Complete"),
        execute: (rows) => {
          const ids = new Set(rows.map((row) => row.id));
          setTasks((all) =>
            all.map((row) => (ids.has(row.id) ? { ...row, status: "Complete" } : row)),
          );
        },
      },
      {
        id: "delete",
        label: "Delete",
        icon: Trash2,
        destructive: true,
        execute: (rows) => {
          const ids = new Set(rows.map((row) => row.id));
          setTasks((all) => all.filter((row) => !ids.has(row.id)));
          table.setRowSelection((selection) =>
            Object.fromEntries(Object.entries(selection).filter(([id]) => !ids.has(id))),
          );
        },
      },
    ],
  });
  const statusCounts = queryTasks(tasks, {
    ...state,
    columnFilters: state.columnFilters.filter((filter) => filter.id !== "status"),
  }).reduce(
    (counts, row) => counts.set(row.status, (counts.get(row.status) ?? 0) + 1),
    new Map<string, number>(),
  );
  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.id);
  useTaskContext(table, actions, tasks, state, renderedColumns, matches.length);
  return (
    <DataTableFrame aria-label="Garden tasks" className="min-w-0 space-y-4">
      <div>
        <h2 className="text-lg font-semibold">A shared plan</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Scroll to load more. Select tasks or open a row menu to act. This example changes only
          local data.
        </p>
      </div>
      <DataTableToolbar
        table={table}
        searchPlaceholder="Search garden tasks…"
        facets={[{ columnId: "status", title: "Status", counts: statusCounts }]}
        selectionBar={
          <DataTableSelectionBar table={table} label="task">
            {actions.forRows(selectedIds).map((action) => (
              <Button
                key={action.label}
                size="sm"
                variant="ghost"
                disabled={action.disabled}
                onClick={action.onSelect}
                className={action.destructive ? "text-destructive" : undefined}
              >
                {action.icon ? <action.icon className="size-4" /> : null}
                {action.label}
              </Button>
            ))}
          </DataTableSelectionBar>
        }
      />
      {actions.error ? (
        <p role="alert" className="text-sm text-destructive">
          {actions.error}
        </p>
      ) : null}
      <DataTable
        table={table}
        aria-label="Garden tasks"
        onRenderedColumnsChange={setRenderedColumns}
        onRowClick={(row) => row.toggleSelected()}
        maxHeight="24rem"
        fitViewport={false}
        stableHeight={false}
        spacer={false}
        loadMore={{
          hasMore: loaded.length < matches.length,
          resetKey: queryKey,
          onLoadMore: async () => {
            await new Promise((resolve) => setTimeout(resolve, 250));
            if (queryRef.current === queryKey) setBatch({ key: queryKey, count: limit + 20 });
          },
        }}
      />
      <p role="status" className="text-xs text-muted-foreground">
        {loaded.length} of {matches.length} matching tasks loaded · {selectedIds.length} selected
      </p>
      <ConfirmDialog
        {...actions.confirmation}
        description="This removes the selected tasks from this browser example. No remote data is changed."
      />
    </DataTableFrame>
  );
}
