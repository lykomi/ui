import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import type { ColumnDef, Table } from "@tanstack/react-table";
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
});

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
