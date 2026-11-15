import type { DataTableState } from "@lykomi/web-ui";

export interface GardenTask {
  id: string;
  name: string;
  status: string;
  owner: string;
}
const names = [
  "Choose a garden site",
  "Gather planting ideas",
  "Plan shared watering",
  "Check access to water",
  "Invite neighbors",
  "Estimate supply costs",
];
export function createTasks(): GardenTask[] {
  return Array.from({ length: 120 }, (_, index) => ({
    id: `t${index + 1}`,
    name: `${names[index % names.length]}${index < 6 ? "" : ` · Plot ${Math.floor(index / 6) + 1}`}`,
    status: ["Ready", "In progress", "Ready", "Blocked", "Complete", "Ready"][index % 6],
    owner: ["Alex", "Sam", "Mika"][index % 3],
  }));
}

/** Local demo of a query service: filter/sort BEFORE taking a batch. */
export function queryTasks(tasks: GardenTask[], state: DataTableState): GardenTask[] {
  const tokens = state.globalFilter.toLowerCase().split(/\s+/).filter(Boolean);
  const filtered = tasks.filter(
    (task) =>
      tokens.every((token) =>
        `${task.name} ${task.status} ${task.owner}`.toLowerCase().includes(token),
      ) &&
      state.columnFilters.every(
        ({ id, value }) =>
          !Array.isArray(value) || !value.length || value.includes(task[id as keyof GardenTask]),
      ),
  );
  return filtered.sort((a, b) => {
    for (const { id, desc } of state.sorting) {
      const order = String(a[id as keyof GardenTask]).localeCompare(
        String(b[id as keyof GardenTask]),
      );
      if (order) return desc ? -order : order;
    }
    return 0;
  });
}
