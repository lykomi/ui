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
): [boolean, (expanded: boolean) => void] {
  const state = useSyncExternalStore(subscribe, read, read);
  const isExpanded = state.get(to) ?? inside;
  const callback = useRef(onExpandedChange);
  callback.current = onExpandedChange;
  const setExpanded = (value: boolean) => {
    if (expanded.get(to) === value) return;
    expanded = new Map(expanded).set(to, value);
    for (const listener of listeners) listener();
  };
  useEffect(() => {
    if (inside && !expanded.has(to)) setExpanded(true);
  }, [inside, to]);
  useEffect(() => {
    callback.current?.(isExpanded);
  }, [isExpanded, to, onExpandedChange]);
  return [isExpanded, setExpanded];
}
