/**
 * DataTable semantics that every list on top of it relies on: facet keys
 * (arrays, empties), OR-within / AND-across filtering, counts that exclude
 * the facet's own filter, AND-of-tokens search, URL round-trips, grouping
 * order, and the toolbar's Reset.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import { DataTable } from "../components/data-table/data-table.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";
import { DataTableFrame } from "../components/data-table/data-table-frame.tsx";
import { DataTableToolbar, visibleFacets } from "../components/data-table/data-table-toolbar.tsx";
import {
  FACET_EMPTY,
  columnFacetKeys,
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
    onActiveRowChange?: (row: Row<Task> | null) => void;
    onRowOpen?: (row: Row<Task>) => void;
    onRowClick?: (row: Row<Task>) => void;
    toolbarProps?: Partial<React.ComponentProps<typeof DataTableToolbar>>;
    tableProps?: Partial<React.ComponentProps<typeof DataTable>>;
    groupOrder?: string[];
    activeRowId?: string;
  },
) {
  const {
    onTable,
    facets = [],
    pinnedFacets,
    toolbarProps,
    tableProps,
    groupOrder,
    activeRowId,
    onActiveRowChange,
    onRowOpen,
    onRowClick,
    ...options
  } = props;
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
        {...toolbarProps}
      />
      <DataTable
        table={table}
        groupOrder={groupOrder}
        activeRowId={activeRowId}
        onActiveRowChange={onActiveRowChange}
        onRowOpen={onRowOpen}
        onRowClick={onRowClick}
        emptyState="Nothing here"
        {...tableProps}
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

describe("promises the metadata makes", () => {
  it("starts a defaultHidden column hidden, and lets the caller override it", () => {
    const columns: ColumnDef<Task, unknown>[] = [
      { id: "title", accessorKey: "title", header: "Title" },
      { id: "notes", accessorKey: "status", header: "Notes", meta: { defaultHidden: true } },
    ];
    function Bare({
      initialState,
      onTable,
    }: {
      initialState?: Partial<DataTableState>;
      onTable: (t: Table<Task>) => void;
    }) {
      const table = useDataTable<Task>({
        data: TASKS,
        columns,
        getRowId: (row) => row.id,
        initialState,
      });
      onTable(table);
      return <DataTable table={table} />;
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    let table!: Table<Task>;
    act(() => root!.render(<Bare onTable={(t) => (table = t)} />));
    expect(table.getColumn("notes")!.getIsVisible()).toBe(false);
    // …and it is still in the Columns menu, i.e. the user can bring it out.
    act(() => table.getColumn("notes")!.toggleVisibility(true));
    expect(table.getColumn("notes")!.getIsVisible()).toBe(true);

    // An explicit choice (state, or a URL) outranks the default.
    act(() => root!.unmount());
    root = createRoot(container);
    act(() =>
      root!.render(
        <Bare initialState={{ columnVisibility: { notes: true } }} onTable={(t) => (table = t)} />,
      ),
    );
    expect(table.getColumn("notes")!.getIsVisible()).toBe(true);
  });

  it("counts a row once even when its buckets overlap", () => {
    const column = {
      id: "size",
      columnDef: { meta: { facetBuckets: () => ["big", "big", "notable"] } },
    } as never;
    expect(columnFacetKeys(column, 12)).toEqual(["big", "notable"]);
  });

  it("shows focus-only columns in focus mode, not merely because the table fills", () => {
    // `fill` is a scroll-layout prop; a host may use it on an ordinary page.
    const columns: ColumnDef<Task, unknown>[] = [
      { id: "title", accessorKey: "title", header: "Title" },
      { id: "detail", accessorKey: "status", header: "Detail", meta: { showIn: "focus" } },
    ];
    function Filled() {
      const table = useDataTable<Task>({ data: TASKS, columns, getRowId: (row) => row.id });
      return <DataTable table={table} fill />;
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Filled />));
    // (the trailing empty cell is the `spacer` column)
    const drawn = Array.from(container!.querySelectorAll("thead th"))
      .map((th) => th.textContent)
      .filter(Boolean);
    expect(drawn).toEqual(["Title"]);
  });

  it("a double click selects once and opens once", () => {
    const clicks: string[] = [];
    const opens: string[] = [];
    const h = mount({
      onRowClick: (row) => clicks.push(row.id),
      onRowOpen: (row) => opens.push(row.id),
    });
    expect(h.table).toBeTruthy();
    const row = container!.querySelector("tbody tr[data-row-id='t1']") as HTMLElement;
    act(() => {
      // What a browser really sends: click(detail 1), click(detail 2), dblclick.
      row.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 1 }));
      row.dispatchEvent(new MouseEvent("click", { bubbles: true, detail: 2 }));
      row.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, detail: 2 }));
    });
    expect(clicks).toEqual(["t1"]);
    expect(opens).toEqual(["t1"]);
  });
});

describe("what the table actually draws", () => {
  interface Cell {
    id: string;
    a: string;
    b: string;
  }
  const ROWS: Cell[] = [
    { id: "r1", a: "a1", b: "b1" },
    { id: "r2", a: "a2", b: "b2" },
  ];

  function GatedHarness({
    columns,
    onRendered,
  }: {
    columns: ColumnDef<Cell, unknown>[];
    onRendered?: (ids: string[]) => void;
  }) {
    const table = useDataTable<Cell>({ data: ROWS, columns, getRowId: (row) => row.id });
    return <DataTable table={table} onRenderedColumnsChange={onRendered} />;
  }

  function mountGated(columns: ColumnDef<Cell, unknown>[]) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const seen: string[][] = [];
    act(() => {
      root!.render(<GatedHarness columns={columns} onRendered={(ids) => seen.push(ids)} />);
    });
    return seen;
  }

  it("tells the host which columns are on screen, so the agent sees what the user sees", () => {
    // Width gating is render-time, not TanStack visibility (which belongs to
    // the user and rides in the URL) — without this a tool would report a
    // column nobody can see.
    const seen = mountGated([
      { id: "a", accessorKey: "a", header: "A" },
      { id: "b", accessorKey: "b", header: "B", meta: { showIn: "focus" } },
    ]);
    expect(seen.at(-1)).toEqual(["a"]);
    expect(Array.from(container!.querySelectorAll("thead th[scope='col']")).length).toBe(1);
  });

  it("never freezes a column the width gate dropped", () => {
    // The seam says "there is more to the left"; it must sit on a column that
    // is actually drawn.
    mountGated([
      { id: "a", accessorKey: "a", header: "A", meta: { pinned: "left" } },
      { id: "b", accessorKey: "b", header: "B", meta: { pinned: "left", showIn: "focus" } },
    ]);
    const pinnedHeaders = Array.from(container!.querySelectorAll("thead th[data-pinned]"));
    expect(pinnedHeaders.length).toBe(1);
    expect(pinnedHeaders[0]!.hasAttribute("data-pinned-edge")).toBe(true);
  });

  it("narrows a grouping header to the leaves that survive, and drops it when none do", () => {
    mountGated([
      {
        id: "pair",
        header: "Pair",
        columns: [
          { id: "a", accessorKey: "a", header: "A" },
          { id: "b", accessorKey: "b", header: "B", meta: { showIn: "focus" } },
        ],
      },
      {
        id: "gone",
        header: "Gone",
        columns: [{ id: "c", accessorFn: () => "c", header: "C", meta: { showIn: "focus" } }],
      },
    ]);
    const groupRow = container!.querySelectorAll("thead tr")[0]!;
    const groupHeaders = Array.from(groupRow.querySelectorAll("th[scope='col']"));
    expect(groupHeaders.map((th) => th.textContent)).toEqual(["Pair"]);
    expect(groupHeaders[0]!.getAttribute("colspan")).toBe("1");
  });

  it("keeps frozen cells under the sticky header", () => {
    // The regression this guards: a frozen cell painted over the sticky header
    // while scrolling, because the cell's z-index outranked the header row's.
    const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");
    const css = read("src/styles.css");
    const zOf = (selector: string) => {
      const rule = new RegExp(`\\[data-pinned="${selector}"\\][^}]*z-index:\\s*(\\d+)`).exec(css);
      return Number(rule?.[1]);
    };
    const source = read("src/components/data-table/data-table.tsx");
    const headerRow = Number(/sticky top-0 z-(\d+)/.exec(source)?.[1]);
    expect(headerRow).toBeGreaterThan(0);
    expect(zOf("cell")).toBeLessThan(headerRow);
    expect(zOf("header")).toBeGreaterThan(0);
  });
});

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
    // A bare row stand-in: no cells, so the filter falls back to plain keys.
    const row = { getValue: () => ["a", "b"], getAllCells: () => [] } as never;
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

  it("keeps both values when two facet options are clicked before a re-render", () => {
    const h = mount({ facets: ["status"] });
    act(() => container!.querySelector<HTMLButtonElement>("button[data-facet='status']")!.click());
    const options = () =>
      Array.from(
        document.querySelectorAll<HTMLButtonElement>(
          "[role='group'][aria-label='Status filter'] button[role='checkbox']",
        ),
      );
    expect(options().length).toBeGreaterThan(1);
    // both clicks inside one act(): no render in between, as with a fast user
    act(() => {
      options()[0]!.click();
      options()[1]!.click();
    });
    expect(h.table.getColumn("status")!.getFilterValue()).toEqual(["done", "open"]);
  });

  it("buckets turn a number into something you can tick, counts and all", () => {
    const amounts: Record<string, number> = { t1: 100, t2: 200, t3: 300, t4: 50 };
    const h = mount({
      facets: ["amount"],
      columns: [
        ...COLUMNS.slice(0, 3),
        {
          id: "amount",
          accessorFn: (task: Task) => amounts[task.id],
          header: "Amount",
          filterFn: facetFilterFn,
          meta: {
            facetLabels: { gte: "≥ 150", lt: "< 150" },
            facetBuckets: (value: unknown) => [Number(value) >= 150 ? "gte" : "lt"],
          },
        },
      ],
    });
    const column = h.table.getColumn("amount")!;
    // the raw numbers never appear — only the buckets, counted
    // undeclared keys come back in label order
    expect(facetOptions(column).map((o) => [o.value, o.label, o.count])).toEqual([
      ["lt", "< 150", 2],
      ["gte", "≥ 150", 2],
    ]);
    act(() => column.setFilterValue(["gte"]));
    expect(renderedIds()).toEqual(["t2", "t3"]);
    act(() => column.setFilterValue(["lt"]));
    expect(renderedIds()).toEqual(["t1", "t4"]);
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

  it("hides a column when the list itself is too narrow for it", () => {
    // jsdom reports zero-width elements: unmeasured means "show everything",
    // so nothing is hidden on a guess. Feeding a width exercises the rule.
    const widths = new Map<Element, number>();
    const observed: Array<() => void> = [];
    class StubResizeObserver {
      constructor(private readonly callback: () => void) {}
      observe() {
        observed.push(this.callback);
      }
      unobserve() {}
      disconnect() {}
    }
    const previousRO = window.ResizeObserver;
    const previousRect = Element.prototype.getBoundingClientRect;
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: StubResizeObserver });
    Element.prototype.getBoundingClientRect = function () {
      return { ...previousRect.call(this), width: widths.get(this) ?? 0 } as DOMRect;
    };
    try {
      const h = mount({
        columns: [
          { ...COLUMNS[0]! },
          { ...COLUMNS[1]!, meta: { breakpoint: "lg" } },
          ...COLUMNS.slice(2),
        ],
      });
      const headers = () =>
        Array.from(container!.querySelectorAll("thead th:not([aria-hidden])")).map(
          (th) => th.textContent,
        );
      expect(headers()).toEqual(["Title", "Status", "Priority", "Tags"]);
      const root = container!.querySelector("table")!.closest("div")!.parentElement!;
      widths.set(root, 700); // narrower than `lg` (896)
      act(() => observed.forEach((callback) => callback()));
      expect(headers()).toEqual(["Title", "Priority", "Tags"]);
      expect(
        container!.querySelectorAll("tbody tr[data-row-id='t1'] td:not([aria-hidden])"),
      ).toHaveLength(3);
      widths.set(root, 1200); // roomy again
      act(() => observed.forEach((callback) => callback()));
      expect(headers()).toEqual(["Title", "Status", "Priority", "Tags"]);
      expect(h.table.getVisibleLeafColumns()).toHaveLength(4);
    } finally {
      Object.defineProperty(window, "ResizeObserver", { writable: true, value: previousRO });
      Element.prototype.getBoundingClientRect = previousRect;
    }
  });

  it("a column can wait for focus mode, where every facet is shown too", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <DataTableFrame className="plain">
          <Harness
            facets={["status", "priority", "tags"]}
            columns={[
              COLUMNS[0]!,
              { ...COLUMNS[1]!, meta: { showIn: "focus" } },
              ...COLUMNS.slice(2),
            ]}
            onTable={() => {}}
          />
        </DataTableFrame>,
      );
    });
    const headers = () =>
      Array.from(container!.querySelectorAll("thead th:not([aria-hidden])")).map(
        (th) => th.textContent,
      );
    const facetIds = () =>
      Array.from(container!.querySelectorAll("button[data-facet]")).map((b) =>
        b.getAttribute("data-facet"),
      );
    // on a page: the focus-only column waits, and only the pinned facets show
    expect(headers()).toEqual(["Title", "Priority", "Tags"]);
    expect(facetIds()).toEqual(["status", "priority", "tags"].slice(0, 3));
    const focusButton = container!.querySelector<HTMLButtonElement>(
      "button[aria-label='Focus on the list']",
    )!;
    act(() => focusButton.click());
    // with the screen to itself: the column joins in
    expect(headers()).toEqual(["Title", "Status", "Priority", "Tags"]);
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
    const layer = () => container!.querySelector("[data-focused]");
    expect(button().getAttribute("aria-pressed")).toBe("false");
    expect(layer()).toBeNull();
    expect(container!.querySelector("table")!.parentElement!.className).toContain(
      "overflow-x-auto",
    );
    const rowBefore = container!.querySelector("tbody tr[data-row-id]");
    act(() => button().click());
    expect(layer()).not.toBeNull();
    // The subtree stays mounted: focus mode only swaps the frame's classes,
    // so the list keeps its state (and its theme scope).
    expect(container!.querySelector("tbody tr[data-row-id]")).toBe(rowBefore);
    expect(button().getAttribute("aria-pressed")).toBe("true");
    // The layer itself never scrolls: the table is the scroll region (both
    // axes) and its header sticks while the rows move.
    expect(layer()!.className).toContain("overflow-hidden");
    const scroller = layer()!.querySelector("table")!.parentElement!;
    expect(scroller.className).toContain("overflow-auto");
    expect(scroller.className).toContain("min-h-0");
    expect(scroller.parentElement!.className).toContain("flex-1");
    expect(layer()!.querySelector("thead")!.className).toContain("sticky");
    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    });
    expect(layer()).toBeNull();
    expect(container!.querySelector(".plain")).not.toBeNull();
    expect(container!.querySelector("table")!.parentElement!.className).toContain(
      "overflow-x-auto",
    );
  });

  it("puts filters on their own row and collapses them behind the Filters toggle", () => {
    const h = mount({ facets: ["status", "priority"] });
    const filterRow = () => container!.querySelector("[data-filter-row]");
    const toggle = () =>
      container!.querySelector<HTMLButtonElement>("button[data-filters-toggle]")!;
    expect(filterRow()).not.toBeNull();
    // Row 1 holds the search; the facets live in the filter row, not beside it.
    expect(filterRow()!.querySelectorAll("button[data-facet]")).toHaveLength(2);
    expect(
      container!.querySelector("input[type='search']")?.closest("[data-filter-row]"),
    ).toBeNull();
    expect(toggle().getAttribute("aria-expanded")).toBe("true");
    expect(toggle().textContent).not.toMatch(/\d/);
    act(() => h.table.getColumn("status")!.setFilterValue(["open"]));
    expect(toggle().querySelector(".sr-only")?.textContent).toBe("1 active");
    act(() => toggle().click());
    expect(filterRow()).toBeNull();
    // Collapsed, the list still shows the filter is on — and the rows stay filtered.
    expect(toggle().getAttribute("aria-expanded")).toBe("false");
    expect(renderedIds()).toEqual(["t1", "t2"]);
    act(() => toggle().click());
    expect(filterRow()).not.toBeNull();
  });

  it("children alone do not open a filter row", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <Harness
          toolbarProps={{ children: <span data-extra="">extra</span> }}
          onTable={() => {}}
        />,
      );
    });
    expect(container!.querySelector("[data-extra]")).not.toBeNull();
    expect(container!.querySelector("[data-filter-row]")).toBeNull();
    expect(container!.querySelector("button[data-filters-toggle]")).toBeNull();
  });

  it("a selection takes the filter row's place, so the list never jumps", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    let table!: Table<Task>;
    act(() => {
      root!.render(
        <Harness
          facets={["status"]}
          enableRowSelection
          toolbarProps={{ selectionBar: <span data-bar="">selected</span> }}
          onTable={(t) => (table = t)}
        />,
      );
    });
    // Nothing ticked: the bar renders null, so the filter row must stay —
    // passing a `selectionBar` element is not the same as having a selection.
    expect(container!.querySelector("[data-selection-row]")).toBeNull();
    expect(container!.querySelector("[data-filter-row]")).not.toBeNull();

    act(() => table.getRow("t1").toggleSelected(true));
    // Now it replaces the filter row, rather than pushing it down.
    expect(container!.querySelector("[data-selection-row]")).not.toBeNull();
    expect(container!.querySelector("[data-filter-row]")).toBeNull();
    expect(container!.querySelector("[data-bar]")?.textContent).toBe("selected");

    act(() => table.resetRowSelection(true));
    expect(container!.querySelector("[data-selection-row]")).toBeNull();
    expect(container!.querySelector("[data-filter-row]")).not.toBeNull();
  });

  it("layout=inline keeps one wrapping row", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    let table!: Table<Task>;
    act(() => {
      root!.render(
        <Harness
          facets={["status"]}
          toolbarProps={{ layout: "inline" }}
          onTable={(t) => (table = t)}
        />,
      );
    });
    expect(container!.querySelector("[data-filter-row]")).toBeNull();
    expect(container!.querySelector("button[data-filters-toggle]")).toBeNull();
    expect(container!.querySelectorAll("button[data-facet]")).toHaveLength(1);
    expect(table.getState().columnFilters).toEqual([]);
  });

  it("freezes pinned columns, stacking their offsets, and walks rows with the keyboard", () => {
    const moves: Array<string | null> = [];
    // jsdom has no layout: feed the pinned headers a width so the offsets are
    // exercised the way a browser would produce them.
    const widths = new Map<Element, number>();
    const callbacks: Array<() => void> = [];
    class StubResizeObserver {
      constructor(private readonly callback: () => void) {}
      observe(element: Element) {
        callbacks.push(this.callback);
        if (!widths.has(element)) widths.set(element, 60);
      }
      unobserve() {}
      disconnect() {}
    }
    const previousRO = window.ResizeObserver;
    const previousRect = Element.prototype.getBoundingClientRect;
    Object.defineProperty(window, "ResizeObserver", { writable: true, value: StubResizeObserver });
    Element.prototype.getBoundingClientRect = function () {
      return { ...previousRect.call(this), width: widths.get(this) ?? 0 } as DOMRect;
    };
    try {
      container = document.createElement("div");
      document.body.appendChild(container);
      root = createRoot(container);
      let active: string | null = "t2";
      const render = () =>
        act(() => {
          root!.render(
            <Harness
              columns={[
                { ...COLUMNS[0]!, meta: { pinned: "left" } },
                { ...COLUMNS[1]!, meta: { pinned: "left" } },
                ...COLUMNS.slice(2),
              ]}
              activeRowId={active ?? undefined}
              onActiveRowChange={(row) => {
                active = row?.id ?? null;
                moves.push(active);
                render();
              }}
              onTable={() => {}}
            />,
          );
        });
      render();
      const headers = () =>
        Array.from(container!.querySelectorAll("thead th:not([aria-hidden])")) as HTMLElement[];
      headers()
        .slice(0, 2)
        .forEach((header, index) => widths.set(header, index === 0 ? 40 : 120));
      act(() => callbacks.forEach((callback) => callback()));
      expect(headers()[0]!.getAttribute("data-pinned")).toBe("header");
      expect(headers()[1]!.getAttribute("data-pinned")).toBe("header");
      // pinning is a run from the left edge, so a leading column with no
      // `pinned` of its own still comes along
      expect(
        Array.from(container!.querySelectorAll("tbody tr[data-row-id] td[data-pinned]")).length,
      ).toBeGreaterThan(0);
      expect(headers()[1]!.hasAttribute("data-pinned-edge")).toBe(true);
      expect(headers()[2]!.hasAttribute("data-pinned")).toBe(false);
      // the second pinned column starts where the first one ends
      expect(headers()[0]!.style.left).toBe("0px");
      expect(headers()[1]!.style.left).toBe("40px");
      // pinned body cells are marked so the shipped CSS can keep them opaque
      const cell = container!.querySelector("tbody tr td") as HTMLElement;
      expect(cell.getAttribute("data-pinned")).toBe("cell");
      // rows are focusable even without onRowClick
      expect(container!.querySelector("tbody tr[data-row-id]")!.getAttribute("tabindex")).toBe("0");

      const table = container!.querySelector("table")!;
      const key = (k: string, target?: Element) =>
        act(() => {
          (target ?? table).dispatchEvent(new KeyboardEvent("keydown", { key: k, bubbles: true }));
        });
      key("ArrowDown");
      key("ArrowDown");
      key("ArrowUp");
      key("Home");
      key("End");
      // a control inside the table that owns the key keeps it
      const control = document.createElement("button");
      container!.querySelector("tbody tr td")!.appendChild(control);
      key("ArrowDown", control);
      key("Escape");
      expect(moves).toEqual(["t3", "t4", "t3", "t1", "t4", null]);
    } finally {
      Object.defineProperty(window, "ResizeObserver", { writable: true, value: previousRO });
      Element.prototype.getBoundingClientRect = previousRect;
    }
  });

  it("a long menu stays reachable: capped to the available room and scrollable", () => {
    // The Columns menu of a wide list can be taller than the screen; Radix
    // reports the room it has and the content scrolls inside it.
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <DropdownMenu open>
          <DropdownMenuTrigger>open</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuCheckboxItem checked>one</DropdownMenuCheckboxItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      );
    });
    const menu = document.querySelector("[role='menu']") as HTMLElement;
    expect(menu).not.toBeNull();
    expect(menu.hasAttribute("data-menu-scroll")).toBe(true);
    expect(document.querySelectorAll("[role='menuitemcheckbox']")).toHaveLength(1);
  });

  it("maxHeight gives the list its own scroll viewport with a sticky header", () => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(<Harness tableProps={{ maxHeight: "60vh" }} onTable={() => {}} />);
    });
    const scroller = container!.querySelector("table")!.parentElement as HTMLElement;
    expect(scroller.className).toContain("overflow-auto");
    expect(scroller.style.maxHeight).toBe("60vh");
    expect(container!.querySelector("thead")!.className).toContain("sticky");
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

  it("a click selects a row while Enter and a double click open it", () => {
    const clicked: string[] = [];
    const opened: string[] = [];
    const h = mount({
      onRowClick: (row) => clicked.push(row.id),
      onRowOpen: (row) => opened.push(row.id),
    });
    const row = () => container!.querySelector("tbody tr[data-row-id='t2']") as HTMLElement;
    act(() => row().dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(clicked).toEqual(["t2"]);
    expect(opened).toEqual([]);
    act(() => row().dispatchEvent(new MouseEvent("dblclick", { bubbles: true })));
    expect(opened).toEqual(["t2"]);
    act(() => row().dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })));
    expect(opened).toEqual(["t2", "t2"]);
    // Space selects, it does not open — the desktop convention.
    act(() => row().dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true })));
    expect(clicked).toEqual(["t2", "t2"]);
    expect(opened).toHaveLength(2);
    expect(h.table.getState().rowSelection).toEqual({});
  });

  it("selection column toggles rows and reports through the table", () => {
    const h = mount({
      columns: [selectionColumn<Task>(), ...COLUMNS],
      enableRowSelection: true,
    });
    // The checkbox is the selection an agent reads; it is not the row click.
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
