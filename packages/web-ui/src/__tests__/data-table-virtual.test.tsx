import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { ColumnDef, Table } from "@tanstack/react-table";
import { DataTableRowActions } from "../components/data-table/data-table-row-actions.tsx";
import { DataTable } from "../components/data-table/data-table.tsx";
import { useDataTable } from "../components/data-table/use-data-table.ts";

interface Item {
  id: string;
  name: string;
}
const columns: ColumnDef<Item>[] = [
  {
    accessorKey: "name",
    header: "Name",
    cell: ({ row }) => (
      <>
        <span>{row.original.name}</span>
        <input aria-label={`Note ${row.id}`} defaultValue="draft" />
      </>
    ),
  },
];
const items = Array.from({ length: 10000 }, (_, index) => ({
  id: `item-${index}`,
  name: `Item ${index}`,
}));
let table: Table<Item>;
let host: HTMLDivElement;
let root: Root;
let printChange: (() => void) | undefined;
let printing = false;
function Harness({ data = items, grouped = false }: { data?: Item[]; grouped?: boolean }) {
  const [active, setActive] = useState<string | null>(null);
  table = useDataTable({
    data,
    columns,
    getRowId: (item) => item.id,
    pageSize: false,
    groupBy: grouped ? "name" : null,
  });
  return (
    <DataTable
      table={table}
      renderGroup={
        grouped ? (row) => <input aria-label={`Group ${row.id}`} defaultValue="draft" /> : undefined
      }
      activeRowId={active}
      onActiveRowChange={(row) => setActive(row?.id ?? null)}
      onRowOpen={() => {}}
      aria-label="Items"
    />
  );
}
beforeEach(() => {
  printing = false;
  vi.stubGlobal("matchMedia", (query: string) => ({
    get matches() {
      return query === "print" && printing;
    },
    addEventListener: (_: string, callback: () => void) => {
      if (query === "print") printChange = callback;
    },
    removeEventListener() {},
  }));
  class Observer {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  vi.stubGlobal("ResizeObserver", Observer);
  vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockImplementation(function () {
    return this.matches("[data-list-scroller]") ? 400 : this.matches("thead") ? 40 : 48;
  });
  vi.spyOn(HTMLElement.prototype, "offsetWidth", "get").mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(400);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    return {
      height: this.matches("thead") ? 40 : 48,
      width: 800,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: 48,
      toJSON() {
        return {};
      },
    };
  });
  HTMLElement.prototype.scrollIntoView = vi.fn();
  HTMLElement.prototype.scrollTo = function (options: ScrollToOptions | number) {
    if (typeof options === "object") this.scrollTop = options.top ?? this.scrollTop;
    this.dispatchEvent(new Event("scroll"));
  };
  host = document.createElement("div");
  document.body.appendChild(host);
  root = createRoot(host);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
async function mount(data = items) {
  await act(async () => root.render(<Harness data={data} />));
}
it("windows 10,000 rows without paginating or losing filter coverage", async () => {
  await mount();
  expect(host.querySelectorAll("tr[data-row-id]").length).toBeLessThan(50);
  expect(host.querySelector("table")?.getAttribute("aria-rowcount")).toBe("10001");
  expect(table.getRowModel().rows).toHaveLength(10000);
  await act(async () => table.setGlobalFilter("Item 9999"));
  expect(host.textContent).toContain("Item 9999");
  expect(host.querySelectorAll("tr[data-row-id]")).toHaveLength(1);
});
it("moves keyboard focus to the final row beyond the rendered window", async () => {
  await mount();
  const row = host.querySelector<HTMLElement>("tr[data-row-id]")!;
  await act(async () => {
    row.focus();
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "End", bubbles: true }));
  });
  expect(host.querySelector('[data-row-id="item-9999"]')).not.toBeNull();
  expect(document.activeElement?.getAttribute("data-row-id")).toBe("item-9999");
});
it("retains a focused cell draft when scrolling its row out of range", async () => {
  await mount();
  const input = host.querySelector<HTMLInputElement>('input[aria-label="Note item-0"]')!;
  await act(async () => {
    input.focus();
    input.value = "unsaved";
  });
  await act(async () => {
    const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
    scroller.scrollTop = 20000;
    scroller.dispatchEvent(new Event("scroll"));
  });
  expect(host.querySelector('input[aria-label="Note item-0"]')).toBe(input);
  expect(input.value).toBe("unsaved");
  expect(host.querySelectorAll("tr[data-row-id]").length).toBeLessThan(60);
});
it("renders all rows for print and restores the bounded window afterwards", async () => {
  await mount(items.slice(0, 2500));
  await act(async () => {
    printing = true;
    printChange?.();
  });
  expect(host.querySelectorAll("tr[data-row-id]")).toHaveLength(2500);
  await act(async () => {
    printing = false;
    printChange?.();
  });
  expect(host.querySelectorAll("tr[data-row-id]").length).toBeLessThan(50);
}, 15000);

