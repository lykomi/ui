import { useEffect, useRef, useSyncExternalStore } from "react";

// Branches belong to this document's working set. Persistent group preferences
// (for example a collapsed Admin section) deliberately use separate storage.
let expanded: ReadonlyMap<string, boolean> = new Map();
const listeners = new Set<() => void>();
const read = () => expanded;
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function useTreeExpanded(
  to: string,
  inside: boolean,
  onExpandedChange?: (expanded: boolean) => void,
  forceClosed = false,
): [boolean, (expanded: boolean) => void] {
  const state = useSyncExternalStore(subscribe, read, read);
  const isExpanded = !forceClosed && (state.get(to) ?? inside);
  const callback = useRef(onExpandedChange);
  callback.current = onExpandedChange;
  const available = Boolean(onExpandedChange);
  const reported = useRef<{ to: string; expanded: boolean; available: boolean } | null>(null);
  const setExpanded = (value: boolean) => {
    if (expanded.get(to) === value) return;
    expanded = new Map(expanded).set(to, value);
    for (const listener of listeners) listener();
  };
  useEffect(() => {
    if (inside && !forceClosed && !expanded.has(to)) setExpanded(true);
  }, [inside, to, forceClosed]);
  useEffect(() => {
    const previous = reported.current;
    if (previous?.to === to && previous.expanded === isExpanded && previous.available === available)
      return;
    reported.current = { to, expanded: isExpanded, available };
    callback.current?.(isExpanded);
  }, [isExpanded, to, available]);
  return [isExpanded, setExpanded];
}
