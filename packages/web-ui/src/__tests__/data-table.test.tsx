/**
 * DataTable semantics that every list on top of it relies on: facet keys
 * (arrays, empties), OR-within / AND-across filtering, counts that exclude
 * the facet's own filter, AND-of-tokens search, URL round-trips, grouping
 * order, and the toolbar's Reset.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { ColumnDef, Table } from "@tanstack/react-table";
import { DataTable } from "../components/data-table/data-table.tsx";
import { DataTableFrame } from "../components/data-table/data-table-frame.tsx";
import { DataTableToolbar, visibleFacets } from "../components/data-table/data-table-toolbar.tsx";
import {
  FACET_EMPTY,
  facetFilterFn,
  facetKeys,
  facetOptions,
  rowSearchText,
} from "../components/data-table/facets.ts";
import {
  isDataTableUrlKey,
  mergeDataTableUrlState,
  parseDataTableState,
  serializeDataTableState,
  type DataTableState,
} from "../components/data-table/state.ts";
import { selectionColumn } from "../components/data-table/selection-column.tsx";
import { useDataTable, type UseDataTableOptions } from "../components/data-table/use-data-table.ts";

interface Task {
  id: string;
  title: string;
  status: string | null;
  priority: string;
  tags: string[];
}

const TASKS: Task[] = [
  { id: "t1", title: "Alpha report", status: "open", priority: "high", tags: ["a", "b"] },
  { id: "t2", title: "Beta draft", status: "open", priority: "low", tags: ["b"] },
  { id: "t3", title: "Gamma review", status: "done", priority: "high", tags: [] },
  { id: "t4", title: "Delta alpha", status: null, priority: "medium", tags: ["c"] },
];

const COLUMNS: ColumnDef<Task, unknown>[] = [
  { accessorKey: "title", header: "Title" },
  {
    accessorKey: "status",
    header: "Status",
    filterFn: facetFilterFn,
    meta: { facetLabels: { open: "Open" } },
  },
  { accessorKey: "priority", header: "Priority", filterFn: facetFilterFn },
  { accessorKey: "tags", header: "Tags", filterFn: facetFilterFn },
];

let root: Root | null = null;
let container: HTMLDivElement | null = null;

afterEach(() => {
  act(() => root?.unmount());
  container?.remove();
  root = null;
  container = null;
});

function Harness(
  props: Partial<UseDataTableOptions<Task>> & {
    onTable: (table: Table<Task>) => void;
    facets?: string[];
    pinnedFacets?: number;
    groupOrder?: string[];
    activeRowId?: string;
  },
) {
  const { onTable, facets = [], pinnedFacets, groupOrder, activeRowId, ...options } = props;
  const table = useDataTable<Task>({
    data: TASKS,
    columns: COLUMNS,
    getRowId: (row) => row.id,
    ...options,
  });
  onTable(table);
  return (
    <>
      <DataTableToolbar
        table={table}
        facets={facets.map((columnId) => ({ columnId }))}
        pinnedFacets={pinnedFacets}
      />
      <DataTable
        table={table}
        groupOrder={groupOrder}
        activeRowId={activeRowId}
        emptyState="Nothing here"
      />
    </>
  );
}

function mount(props: Omit<Parameters<typeof Harness>[0], "onTable">) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  let table!: Table<Task>;
  act(() => {
    root!.render(<Harness {...props} onTable={(t) => (table = t)} />);
  });
  return {
    get table() {
      return table;
    },
  };
}

const renderedIds = () =>
  Array.from(container!.querySelectorAll("tbody tr[data-row-id]")).map((tr) =>
    tr.getAttribute("data-row-id"),
  );

describe("facet keys", () => {
  it("splits arrays, maps empties to the sentinel, reads ids off objects", () => {
    expect(facetKeys(["a", "b"])).toEqual(["a", "b"]);
    expect(facetKeys([])).toEqual([FACET_EMPTY]);
    expect(facetKeys(null)).toEqual([FACET_EMPTY]);
    expect(facetKeys("")).toEqual([FACET_EMPTY]);
    expect(facetKeys(false)).toEqual(["false"]);
    expect(facetKeys({ id: "u1", name: "Ada" })).toEqual(["u1"]);
    expect(facetKeys({ name: "Ada" })).toEqual(["Ada"]);
  });

  it("facetFilterFn ORs the selected keys and is removed when empty", () => {
    const row = { getValue: () => ["a", "b"] } as never;
    expect(facetFilterFn(row, "tags", ["b", "z"], () => {})).toBe(true);
    expect(facetFilterFn(row, "tags", ["z"], () => {})).toBe(false);
    expect(facetFilterFn(row, "tags", [], () => {})).toBe(true);
    expect(facetFilterFn.autoRemove?.([])).toBe(true);
    expect(facetFilterFn.autoRemove?.(["a"])).toBe(false);
  });
});

describe("useDataTable + DataTable", () => {
  it("renders every row and ANDs facets while ORing within one", () => {
    const h = mount({ facets: ["status", "priority"], activeRowId: "t3" });
    expect(renderedIds()).toEqual(["t1", "t2", "t3", "t4"]);
    expect(container!.querySelector("tr[aria-current='true']")?.getAttribute("data-row-id")).toBe(
      "t3",
    );
    act(() => h.table.getColumn("priority")!.setFilterValue(["high", "low"]));
    expect(renderedIds()).toEqual(["t1", "t2", "t3"]);
    act(() => h.table.getColumn("status")!.setFilterValue(["open"]));
    expect(renderedIds()).toEqual(["t1", "t2"]);
  });

  it("counts a facet over the rows every OTHER filter lets through", () => {
    const h = mount({ facets: ["status", "priority"] });
    act(() => h.table.getColumn("status")!.setFilterValue(["open"]));
    const status = facetOptions(h.table.getColumn("status")!);
    expect(status.map((o) => [o.value, o.label, o.count])).toEqual([
      ["done", "done", 1],
      ["open", "Open", 2],
      [FACET_EMPTY, "None", 1],
    ]);
    const priority = facetOptions(h.table.getColumn("priority")!, [
      { value: "high", label: "High" },
      { value: "medium", label: "Medium" },
    ]);
    expect(priority.map((o) => [o.value, o.count])).toEqual([
      ["high", 1],
      ["medium", 0],
      ["low", 1],
    ]);
  });

  it("treats array cells as one key per element and filters empties by the sentinel", () => {
    const h = mount({ facets: ["tags"] });
    expect(facetOptions(h.table.getColumn("tags")!).map((o) => [o.value, o.count])).toEqual([
      ["a", 1],
      ["b", 2],
      ["c", 1],
      [FACET_EMPTY, 1],
    ]);
    act(() => h.table.getColumn("tags")!.setFilterValue(["b"]));
    expect(renderedIds()).toEqual(["t1", "t2"]);
    act(() => h.table.getColumn("tags")!.setFilterValue([FACET_EMPTY]));
    expect(renderedIds()).toEqual(["t3"]);
  });

  it("search requires every token somewhere in the row", () => {
    const h = mount({});
    act(() => h.table.setGlobalFilter("alpha"));
    expect(renderedIds()).toEqual(["t1", "t4"]);
    act(() => h.table.setGlobalFilter("alpha open"));
    expect(renderedIds()).toEqual(["t1"]);
    act(() => h.table.setGlobalFilter("alpha ZZZ"));
    expect(renderedIds()).toEqual([]);
    expect(container!.textContent).toContain("Nothing here");
  });

  it("shows Reset only while filtered and clears everything on click", () => {
    const h = mount({ facets: ["status"] });
    const reset = () =>
      Array.from(container!.querySelectorAll("button")).find(
        (b) => b.textContent?.trim() === "Reset",
      );
    expect(reset()).toBeUndefined();
    act(() => {
      h.table.setGlobalFilter("alpha");
      h.table.getColumn("status")!.setFilterValue(["open"]);
    });
    expect(renderedIds()).toEqual(["t1"]);
    expect(reset()).toBeDefined();
    act(() => reset()!.click());
    expect(renderedIds()).toEqual(["t1", "t2", "t3", "t4"]);
    expect(reset()).toBeUndefined();
  });

  it("pins the first facets, parks the rest behind + Filter, and surfaces a hidden facet once it has a value", () => {
    const h = mount({ facets: ["status", "priority", "tags"], pinnedFacets: 1 });
    const facetButtons = () =>
      Array.from(container!.querySelectorAll("button[data-facet]")).map((b) =>
        b.getAttribute("data-facet"),
      );
    expect(facetButtons()).toEqual(["status"]);
    expect(container!.querySelector("button[data-facet-menu]")).not.toBeNull();
    act(() => h.table.getColumn("tags")!.setFilterValue(["b"]));
    expect(facetButtons()).toEqual(["status", "tags"]);
    const split = visibleFacets(
      h.table,
      [{ columnId: "status" }, { columnId: "priority", pinned: true }, { columnId: "tags" }],
      new Set(["status"]),
      0,
    );
    expect(split.shown.map((f) => f.columnId)).toEqual(["status", "priority", "tags"]);
    expect(split.hidden).toEqual([]);
    const split2 = visibleFacets(
      h.table,
      [{ columnId: "status" }, { columnId: "priority" }],
      new Set(),
      1,
    );
    expect(split2.shown.map((f) => f.columnId)).toEqual(["status"]);
    expect(split2.hidden.map((f) => f.columnId)).toEqual(["priority"]);
    act(() => h.table.resetColumnFilters());
    expect(facetButtons()).toEqual(["status"]);
    // a facet with more than two values announces the count to assistive tech
    act(() => h.table.getColumn("status")!.setFilterValue(["open", "done", "x"]));
    expect(container!.querySelector("button[data-facet='status'] .sr-only")?.textContent).toBe(
      "3 selected",
    );
  });

  it("hides a column below its breakpoint with a literal responsive class", () => {
    mount({
      columns: [
        { ...COLUMNS[0]! },
        { ...COLUMNS[1]!, meta: { breakpoint: "lg" } },
        ...COLUMNS.slice(2),
      ],
    });
    const statusHeader = Array.from(container!.querySelectorAll("thead th"))[1]!;
    expect(statusHeader.className).toContain("max-lg:hidden");
    expect(
      container!.querySelector("tbody tr[data-row-id='t1'] td:nth-child(2)")?.className,
    ).toContain("max-lg:hidden");
  });

  it("a frame adds a focus button to the toolbar and Escape leaves focus mode", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <DataTableFrame className="plain">
          <Harness onTable={() => {}} />
        </DataTableFrame>,
      );
    });
    const button = () =>
      container!.querySelector<HTMLButtonElement>(
        "button[aria-label='Focus on the list'], button[aria-label='Leave focus mode']",
      )!;
    expect(button().getAttribute("aria-pressed")).toBe("false");
    expect(container!.querySelector("[data-focused]")).toBeNull();
    act(() => button().click());
    expect(container!.querySelector("[data-focused]")).not.toBeNull();
    expect(button().getAttribute("aria-pressed")).toBe("true");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(container!.querySelector("[data-focused]")).toBeNull();
    expect(container!.querySelector(".plain")).not.toBeNull();
  });

  it("groups rows in the declared group order with a header per group", () => {
    mount({ groupBy: "priority", groupOrder: ["low", "medium", "high"] });
    const groups = Array.from(container!.querySelectorAll("tbody tr[data-group-row]")).map((tr) =>
      tr.textContent?.replace(/\s+/g, " ").trim(),
    );
    expect(groups).toEqual(["low (1)", "medium (1)", "high (2)"]);
    expect(renderedIds()).toEqual(["t2", "t4", "t1", "t3"]);
  });

  it("emits the whole state when controlled and resets the page on a filter change", () => {
    const states: DataTableState[] = [];
    let state: Partial<DataTableState> = { pagination: { pageIndex: 2, pageSize: 1 } };
    const rerender = () => {
      act(() => {
        root!.render(
          <Harness
            state={state}
            onStateChange={(next) => {
              states.push(next);
              state = next;
            }}
            pageSize={1}
            onTable={(t) => (table = t)}
          />,
        );
      });
    };
    let table!: Table<Task>;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    rerender();
    expect(renderedIds()).toEqual(["t3"]);
    act(() => table.setGlobalFilter("a"));
    expect(states.at(-1)?.globalFilter).toBe("a");
    expect(states.at(-1)?.pagination.pageIndex).toBe(0);
    rerender();
    expect(renderedIds()).toEqual(["t1"]);
  });

  it("keeps pageSize when initialState carries a partial pagination and clamps a stranded page", () => {
    const h = mount({ pageSize: 1, initialState: { pagination: { pageIndex: 3 } as never } });
    expect(h.table.getState().pagination).toEqual({ pageIndex: 3, pageSize: 1 });
    expect(renderedIds()).toEqual(["t4"]);
    act(() => h.table.getColumn("priority")!.setFilterValue(["high"]));
    expect(h.table.getState().pagination.pageIndex).toBe(0);
    act(() => h.table.setPageIndex(1));
    expect(renderedIds()).toEqual(["t3"]);
    act(() => h.table.getColumn("priority")!.setFilterValue(["medium"]));
    act(() => h.table.setPageIndex(5));
    expect(h.table.getState().pagination.pageIndex).toBe(0);
    expect(renderedIds()).toEqual(["t4"]);
  });

  it("escapes a real value that spells the empty sentinel", () => {
    expect(facetKeys(FACET_EMPTY)).toEqual([`\\${FACET_EMPTY}`]);
    expect(facetKeys(null)).toEqual([FACET_EMPTY]);
  });

  it("re-reads a row's search text when its columns change", () => {
    const h = mount({});
    const row = h.table.getCoreRowModel().rows[1]!;
    expect(rowSearchText(row)).toContain("beta draft");
    expect(rowSearchText(row)).not.toContain("hidden-token");
    act(() => {
      root!.render(
        <Harness
          columns={[
            {
              ...COLUMNS[0]!,
              meta: { searchText: (task: Task) => (task.id === "t2" ? "hidden-token" : "") },
            },
            ...COLUMNS.slice(1),
          ]}
          onTable={() => {}}
        />,
      );
    });
    expect(rowSearchText(h.table.getCoreRowModel().rows[1]!)).toContain("hidden-token");
  });

  it("selection column toggles rows and reports through the table", () => {
    const h = mount({
      columns: [selectionColumn<Task>(), ...COLUMNS],
      enableRowSelection: true,
    });
    const boxes = container!.querySelectorAll<HTMLButtonElement>("tbody [aria-label='Select row']");
    expect(boxes).toHaveLength(4);
    act(() => boxes[1]!.click());
    expect(h.table.getSelectedRowModel().rows.map((r) => r.id)).toEqual(["t2"]);
    expect(container!.querySelector("tr[data-row-id='t2']")?.getAttribute("data-state")).toBe(
      "selected",
    );
  });
});

describe("URL state", () => {
  it("round-trips search, sort, facets, hidden columns and paging", () => {
    const state: Partial<DataTableState> = {
      globalFilter: "alpha beta",
      sorting: [
        { id: "priority", desc: true },
        { id: "title", desc: false },
      ],
      columnFilters: [
        { id: "status", value: ["open", "done"] },
        { id: "tags", value: ["x,y"] },
      ],
      columnVisibility: { tags: false, title: true },
      pagination: { pageIndex: 2, pageSize: 50 },
    };
    const params = serializeDataTableState(state);
    expect(params.get("q")).toBe("alpha beta");
    expect(params.get("sort")).toBe("-priority,title");
    expect(params.get("f_status")).toBe("open,done");
    expect(params.get("hide")).toBe("tags");
    expect(params.get("page")).toBe("3");
    expect(params.get("size")).toBe("50");
    const parsed = parseDataTableState(new URLSearchParams(params.toString()));
    expect(parsed.globalFilter).toBe("alpha beta");
    expect(parsed.sorting).toEqual(state.sorting);
    expect(parsed.columnFilters).toEqual(state.columnFilters);
    expect(parsed.columnVisibility).toEqual({ tags: false });
    expect(parsed.pagination).toEqual({ pageIndex: 2, pageSize: 50 });
  });

  it("escapes sort ids that contain commas or start with a dash", () => {
    const sorting = [
      { id: "-odd,id", desc: true },
      { id: "a,b", desc: false },
    ];
    const params = serializeDataTableState({ sorting });
    expect(parseDataTableState(new URLSearchParams(params.toString())).sorting).toEqual(sorting);
  });

  it("writes an explicit empty key when a defaulted value is cleared, and honours default paging", () => {
    const defaults: Partial<DataTableState> = {
      globalFilter: "seed",
      sorting: [{ id: "title", desc: false }],
      columnFilters: [{ id: "status", value: ["open"] }],
      columnVisibility: { tags: false },
      pagination: { pageIndex: 1, pageSize: 10 },
    };
    const cleared = serializeDataTableState(
      {
        globalFilter: "",
        sorting: [],
        columnFilters: [],
        columnVisibility: {},
        pagination: { pageIndex: 0, pageSize: 10 },
      },
      { defaults },
    );
    expect(cleared.toString()).toBe("q=&sort=&f_status=&hide=&page=1");
    const parsed = parseDataTableState(new URLSearchParams(cleared.toString()), { defaults });
    expect(parsed.globalFilter).toBe("");
    expect(parsed.sorting).toEqual([]);
    expect(parsed.columnFilters).toEqual([]);
    expect(parsed.columnVisibility).toEqual({});
    expect(parsed.pagination).toEqual({ pageIndex: 0, pageSize: 10 });
    const untouched = parseDataTableState(new URLSearchParams(""), { defaults });
    expect(untouched.pagination).toEqual({ pageIndex: 1, pageSize: 10 });
    expect(untouched.columnFilters).toEqual([{ id: "status", value: ["open"] }]);
    expect(serializeDataTableState(untouched, { defaults }).toString()).toBe("");
  });

  it("namespaces keys with a prefix so two lists share one URL", () => {
    const a = mergeDataTableUrlState(
      new URLSearchParams("view=grid&b.q=old"),
      { globalFilter: "x", columnFilters: [{ id: "status", value: ["open"] }] },
      { prefix: "a." },
    );
    expect(a.toString()).toBe("view=grid&b.q=old&a.q=x&a.f_status=open");
    const parsedA = parseDataTableState(a, { prefix: "a." });
    expect(parsedA.globalFilter).toBe("x");
    expect(parsedA.columnFilters).toEqual([{ id: "status", value: ["open"] }]);
    const parsedB = parseDataTableState(a, { prefix: "b." });
    expect(parsedB.globalFilter).toBe("old");
    expect(parsedB.columnFilters).toEqual([]);
    expect(isDataTableUrlKey("a.f_status", "a.")).toBe(true);
    expect(isDataTableUrlKey("f_status", "a.")).toBe(false);
    expect(isDataTableUrlKey("f_status")).toBe(true);
  });

  it("omits defaults, keeps foreign params on merge, and applies defaults when absent", () => {
    const empty = serializeDataTableState({ pagination: { pageIndex: 0, pageSize: 20 } });
    expect(empty.toString()).toBe("");
    const merged = mergeDataTableUrlState(new URLSearchParams("view=grid&f_status=open&q=old"), {
      globalFilter: "new",
    });
    expect(merged.toString()).toBe("view=grid&q=new");
    const parsed = parseDataTableState(new URLSearchParams("view=grid"), {
      defaults: {
        columnFilters: [{ id: "status", value: ["open"] }],
        columnVisibility: { tags: false },
      },
    });
    expect(parsed.columnFilters).toEqual([{ id: "status", value: ["open"] }]);
    expect(parsed.columnVisibility).toEqual({ tags: false });
    expect(parseDataTableState(new URLSearchParams("hide=")).columnVisibility).toEqual({});
  });
});