it("does not snap back to the active row during manual scrolling", async () => {
  await mount();
  const row = host.querySelector<HTMLElement>("tr[data-row-id]")!;
  await act(async () => {
    row.focus();
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  });
  const reveal = HTMLElement.prototype.scrollIntoView as ReturnType<typeof vi.fn>;
  const before = reveal.mock.calls.length;
  await act(async () => {
    const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
    scroller.scrollTop = 20000;
    scroller.dispatchEvent(new Event("scroll"));
  });
  expect(reveal.mock.calls.length).toBe(before);
  expect(host.querySelector<HTMLElement>("[data-list-scroller]")!.scrollTop).toBe(20000);
});

it("keeps a focused grouped-row draft mounted outside the window", async () => {
  await act(async () => root.render(<Harness grouped />));
  const input = host.querySelector<HTMLInputElement>("tr[data-group-row] input")!;
  expect(input).not.toBeNull();
  await act(async () => {
    input.focus();
    input.value = "group draft";
  });
  await act(async () => {
    const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
    scroller.scrollTop = 20000;
    scroller.dispatchEvent(new Event("scroll"));
  });
  expect(input.isConnected).toBe(true);
  expect(document.activeElement).toBe(input);
  expect(input.value).toBe("group draft");
});
it("commits every row synchronously during the native beforeprint event", async () => {
  await mount(items.slice(0, 250));
  let countDuringEvent = 0;
  const capture = () => {
    countDuringEvent = host.querySelectorAll("tr[data-row-id]").length;
  };
  window.addEventListener("beforeprint", capture);
  await act(async () => window.dispatchEvent(new Event("beforeprint")));
  window.removeEventListener("beforeprint", capture);
  expect(countDuringEvent).toBe(250);
  await act(async () => window.dispatchEvent(new Event("afterprint")));
  expect(host.querySelectorAll("tr[data-row-id]").length).toBeLessThan(50);
});
it("measures cells rather than inflated native table-row bounds", async () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const height = this.matches("tr") ? 96 : this.matches("thead") ? 40 : 48;
    return {
      height,
      width: 800,
      x: 0,
      y: 0,
      top: 0,
      left: 0,
      right: 800,
      bottom: height,
      toJSON() {
        return {};
      },
    };
  });
  await mount(items.slice(0, 250));
  const spacer = host.querySelector<HTMLTableCellElement>("tbody tr:last-child td")!;
  expect(parseFloat(spacer.style.height)).toBeLessThan(250 * 48);
  expect(parseFloat(spacer.style.height)).toBeGreaterThan(200 * 48);
});

it("keeps automatically bounded tables below the fold at a positive height", async () => {
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
    const height = this.matches("thead") ? 40 : 48;
    return {
      height,
      width: 800,
      x: 0,
      y: 2000,
      top: 2000,
      left: 0,
      right: 800,
      bottom: 2000 + height,
      toJSON() {
        return {};
      },
    };
  });
  await mount(items.slice(0, 250));
  expect(host.querySelector<HTMLElement>("[data-list-scroller]")!.style.maxHeight).toBe("70vh");
});
it("lets a dedicated page own scrolling and offset its sticky header", async () => {
  function PageList() {
    const instance = useDataTable({
      data: items.slice(0, 120),
      columns,
      getRowId: (item) => item.id,
      pageSize: false,
    });
    return <DataTable table={instance} scrollMode="page" stickyHeaderOffset={96} />;
  }
  await act(async () => root.render(<PageList />));
  expect(host.querySelector("[data-list-root]")?.className).toContain("overflow-visible");
  expect(host.querySelector("[data-list-scroller]")?.className).toContain("overflow-visible");
  expect(host.querySelector<HTMLElement>("thead")?.style.top).toBe("96px");
  expect(host.querySelectorAll("tr[data-row-id]")).toHaveLength(120);
});
it("provides roving keyboard navigation when the host supplies only row opening", async () => {
  const open = vi.fn();
  function Uncontrolled() {
    const instance = useDataTable({
      data: items,
      columns,
      getRowId: (item) => item.id,
      pageSize: false,
    });
    return <DataTable table={instance} onRowOpen={open} aria-label="Uncontrolled items" />;
  }
  await act(async () => root.render(<Uncontrolled />));
  expect(host.querySelectorAll('tr[data-row-id][tabindex="0"]')).toHaveLength(1);
  await act(async () => {
    const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
    scroller.scrollTop = 20000;
    scroller.dispatchEvent(new Event("scroll"));
  });
  expect(host.querySelectorAll('tr[data-row-id][tabindex="0"]')).toHaveLength(1);
  const first = host.querySelector<HTMLElement>('tr[data-row-id][tabindex="0"]')!;
  const initialId = first.dataset.rowId!;
  expect(initialId).not.toBe("item-0");
  await act(async () => first.focus());
  await act(async () =>
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })),
  );
  expect(document.activeElement?.getAttribute("data-row-id")).toBe(
    `item-${Number(initialId.slice(5)) + 1}`,
  );
  await act(async () => {
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "End", bubbles: true }),
    );
  });
  const last = host.querySelector<HTMLElement>('[data-row-id="item-9999"]')!;
  expect(last).not.toBeNull();
  expect(document.activeElement).toBe(last);
  await act(async () =>
    last.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true })),
  );
  expect(open).toHaveBeenCalledOnce();
  expect(open.mock.calls[0][0].id).toBe("item-9999");
});

