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
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ColumnDef, Row, Table } from "@tanstack/react-table";
import { DataTable } from "../components/data-table/data-table.tsx";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu.tsx";
import { DataTableFrame, useDataTableFrame } from "../components/data-table/data-table-frame.tsx";
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
import { DataTableSelectionBar } from "../components/data-table/data-table-selection-bar.tsx";
import { Checkbox } from "@lykomi/web-primitives";
import {
  defaultHiddenColumns,
  useDataTable,
  type UseDataTableOptions,
} from "../components/data-table/use-data-table.ts";

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

beforeEach(() => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({ matches: false, addEventListener() {}, removeEventListener() {} })),
  );
});
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

/** Source as shipped — for the invariants that live in CSS, which jsdom
 *  lays out not at all. */
const read = (relative: string) => readFileSync(resolve(process.cwd(), relative), "utf8");

/** The real bar, so these assertions are about the shipped class names.
 *  `onTable` runs during the Harness's own render, before children render,
 *  so this reads a live table. */
let barTable: Table<Task> | null = null;
function BulkBar() {
  if (!barTable) return null;
  return (
    <DataTableSelectionBar table={barTable} label="task">
      <button type="button">Archive</button>
      <button type="button">Delete</button>
    </DataTableSelectionBar>
  );
}

const renderedIds = () =>
  Array.from(container!.querySelectorAll("tbody tr[data-row-id]")).map((tr) =>
    tr.getAttribute("data-row-id"),
  );

/** How many stacked rows the toolbar's flex column currently holds.
 *
 *  Throws rather than returning a sentinel: a helper that answers `-1` for
 *  "could not find it" lets the assertion below pass when the SELECTOR
 *  breaks, which is the same shape as the bug it is testing for (review
 *  catch). There is a `data-slot` hook for exactly this.
 */
