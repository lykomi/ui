import { useEffect } from "react";
import {
  useAppStore,
  usePageTools,
  type useDataTable,
  type useDataTableActions,
  type DataTableState,
} from "@lykomi/web-ui";
import { queryTasks, type GardenTask } from "./table-model.ts";

export function useTaskContext(
  table: ReturnType<typeof useDataTable<GardenTask>>,
  actions: ReturnType<typeof useDataTableActions<GardenTask>>,
  tasks: GardenTask[],
  state: DataTableState,
  renderedColumns: string[],
  matchingCount: number,
) {
  const selectedIds = table.getSelectedRowModel().rows.map((row) => row.id);
  const visibleColumns = renderedColumns.filter((id) => !id.startsWith("__"));
  const context = JSON.stringify({
    columns: visibleColumns,
    rows: table.getRowModel().rows.map((row) => ({
      id: row.id,
      ...Object.fromEntries(visibleColumns.map((id) => [id, row.getValue(id)])),
    })),
    selectedIds,
    search: state.globalFilter,
    filters: state.columnFilters,
    sorting: state.sorting,
    loadedCount: table.options.data.length,
    matchingCount: matchingCount,
    hasMore: table.options.data.length < matchingCount,
    actions: [
      { id: "complete", label: "Mark complete" },
      { id: "delete", label: "Delete", requiresConfirmation: true },
    ],
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
      description: "Search all example tasks and show the first matching batch.",
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
          matchingCount: queryTasks(tasks, { ...state, globalFilter: args.search }).length,
        });
      },
    },
    {
      name: "page_task_action",
      description:
        "Run a registered action on loaded task IDs. Delete opens a confirmation dialog and waits for the person. All changes affect this local example only.",
      parameters: {
        type: "object",
        properties: {
          action: { type: "string", enum: ["complete", "delete"] },
          ids: { type: "array", items: { type: "string" }, minItems: 1, maxItems: 120 },
        },
        required: ["action", "ids"],
        additionalProperties: false,
      },
      execute: async (json) => {
        let args: { action?: unknown; ids?: unknown };
        try {
          args = JSON.parse(json);
        } catch {
          return JSON.stringify({ error: "Invalid JSON." });
        }
        if (
          !args ||
          typeof args.action !== "string" ||
          !Array.isArray(args.ids) ||
          args.ids.length > 120 ||
          !args.ids.every((id) => typeof id === "string")
        )
          return JSON.stringify({ error: "Supply an action and loaded task IDs." });
        return JSON.stringify(await actions.run(args.action, args.ids));
      },
    },
  ]);
}