it("tabs through sparse cell controls beyond the mounted window and exits the table", async () => {
  const blur = vi.fn();
  function Controls() {
    const instance = useDataTable({
      data: items.slice(0, 250),
      columns: [
        {
          accessorKey: "name",
          cell: ({ row }) =>
            row.index === 0 || row.index === 100 ? (
              <input
                aria-label={`Sparse ${row.index}`}
                defaultValue="draft"
                onBlur={(event) => blur(event.target.value)}
              />
            ) : (
              row.original.name
            ),
        },
      ],
      getRowId: (item) => item.id,
      pageSize: false,
    });
    return (
      <>
        <DataTable table={instance} />
        <button>After table</button>
      </>
    );
  }
  await act(async () => root.render(<Controls />));
  const first = host.querySelector<HTMLInputElement>('input[aria-label="Sparse 0"]')!;
  await act(async () => {
    first.focus();
    first.value = "saved draft";
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  });
  await vi.waitFor(() =>
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Sparse 100"),
  );
  expect(blur).toHaveBeenCalledWith("saved draft");
  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
    ),
  );
  await vi.waitFor(() => expect(document.activeElement).toBe(first));
  await act(async () =>
    first.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true })),
  );
  await vi.waitFor(() =>
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Sparse 100"),
  );
  await act(async () =>
    document.activeElement!.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Tab", bubbles: true }),
    ),
  );
  await vi.waitFor(() => expect(document.activeElement?.textContent).toBe("After table"));
});

it("keeps the host active row authoritative while moving internal keyboard focus", async () => {
  function ControlledDisplay() {
    const instance = useDataTable({
      data: items,
      columns,
      getRowId: (item) => item.id,
      pageSize: false,
    });
    return <DataTable table={instance} activeRowId="item-0" onRowOpen={() => {}} />;
  }
  await act(async () => root.render(<ControlledDisplay />));
  const row = host.querySelector<HTMLElement>('[data-row-id="item-1"]')!;
  await act(async () => row.focus());
  await act(async () =>
    row.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })),
  );
  expect(document.activeElement?.getAttribute("data-row-id")).toBe("item-2");
  expect(host.querySelector("[data-active]")?.getAttribute("data-row-id")).toBe("item-0");
  expect(host.querySelector('[aria-current="true"]')?.getAttribute("data-row-id")).toBe("item-0");
});

it("finds off-window controls when entering from either table boundary", async () => {
  function Sparse() {
    const instance = useDataTable({
      data: items.slice(0, 250),
      columns: [
        {
          accessorKey: "name",
          enableResizing: false,
          enableSorting: false,
          cell: ({ row }) =>
            row.index === 100 ? <input aria-label="Only control" /> : row.original.name,
        },
      ],
      getRowId: (item) => item.id,
      pageSize: false,
    });
    return (
      <>
        <button>Before</button>
        <DataTable table={instance} />
        <button>After</button>
      </>
    );
  }
  await act(async () => root.render(<Sparse />));
  expect(host.querySelector('[aria-label="Only control"]')).toBeNull();
  const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
  await act(async () => {
    scroller.focus();
    scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  });
  await vi.waitFor(() =>
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Only control"),
  );
  await act(async () => host.querySelector<HTMLElement>("button:last-child")!.focus());
  await act(async () => host.querySelector<HTMLElement>("[data-virtual-boundary]")!.focus());
  await vi.waitFor(() =>
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Only control"),
  );
});