function countToolbarRows(container: HTMLElement): number {
  const column = container.querySelector("[data-slot='data-table-toolbar']");
  if (!column) throw new Error("no [data-slot='data-table-toolbar'] in the tree");
  return column.children.length;
}

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

  it("leaves a controlled list's visibility to its owner", () => {
    // A hidden-only URL records nothing when a column is SHOWN, so re-applying
    // the metadata on every render would snap the user's choice back. A list
    // whose state lives elsewhere passes `defaultHiddenColumns` into that
    // layer's defaults instead.
    const columns: ColumnDef<Task, unknown>[] = [
      { id: "title", accessorKey: "title", header: "Title" },
      { id: "notes", accessorKey: "status", header: "Notes", meta: { defaultHidden: true } },
    ];
    expect(defaultHiddenColumns(columns)).toEqual({ notes: false });
    let table!: Table<Task>;
    function Controlled() {
      table = useDataTable<Task>({
        data: TASKS,
        columns,
        getRowId: (row) => row.id,
        // what the URL says after the user brought the column out: nothing
        state: { columnVisibility: {} },
        onStateChange: () => {},
      });
      return <DataTable table={table} />;
    }
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(<Controlled />));
    expect(table.getColumn("notes")!.getIsVisible()).toBe(true);
  });

  it("gives a row the keyboard can reach a visible focus state", () => {
    // A list navigated with the arrows is focusable without being clickable;
    // silent focus leaves a keyboard user guessing which row is theirs.
    const h = mount({ activeRowId: "t1", onActiveRowChange: () => {} });
    expect(h.table).toBeTruthy();
    const row = container!.querySelector("tbody tr[data-row-id='t1']") as HTMLElement;
    expect(row.getAttribute("tabindex")).toBe("0");
    expect(row.hasAttribute("data-focusable")).toBe(true);
    expect(row.className).toContain("focus-visible:");
  });

  it("resolves ids the way TanStack does", () => {
    // A dotted accessorKey becomes `user_name`, and an accessorFn column can
    // take its id from a string header. Writing visibility under the raw key
    // would leave the metadata inert.
    expect(
      defaultHiddenColumns<Task>([
        // every dot, the way TanStack's `replaceAll` does it
        { accessorKey: "user.profile.name", header: "Who", meta: { defaultHidden: true } },
        { accessorFn: (row) => row.title, header: "Title", meta: { defaultHidden: true } },
      ] as ColumnDef<Task, unknown>[]),
    ).toEqual({ user_profile_name: false, Title: false });
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

  it("leaves Escape to the frame when no row is active", () => {
    // Escape means "let go of the active row" only while there is one;
    // otherwise it belongs to the enclosing frame, which uses it to leave
    // focus mode.
    const cleared: Array<string | null> = [];
    let stopped = false;
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root!.render(
        <Harness
          activeRowId={null}
          onActiveRowChange={(row) => cleared.push(row?.id ?? null)}
          onTable={() => {}}
        />,
      );
    });
    const table = container!.querySelector("table")!;
    const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
    event.stopPropagation = () => {
      stopped = true;
    };
    act(() => {
      table.querySelector("tbody tr[data-row-id]")!.dispatchEvent(event);
    });
    expect(cleared).toEqual([]);
    expect(stopped).toBe(false);
  });

  it("hides a defaultHidden leaf that lives under a grouping header", () => {
    const columns: ColumnDef<Task, unknown>[] = [
      {
        id: "group",
        header: "Group",
        columns: [
          { id: "title", accessorKey: "title", header: "Title" },
          { id: "buried", accessorKey: "status", header: "Buried", meta: { defaultHidden: true } },
        ],
      },
    ];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    let table!: Table<Task>;
    function Grouped() {
      table = useDataTable<Task>({ data: TASKS, columns, getRowId: (row) => row.id });
      return <DataTable table={table} />;
    }
    act(() => root!.render(<Grouped />));
    // Visibility is a leaf property; the group header has no state to hide.
    expect(table.getColumn("buried")!.getIsVisible()).toBe(false);
    expect(table.getColumn("title")!.getIsVisible()).toBe(true);
  });

  it("sizes a half-gated group by the leaves that survived", () => {
    // `getSize()` sums every descendant, so a group that lost a leaf to the
    // width gate would hold space for a column that is not drawn.
    const columns: ColumnDef<Task, unknown>[] = [
      {
        id: "pair",
        header: "Pair",
        columns: [
          { id: "a", accessorKey: "title", header: "A", size: 200 },
          { id: "b", accessorKey: "status", header: "B", size: 200, meta: { showIn: "focus" } },
        ],
      },
    ];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    function Grouped() {
      const table = useDataTable<Task>({ data: TASKS, columns, getRowId: (row) => row.id });
      return <DataTable table={table} />;
    }
    act(() => root!.render(<Grouped />));
    const group = container!.querySelector("thead th[scope='col']") as HTMLElement;
    expect(group.getAttribute("colspan")).toBe("1");
    expect(group.style.width).toBe("200px");
  });

  it("reports a column id that contains a comma intact", () => {
    const columns: ColumnDef<Task, unknown>[] = [
      { id: "risk,score", accessorKey: "title", header: "Risk, score" },
    ];
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    const seen: string[][] = [];
    function Comma() {
      const table = useDataTable<Task>({ data: TASKS, columns, getRowId: (row) => row.id });
      return <DataTable table={table} onRenderedColumnsChange={(ids) => seen.push(ids)} />;
    }
    act(() => root!.render(<Comma />));
    // Joining on commas would report two columns that do not exist.
    expect(seen.at(-1)).toEqual(["risk,score"]);
  });

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
      Array.from(document.body.querySelectorAll("thead th:not([aria-hidden])")).map(
        (th) => th.textContent,
      );
    const facetIds = () =>
      Array.from(document.body.querySelectorAll("button[data-facet]")).map((b) =>
        b.getAttribute("data-facet"),
      );
    // on a page: the focus-only column waits, and only the pinned facets show
    expect(headers()).toEqual(["Title", "Priority", "Tags"]);
    expect(facetIds()).toEqual(["status", "priority", "tags"].slice(0, 3));
    const focusButton = document.body.querySelector<HTMLButtonElement>(
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
      document.body.querySelector<HTMLButtonElement>(
        "button[aria-label='Focus on the list'], button[aria-label='Leave focus mode']",
      )!;
    const layer = () => document.body.querySelector("[data-focused]");
    expect(button().getAttribute("aria-pressed")).toBe("false");
    expect(layer()).toBeNull();
    expect(document.body.querySelector("table")!.parentElement!.className).toContain(
      "overflow-x-auto",
    );
    const rowBefore = document.body.querySelector("tbody tr[data-row-id]");
    act(() => button().click());
    expect(layer()).not.toBeNull();
    // The subtree stays mounted: the dialog moves the stable portal host,
    // so the list keeps its state (and its theme scope).
    expect(document.body.querySelector("tbody tr[data-row-id]")).toBe(rowBefore);
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
    expect(document.body.querySelector(".plain")).not.toBeNull();
    expect(document.body.querySelector("table")!.parentElement!.className).toContain(
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

  it("a facetless list does not grow when a row is ticked", () => {
    // With no facets the toolbar takes its non-stacked layout, which never
    // reached the swap above: the selection bar was APPENDED, so the
    // toolbar gained a row on the first tick and the table jumped down
    // under the cursor mid-click — the exact regression moving
    // `selectionBar` into the toolbar was meant to end.
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    let table!: Table<Task>;
    act(() => {
      root!.render(
        <Harness
          enableRowSelection
          toolbarProps={{ selectionBar: <span data-bar="">selected</span> }}
          onTable={(t) => (table = t)}
        />,
      );
    });
    const toolbar = container!.querySelector("[data-selection-row]");
    expect(toolbar, "nothing ticked yet").toBeNull();
    const rowsBefore = countToolbarRows(container!);

    act(() => table.getRow("t1").toggleSelected(true));

    expect(container!.querySelector("[data-bar]")?.textContent).toBe("selected");
    expect(
      countToolbarRows(container!),
      "the selection bar must take toolbar space, not add to it",
    ).toBe(rowsBefore);
  });

  it("the row holding the selection bar cannot break in two", () => {
    // Counting DOM children cannot see this one: the toolbar still has one
    // child row, but that row WRAPS. The lead region shares its line with a
    // search that has a width floor, so once the pane is narrower than the
    // search the selection bar is pushed onto a second flex line and the
    // toolbar grows exactly as it did before — same jump, different cause
    // (review catch). jsdom does no layout, so what is observable here is
    // the declaration: this region wraps for facets and never for a
    // selection.
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    let table!: Table<Task>;
    act(() => {
      root!.render(
        <Harness
          enableRowSelection
          toolbarProps={{ selectionBar: <span data-bar="">selected</span> }}
          onTable={(t) => (table = t)}
        />,
      );
    });
    const lead = () => container!.querySelector("[data-toolbar-lead]")!;
    expect(lead().getAttribute("data-toolbar-lead")).toBe("filters");
    expect(lead().className, "the filter region has to keep stacking facets into rows").toContain(
      "flex-wrap",
    );

    act(() => table.getRow("t1").toggleSelected(true));

    expect(lead().getAttribute("data-toolbar-lead")).toBe("selection");
    expect(
      lead().className,
      "the selection bar can wrap below the search and grow the toolbar",
    ).toContain("flex-nowrap");
  });

  it("the bar's own bulk actions cannot wrap either", () => {
    // The row not wrapping is only half of it. The bar sitting in that row
    // has flex containers of its own, and its actions container wrapping
    // its buttons grows the toolbar exactly as a second flex line would —
    // the same jump, one level down (review catch).
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    let table!: Table<Task>;
    act(() => {
      root!.render(
        <Harness
          enableRowSelection
          toolbarProps={{ selectionBar: <BulkBar /> }}
          onTable={(t) => {
            table = t;
            barTable = t;
          }}
        />,
      );
    });
    act(() => table.getRow("t1").toggleSelected(true));

    // jsdom lays nothing out, so what is checkable is that the row this
    // element scrolls in is the one `styles.css` keeps a scrollbar out of.
    // A classic, space-consuming scrollbar appears exactly when the bar
    // overflows — exactly when something is ticked — and its height lands
    // on the toolbar as the same jump by another route (review catch).
    expect(container!.querySelector("[data-selection-row]")).not.toBeNull();
    expect(
      /\[data-selection-row\][^}]*scrollbar-width:\s*none/.test(read("src/styles.css")),
      "nothing keeps the scrollbar out of the selection row's height",
    ).toBe(true);

    const bar = container!.querySelector("[data-selection-bar]")!;
    const actions = container!.querySelector("[data-selection-actions]")!;
    expect(bar.className, "the bar itself can wrap in the shared row").toContain("flex-nowrap");
    expect(actions.className, "the bulk actions can wrap inside a bar that cannot").toContain(
      "flex-nowrap",
    );
  });

  it("a standalone selection bar still wraps", () => {
    // The constraint belongs to the toolbar row, not to the bar. Rendered
    // anywhere else — including the stacked layout, where the bar has a row
    // of its own — wrapping is right and has to survive.
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    let table!: Table<Task>;
    act(() => {
      root!.render(
        <Harness
          enableRowSelection
          onTable={(t) => {
            table = t;
            barTable = t;
          }}
        />,
      );
    });
    act(() => table.getRow("t1").toggleSelected(true));

    const standalone = document.createElement("div");
    document.body.appendChild(standalone);
    const barRoot = createRoot(standalone);
    act(() => barRoot.render(<BulkBar />));

    expect(standalone.querySelector("[data-selection-bar]")!.className).toContain("flex-wrap");
    expect(standalone.querySelector("[data-selection-actions]")!.className).toContain("flex-wrap");
    act(() => barRoot.unmount());
    standalone.remove();
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
      const viewport = container!.querySelector("[data-list-scroller]")!;
      let viewportWidth = 600;
      Object.defineProperty(viewport, "clientWidth", { get: () => viewportWidth });
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
      // A narrow viewport releases wide frozen content so other columns can be reached.
      viewportWidth = 200;
      act(() => callbacks.forEach((callback) => callback()));
      expect(headers().every((header) => !header.hasAttribute("data-pinned"))).toBe(true);
      viewportWidth = 600;
      act(() => callbacks.forEach((callback) => callback()));
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

  it("the select-all box says PARTIAL when only some rows are selected", () => {
    mount({ columns: [selectionColumn<Task>(), ...COLUMNS], enableRowSelection: true });
    const all = () =>
      container!.querySelector<HTMLButtonElement>("thead [aria-label='Select all']")!;
    const boxes = container!.querySelectorAll<HTMLButtonElement>("tbody [aria-label='Select row']");
    expect(all().getAttribute("data-state")).toBe("unchecked");
    act(() => boxes[1]!.click());
    // Some, not all — and the box has to look different from both, or the
    // header claims a selection the user did not make.
    expect(all().getAttribute("data-state")).toBe("indeterminate");
    expect(all().className).toMatch(/data-\[state=indeterminate\]:bg-primary/);
    // The glyph follows the ROOT's rendered state, not the prop the caller
    // passed — `defaultChecked="indeterminate"` never sets `checked`, and an
    // uncontrolled box moves on click. Both icons ship; the group variant
    // picks one. (JSDOM does not evaluate Tailwind, so this pins the
    // contract; the painted result is checked in the app.)
    const indicator = () => all().querySelector<HTMLElement>("[data-state]:not([role])")!;
    expect(all().querySelector("[data-glyph='check']")).not.toBeNull();
    expect(all().querySelector("[data-glyph='minus']")).not.toBeNull();
    // Scoped to THIS indicator: a `group-*` variant would also match any
    // ancestor carrying `.group` and a `data-state` of its own.
    expect(indicator().className).toContain(
      "data-[state=indeterminate]:[&_[data-glyph=check]]:hidden",
    );
    expect(indicator().className).toContain(
      "data-[state=indeterminate]:[&_[data-glyph=minus]]:block",
    );
    expect(indicator().className).not.toMatch(/(^|\s)group-data-/);
    act(() => all().click());
    expect(all().getAttribute("data-state")).toBe("checked");
  });

  it("an UNCONTROLLED indeterminate box still resolves to the partial state", () => {
    // The prop the caller passed is not the state Radix rendered: with
    // `defaultChecked` there is no `checked` prop at all, and the box moves
    // on click. Anything that reads the props instead of the DOM gets this
    // wrong, which is why the glyph is chosen by `data-state`.
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    // try/finally: this root is outside the file's global afterEach, so a
    // failing assertion would otherwise leak a mounted tree into the next
    // test rather than just failing this one.
    try {
      act(() => root.render(<Checkbox defaultChecked="indeterminate" aria-label="Partial" />));
      const box = () => host.querySelector<HTMLButtonElement>("[aria-label='Partial']")!;
      expect(box().getAttribute("data-state")).toBe("indeterminate");
      // No `checked` prop exists here at all, so the glyph cannot come from one:
      // both ship, and the variant keyed to the root's state picks the minus.
      expect(box().querySelector("[data-glyph='minus']")).not.toBeNull();
      expect(box().querySelector("[data-glyph='check']")).not.toBeNull();
      expect(box().className).not.toMatch(/(^|\s)group(\s|$)/);
      // And it moves: an uncontrolled box that started indeterminate becomes
      // checked, which is the case a `defaultChecked` lookup would still call
      // indeterminate forever.
      act(() => box().click());
      expect(box().getAttribute("data-state")).toBe("checked");
    } finally {
      act(() => root.unmount());
      host.remove();
    }
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

it("opens evidence beside focus and Escape closes evidence before leaving focus", async () => {
  function Source() {
    const frame = useDataTableFrame()!;
    return (
      <>
        <button onClick={() => frame.setFocused(true)}>Focus test</button>
        <a
          href="/source"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            window.dispatchEvent(
              new CustomEvent("focus:open-source", {
                cancelable: true,
                detail: { type: "text", title: "Evidence", content: "Source passage" },
              }),
            );
          }}
        >
          Source
        </a>
      </>
    );
  }
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <DataTableFrame>
        <Source />
      </DataTableFrame>,
    ),
  );
  const original = container.querySelector("a");
  act(() => container!.querySelector<HTMLButtonElement>("button")!.click());
  act(() => document.querySelector<HTMLAnchorElement>('[role="dialog"] a')!.click());
  expect(document.querySelector('[aria-label="Citation source"]')?.textContent).toContain(
    "Source passage",
  );
  act(() =>
    document.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    ),
  );
  expect(document.querySelector('[aria-label="Citation source"]')).toBeNull();
  expect(document.querySelector('[role="dialog"] a')).toBe(original);
});

