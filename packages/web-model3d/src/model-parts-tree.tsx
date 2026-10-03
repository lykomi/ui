import { useEffect, useRef, useState } from "react";
import { Box, ChevronDown, ChevronRight, Layers } from "lucide-react";
import type { ModelPart } from "./model-types.ts";

export function ModelPartsTree({
  parts,
  selectedIds,
  onSelect,
}: {
  parts: ModelPart[];
  selectedIds: string[];
  onSelect: (id: string) => void;
}) {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState<string>();
  const tree = useRef<HTMLDivElement>(null);
  const byId = new Map(parts.map((p) => [p.id, p]));
  const children = new Map<string | null, ModelPart[]>();
  for (const part of parts) {
    const parent = byId.has(part.parentId ?? "") ? part.parentId : null;
    const siblings = children.get(parent);
    if (siblings) siblings.push(part);
    else children.set(parent, [part]);
  }
  const selection = selectedIds.join(",");
  useEffect(() => {
    setCollapsed((previous) => {
      const next = new Set(previous);
      for (const id of selectedIds) {
        let parent = byId.get(id)?.parentId;
        while (parent) {
          next.delete(parent);
          parent = byId.get(parent)?.parentId;
        }
      }
      return next;
    });
  }, [selection, parts]);
  const matching = new Set<string>();
  const search = query.trim().toLocaleLowerCase();
  if (search)
    for (const part of parts) {
      if (!`${part.name} ${JSON.stringify(part.metadata)}`.toLocaleLowerCase().includes(search))
        continue;
      let current: ModelPart | undefined = part;
      while (current && !matching.has(current.id)) {
        matching.add(current.id);
        current = byId.get(current.parentId ?? "");
      }
    }
  const rows: { part: ModelPart; depth: number }[] = [];
  const pending = (children.get(null) ?? [])
    .slice()
    .reverse()
    .map((part) => ({ part, depth: 1 }));
  while (pending.length) {
    const row = pending.pop()!;
    if (search && !matching.has(row.part.id)) continue;
    rows.push(row);
    if (search || !collapsed.has(row.part.id))
      for (const part of (children.get(row.part.id) ?? []).slice().reverse())
        pending.push({ part, depth: row.depth + 1 });
  }
  const toggle = (id: string) =>
    setCollapsed((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const move = (id: string) => {
    setFocused(id);
    const index = rows.findIndex((row) => row.part.id === id);
    tree.current?.querySelectorAll<HTMLElement>('[role="treeitem"]')[index]?.focus();
  };
  return (
    <aside
      className="flex w-56 shrink-0 flex-col border-r bg-background max-sm:w-40"
      aria-label="Model structure"
    >
      <div className="border-b p-3">
        <h2 className="mb-2 text-sm font-medium">Structure</h2>
        <input
          aria-label="Find model parts"
          placeholder="Find parts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-full rounded-lg border bg-background px-2 text-sm"
        />
      </div>
      <div
        ref={tree}
        role="tree"
        aria-label="Parts and assemblies"
        className="min-h-0 flex-1 overflow-auto py-2"
      >
        {rows.map(({ part, depth }, index) => {
          const branch = children.has(part.id);
          const expanded = !!search || !collapsed.has(part.id);
          const selected = selectedIds.includes(part.id);
          return (
            <div
              key={part.id}
              role="treeitem"
              aria-level={depth}
              aria-selected={selected}
              aria-expanded={branch ? expanded : undefined}
              tabIndex={
                (rows.some((r) => r.part.id === focused) ? focused === part.id : index === 0)
                  ? 0
                  : -1
              }
              className={`flex cursor-pointer items-center gap-1 py-1.5 pr-2 text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring ${selected ? "bg-accent text-accent-foreground" : ""}`}
              style={{ paddingLeft: 8 + Math.min(depth - 1, 8) * 14 }}
              onFocus={() => setFocused(part.id)}
              onClick={() => onSelect(part.id)}
              onKeyDown={(e) => {
                if (
                  ![
                    "ArrowDown",
                    "ArrowUp",
                    "ArrowLeft",
                    "ArrowRight",
                    "Home",
                    "End",
                    "Enter",
                    " ",
                  ].includes(e.key)
                )
                  return;
                e.preventDefault();
                if (e.key === "ArrowDown") move(rows[Math.min(index + 1, rows.length - 1)].part.id);
                if (e.key === "ArrowUp") move(rows[Math.max(index - 1, 0)].part.id);
                if (e.key === "Home") move(rows[0].part.id);
                if (e.key === "End") move(rows[rows.length - 1].part.id);
                if (e.key === "ArrowRight" && branch) {
                  if (!expanded) toggle(part.id);
                  else if (rows[index + 1]) move(rows[index + 1].part.id);
                }
                if (e.key === "ArrowLeft") {
                  if (branch && expanded && !search) toggle(part.id);
                  else if (part.parentId) move(part.parentId);
                }
                if (e.key === "Enter" || e.key === " ") onSelect(part.id);
              }}
            >
              {branch ? (
                <button
                  tabIndex={-1}
                  aria-label={`${expanded ? "Collapse" : "Expand"} ${part.name}`}
                  className="shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggle(part.id);
                  }}
                >
                  {expanded ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                </button>
              ) : (
                <span className="w-3 shrink-0" />
              )}
              {part.kind === "assembly" ? (
                <Layers className="size-3.5 shrink-0 text-muted-foreground" />
              ) : (
                <Box className="size-3.5 shrink-0 text-muted-foreground" />
              )}
              <span className="truncate" title={part.name}>
                {part.name}
              </span>
            </div>
          );
        })}
        {!rows.length && <p className="px-3 text-sm text-muted-foreground">No matching parts</p>}
      </div>
    </aside>
  );
}