it("leaves large plain read-only tables in native Tab order without probing rows", async () => {
  function Plain() {
    const instance = useDataTable({
      data: items,
      columns: [{ accessorKey: "name", enableSorting: false, enableResizing: false }],
      getRowId: (item) => item.id,
      pageSize: false,
    });
    return <DataTable table={instance} />;
  }
  await act(async () => root.render(<Plain />));
  const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
  const count = host.querySelectorAll("tr[data-virtual-row-id]").length;
  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  await act(async () => {
    scroller.focus();
    scroller.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(false);
  expect(host.querySelector("[data-virtual-boundary]")).toBeNull();
  expect(host.querySelectorAll("tr[data-virtual-row-id]")).toHaveLength(count);
});

it("skips declared readonly custom cells without probing the logical rows", async () => {
  function Plain() {
    const instance = useDataTable({
      data: items,
      columns: [
        {
          accessorKey: "name",
          cell: ({ row }) => <span>{row.original.name}</span>,
          enableSorting: false,
          enableResizing: false,
        },
      ],
      pageSize: false,
    });
    return <DataTable table={instance} getRowMayHaveTabStops={() => false} />;
  }
  await act(async () => root.render(<Plain />));
  const count = host.querySelectorAll("tr[data-virtual-row-id]").length;
  const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  await act(async () => {
    scroller.focus();
    scroller.dispatchEvent(event);
  });
  expect(event.defaultPrevented).toBe(false);
  expect(host.querySelector("[data-virtual-boundary]")).toBeNull();
  expect(host.querySelectorAll("tr[data-virtual-row-id]")).toHaveLength(count);
});

it("jumps to a declared sparse cell and permits native document exit", async () => {
  function Sparse() {
    const instance = useDataTable({
      data: items,
      columns: [
        {
          accessorKey: "name",
          cell: ({ row }) =>
            row.index === 9000 ? <input aria-label="Sparse last" /> : row.original.name,
          enableSorting: false,
          enableResizing: false,
        },
      ],
      pageSize: false,
    });
    return <DataTable table={instance} getRowMayHaveTabStops={(row) => row.index === 9000} />;
  }
  await act(async () => root.render(<Sparse />));
  const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
  await act(async () => {
    scroller.focus();
    scroller.dispatchEvent(new KeyboardEvent("keydown", { key: "Tab", bubbles: true }));
  });
  await vi.waitFor(() =>
    expect(document.activeElement?.getAttribute("aria-label")).toBe("Sparse last"),
  );
  expect(host.querySelectorAll("tr[data-virtual-row-id]").length).toBeLessThan(50);
  const event = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  await act(async () => document.activeElement!.dispatchEvent(event));
  expect(event.defaultPrevented).toBe(false);
  await act(async () => host.querySelector<HTMLElement>("[data-virtual-boundary]")!.focus());
  const exit = new KeyboardEvent("keydown", { key: "Tab", bubbles: true, cancelable: true });
  await act(async () => document.activeElement!.dispatchEvent(exit));
  expect(exit.defaultPrevented).toBe(false);
});

it("keeps the row mounted while its portaled action menu owns focus", async () => {
  function Actions() {
    const instance = useDataTable({
      data: items,
      columns: [
        {
          accessorKey: "name",
          cell: ({ row }) => (
            <DataTableRowActions
              label={`Actions ${row.id}`}
              actions={[{ label: "Inspect", onSelect: () => {} }]}
            />
          ),
        },
      ],
      getRowId: (item) => item.id,
      pageSize: false,
    });
    return <DataTable table={instance} />;
  }
  await act(async () => root.render(<Actions />));
  const trigger = host.querySelector<HTMLButtonElement>('tr[data-row-id="item-0"] button')!;
  await act(async () => trigger.focus());
  await act(async () =>
    trigger.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true })),
  );
  await vi.waitFor(() => expect(document.querySelector('[role="menu"]')).not.toBeNull());
  const menu = document.querySelector<HTMLElement>('[role="menu"]')!;
  await act(async () => menu.querySelector<HTMLElement>('[role="menuitem"]')!.focus());
  const scroller = host.querySelector<HTMLElement>("[data-list-scroller]")!;
  await act(async () => {
    scroller.scrollTop = 20000;
    scroller.dispatchEvent(new Event("scroll"));
  });
  expect(trigger.isConnected).toBe(true);
  expect(menu.isConnected).toBe(true);
});