it("routes tool results into focus and leaves the underlying panel open on Escape", async () => {
  const { MemoryRouter } = await import("react-router");
  const { ToolPanel } = await import("../components/tool-panel.tsx");
  const { useToolPanelStore } = await import("../lib/tool-panel-store.ts");
  const { TooltipProvider } = await import("../ui/tooltip.tsx");
  function Source() {
    const frame = useDataTableFrame()!;
    return <button onClick={() => frame.setFocused(true)}>Focus graph</button>;
  }
  useToolPanelStore
    .getState()
    .openPanel({ type: "text", title: "Graph", content: "Underlying graph" });
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  act(() =>
    root!.render(
      <MemoryRouter>
        <TooltipProvider>
          <ToolPanel />
          <DataTableFrame>
            <Source />
          </DataTableFrame>
        </TooltipProvider>
      </MemoryRouter>,
    ),
  );
  act(() =>
    [...container!.querySelectorAll("button")]
      .find((button) => button.textContent === "Focus graph")!
      .click(),
  );
  act(() =>
    useToolPanelStore.getState().openPanel({ type: "text", title: "Empty result", content: "" }),
  );
  expect(document.querySelector('[aria-label="Citation source"]')?.textContent).toContain(
    "Empty result",
  );
  act(() =>
    useToolPanelStore
      .getState()
      .setContent({ type: "text", title: "Updated result", content: "Streamed content" }),
  );
  expect(document.querySelector('[aria-label="Citation source"]')?.textContent).toContain(
    "Streamed content",
  );

  act(() =>
    useToolPanelStore
      .getState()
      .openPanel({ type: "text", title: "Tool result", content: "Focused tool output" }),
  );
  expect(document.querySelector('[aria-label="Citation source"]')?.textContent).toContain(
    "Focused tool output",
  );
  const escape = () =>
    act(() =>
      document.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
      ),
    );
  escape();
  expect(document.querySelector('[aria-label="Citation source"]')).toBeNull();
  expect(document.querySelector('[role="dialog"]')).not.toBeNull();
  escape();
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  expect(useToolPanelStore.getState().isOpen).toBe(true);
  act(() => useToolPanelStore.getState().closePanel());
});

describe("column sizing", () => {
  it("resizes independently of sorting and pagination, clamps widths and resets to declared sizes", () => {
    const h = mount({
      pageSize: 1,
      initialState: { pagination: { pageIndex: 2, pageSize: 1 } },
      columns: [
        { accessorKey: "title", header: "Title", size: 240, minSize: 160, maxSize: 400 },
        selectionColumn<Task>(),
      ],
    });
    const resize = container!.querySelector('[aria-label="Resize Title column"]')!;
    const key = (key: string, shiftKey = false) =>
      act(() =>
        resize.dispatchEvent(new KeyboardEvent("keydown", { key, shiftKey, bubbles: true })),
      );
    key("ArrowRight");
    expect(h.table.getColumn("title")!.getSize()).toBe(250);
    expect(h.table.getState().pagination.pageIndex).toBe(2);
    expect(h.table.getState().sorting).toEqual([]);
    key("ArrowRight", true);
    expect(h.table.getColumn("title")!.getSize()).toBe(300);
    key("Home");
    expect(h.table.getColumn("title")!.getSize()).toBe(160);
    key("ArrowLeft");
    expect(h.table.getColumn("title")!.getSize()).toBe(160);
    key("End");
    expect(h.table.getColumn("title")!.getSize()).toBe(400);
    key("ArrowRight");
    expect(h.table.getColumn("title")!.getSize()).toBe(400);
    key("Enter");
    expect(h.table.getColumn("title")!.getSize()).toBe(240);
    expect(container!.querySelectorAll("[data-column-resize]")).toHaveLength(1);
    expect(h.table.getColumn("__select")!.getSize()).toBe(36);
  });

  it("round-trips namespaced user widths, preserves defaults and rejects malformed sizes", () => {
    const options = { prefix: "risk.", defaults: { columnSizing: { title: 300 } } };
    expect(parseDataTableState(new URLSearchParams(), options).columnSizing).toEqual({
      title: 300,
    });
    const encoded = serializeDataTableState(
      { columnSizing: { title: 440, "odd,id": 160 } },
      options,
    );
    expect(parseDataTableState(encoded, options).columnSizing).toEqual({
      title: 440,
      "odd,id": 160,
    });
    const reset = serializeDataTableState({ columnSizing: {} }, options);
    expect(reset.has("risk.widths")).toBe(true);
    expect(parseDataTableState(reset, options).columnSizing).toEqual({});
    const invalid = new URLSearchParams({
      "risk.widths": JSON.stringify({
        title: 220,
        negative: -1,
        zero: 0,
        string: "400",
        huge: Infinity,
      }),
    });
    expect(parseDataTableState(invalid, options).columnSizing).toEqual({ title: 220 });
    expect(
      parseDataTableState(new URLSearchParams({ "risk.widths": "oops" }), options).columnSizing,
    ).toEqual({});
  });
});

it("reveals keyboard-active rows above a non-overlay scrollbar without moving horizontally", () => {
  let height = 100;
  let active: string | undefined;
  const render = () =>
    act(() =>
      root!.render(
        <Harness
          tableProps={{ maxHeight: height }}
          activeRowId={active}
          onActiveRowChange={(row) => {
            active = row?.id;
            render();
          }}
          onTable={() => {}}
        />,
      ),
    );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  render();
  const scroller = container.querySelector("[data-list-scroller]") as HTMLElement;
  Object.defineProperties(scroller, {
    clientTop: { value: 2 },
    clientHeight: { get: () => height },
    scrollHeight: { value: 500 },
  });
  scroller.scrollLeft = 84;
  scroller.getBoundingClientRect = () => ({ top: 0, bottom: 120, height: 120 }) as DOMRect;
  const row = container.querySelector("tbody tr[data-row-id]") as HTMLElement;
  row.getBoundingClientRect = () =>
    ({ top: 85 - scroller.scrollTop, bottom: 115 - scroller.scrollTop, height: 30 }) as DOMRect;
  const header = container.querySelector("thead") as HTMLElement;
  header.getBoundingClientRect = () => ({ height: 20 }) as DOMRect;
  const ancestor = document.createElement("div");
  ancestor.style.overflowY = "auto";
  container.parentElement!.append(ancestor);
  ancestor.append(container);
  ancestor.scrollLeft = 28;
  ancestor.scrollTop = 90;
  row.scrollIntoView = vi.fn(() => {
    // Native reveal can move several scroll ancestors, including horizontally.
    ancestor.scrollTop = 40;
    ancestor.scrollLeft = 0;
    scroller.scrollLeft = 0;
  });
  act(() =>
    container!
      .querySelector("table")!
      .dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })),
  );
  expect(active).toBe("t1");
  expect(row.scrollIntoView).toHaveBeenCalledWith({
    block: "nearest",
    inline: "nearest",
    behavior: "instant",
  });
  expect(ancestor.scrollTop).toBe(40);
  expect(ancestor.scrollLeft).toBe(28);
  expect(scroller.scrollTop).toBe(13);
  expect(scroller.scrollLeft).toBe(84);
  height = 60;
  render();
  expect(active).toBe("t1");
  expect(scroller.scrollTop).toBe(53);
  expect(scroller.scrollLeft).toBe(84);
  ancestor.replaceWith(container!);
});

it("keeps ordinary columns readable at Home and allows explicit compact bounds", () => {
  const h = mount({
    columns: [
      { accessorKey: "title", header: "Title" },
      { accessorKey: "status", header: "Status", size: 40, minSize: 24, maxSize: 80 },
    ],
  });
  const home = (label: string) =>
    act(() =>
      container!
        .querySelector(`[aria-label="Resize ${label} column"]`)!
        .dispatchEvent(new KeyboardEvent("keydown", { key: "Home", bubbles: true })),
    );
  home("Title");
  expect(h.table.getColumn("title")!.getSize()).toBe(80);
  home("Status");
  expect(h.table.getColumn("status")!.getSize()).toBe(24);
});

it("starts a new page at its top without moving horizontal position or resetting on resize", () => {
  const instance = mount({
    initialState: { pagination: { pageIndex: 0, pageSize: 2 } },
    tableProps: { maxHeight: 300, stableHeight: true },
  });
  const scroller =
    container!.querySelector<HTMLElement>("[data-table-scroll]") ??
    container!.querySelector<HTMLElement>(".overflow-auto");
  expect(scroller).not.toBeNull();
  scroller!.scrollTop = 60;
  scroller!.scrollLeft = 84;
  act(() => instance.table.setPageIndex(1));
  expect(scroller!.scrollTop).toBe(0);
  expect(scroller!.scrollLeft).toBe(84);
  expect(scroller!.style.height).toBe("300px");
  scroller!.scrollTop = 60;
  act(() => instance.table.setColumnSizing({ title: 300 }));
  expect(scroller!.scrollTop).toBe(60);
});

it("keeps bounded headers opaque even inside host translucent-header styles", () => {
  mount({ tableProps: { maxHeight: 300, className: "[&_thead]:bg-muted/40" } });
  const header = container!.querySelector("thead")!;
  expect(header.style.backgroundColor).toBe("var(--card)");
});

it.each([false, true])(
  "releases a wide pinned boundary while preserving only a leading selection utility (%s)",
  (selection) => {
    const callbacks: Array<() => void> = [];
    const previous = window.ResizeObserver;
    Object.defineProperty(window, "ResizeObserver", {
      writable: true,
      value: class {
        constructor(callback: () => void) {
          callbacks.push(callback);
        }
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    });
    try {
      mount({
        columns: [
          ...(selection ? [selectionColumn<Task>()] : []),
          { accessorKey: "title", header: "Title", size: 80 },
          { accessorKey: "status", header: "Status", size: 80 },
          { accessorKey: "priority", header: "Priority", size: 320, meta: { pinned: "left" } },
          { accessorKey: "tags", header: "Tags", size: 200 },
        ],
      });
      const scroller = container!.querySelector("[data-list-scroller]")!;
      Object.defineProperty(scroller, "clientWidth", { get: () => 400 });
      act(() => callbacks.forEach((callback) => callback()));
      expect(container!.querySelectorAll("thead [data-pinned]")).toHaveLength(selection ? 1 : 0);
      if (selection)
        expect(
          container!
            .querySelector('[aria-label="Select all"]')
            ?.closest("th")
            ?.hasAttribute("data-pinned"),
        ).toBe(true);
    } finally {
      Object.defineProperty(window, "ResizeObserver", { writable: true, value: previous });
    }
  },
);

it("contains the terminal resize target only when no trailing spacer exists", () => {
  mount({
    tableProps: { spacer: false },
    columns: [
      { accessorKey: "title", header: "Title" },
      { accessorKey: "status", header: "Status" },
    ],
  });
  expect(container!.querySelectorAll("[data-column-resize-terminal]")).toHaveLength(1);
  expect(
    container!.querySelector("[data-column-resize-terminal]")!.getAttribute("aria-label"),
  ).toBe("Resize Status column");
});
