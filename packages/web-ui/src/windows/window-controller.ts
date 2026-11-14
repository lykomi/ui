import type { ReactNode } from "react";

export type WindowLayout = "tabs" | "panels";
export interface WorkbenchWindow {
  id: string;
  title: ReactNode;
  dirty?: boolean;
  kept?: boolean;
  pinOverride?: boolean;
  independent?: boolean;
  panelWidth?: number;
  detailOf?: string;
  detailMaximized?: boolean;
  close: () => void;
}
export interface WindowSnapshot<T extends WorkbenchWindow = WorkbenchWindow> {
  tabs: T[];
  active: string;
  layout: WindowLayout;
}
export interface WindowHost<T extends WorkbenchWindow, S extends WindowSnapshot<T>> {
  get: () => S;
  set: (state: S) => void;
  subscribe: (listener: () => void) => () => void;
  storageKey?: string;
  emptyActive?: string;
  hasDraft?: (tab: T) => boolean;
  beforeLeave?: () => Promise<boolean> | undefined;
  beforeSelect?: (id: string, notify: boolean) => void;
  afterSelect?: (id: string, notify: boolean, changed: boolean) => void;
  beforeRemove?: (id: string) => void;
  captureScroll?: (id: string) => void;
  forgetScroll?: (id: string) => void;
}

export function preferredWindowLayout(storageKey?: string): WindowLayout {
  try {
    return storageKey && localStorage.getItem(storageKey) === "panels" ? "panels" : "tabs";
  } catch {
    return "tabs";
  }
}

/** Shared window operations against either a standalone store or a host's existing state. */
export function createWindowController<T extends WorkbenchWindow, S extends WindowSnapshot<T>>(
  host: WindowHost<T, S>,
) {
  let revision = 0;
  let pendingTarget: string | undefined;
  const hasDraft = host.hasDraft ?? ((tab: T) => Boolean(tab.dirty));
  const patch = (values: Partial<S>) => host.set({ ...host.get(), ...values });
  const update = (id: string, values: Partial<T>) =>
    patch({
      tabs: host.get().tabs.map((tab) => (tab.id === id ? { ...tab, ...values } : tab)),
    } as Partial<S>);
  const controller = {
    get: host.get,
    subscribe: host.subscribe,
    hasDraft,
    update,
    captureSelection() {
      const captured = revision;
      const active = host.get().active;
      return () => revision === captured && host.get().active === active;
    },
    /** A newer navigation invalidates an older asynchronous leave decision. */
    transition(
      action: () => void,
      cancelled?: () => void,
      signal?: AbortSignal,
      targetId?: string,
    ): boolean | Promise<boolean> {
      const requested = ++revision;
      pendingTarget = targetId;
      const apply = (allowed: boolean) => {
        if (requested === revision) pendingTarget = undefined;
        if (!allowed || requested !== revision || signal?.aborted) {
          cancelled?.();
          return false;
        }
        action();
        return true;
      };
      if (signal?.aborted) return apply(false);
      const guard = host.beforeLeave?.();
      return guard ? guard.then(apply, () => apply(false)) : apply(true);
    },
    select(id: string, options?: { notify?: boolean; signal?: AbortSignal }) {
      const notify = options?.notify !== false;
      const apply = () => {
        host.captureScroll?.(host.get().active);
        host.beforeSelect?.(id, notify);
        patch({ active: id } as Partial<S>);
        host.afterSelect?.(id, notify, true);
      };
      if (host.get().active === id) {
        ++revision;
        pendingTarget = undefined;
        if (options?.signal?.aborted) return false;
        host.afterSelect?.(id, notify, false);
        return true;
      }
      return controller.transition(apply, undefined, options?.signal, id);
    },
    open(tab: T, { mode = "preview" }: { mode?: "preview" | "new-tab" } = {}) {
      if (host.get().tabs.some((entry) => entry.id === tab.id)) return controller.select(tab.id);
      return controller.transition(
        () => {
          const state = host.get();
          const reusable = (entry: T) => !entry.kept && !entry.independent && !hasDraft(entry);
          const previous =
            mode === "preview" && !tab.kept && !hasDraft(tab)
              ? (state.tabs.find((entry) => entry.id === state.active && reusable(entry)) ??
                state.tabs.find(reusable))
              : undefined;
          host.captureScroll?.(state.active);
          host.beforeSelect?.(tab.id, true);
          patch({
            tabs: previous
              ? state.tabs.map((entry) => (entry.id === previous.id ? tab : entry))
              : [...state.tabs, tab],
            active: tab.id,
          } as Partial<S>);
          host.afterSelect?.(tab.id, true, true);
          previous?.close();
        },
        undefined,
        undefined,
        tab.id,
      );
    },
    remove(id: string) {
      if (pendingTarget === id) {
        ++revision;
        pendingTarget = undefined;
      }
      host.beforeRemove?.(id);
      const state = host.get();
      if (state.active === id) host.captureScroll?.(id);
      host.forgetScroll?.(id);
      const removed = state.tabs.find((tab) => tab.id === id);
      const index = state.tabs.findIndex((tab) => tab.id === id);
      const tabs = state.tabs
        .filter((tab) => tab.id !== id)
        .map((tab) =>
          tab.detailOf === id ? { ...tab, detailOf: undefined, detailMaximized: undefined } : tab,
        );
      patch({
        tabs,
        active:
          state.active === id
            ? (tabs.find((tab) => tab.id === removed?.detailOf)?.id ??
              (tabs[index] ?? tabs[index - 1])?.id ??
              host.emptyActive ??
              "")
            : state.active,
      } as Partial<S>);
    },
    keep(id: string) {
      update(id, {
        kept: true,
        pinOverride: true,
        detailOf: undefined,
        detailMaximized: undefined,
      } as Partial<T>);
    },
    unkeep(id: string) {
      update(id, { kept: false, pinOverride: false } as Partial<T>);
    },
    move(id: string, index: number) {
      if (!Number.isFinite(index)) return;
      const tabs = [...host.get().tabs];
      const previous = tabs.findIndex((tab) => tab.id === id);
      if (previous < 0) return;
      const [tab] = tabs.splice(previous, 1);
      tabs.splice(Math.max(0, Math.min(tabs.length, Math.trunc(index))), 0, tab!);
      patch({ tabs } as Partial<S>);
    },
    resize(id: string, width?: number) {
      if (width !== undefined && !Number.isFinite(width)) return;
      update(id, {
        panelWidth:
          width === undefined ? undefined : Math.max(280, Math.min(2400, Math.round(width))),
      } as Partial<T>);
    },
    setLayout(layout: WindowLayout, { remember = false } = {}) {
      if (remember && host.storageKey) {
        try {
          localStorage.setItem(host.storageKey, layout);
        } catch {
          /* Storage is optional. */
        }
      }
      if (host.get().layout !== layout) patch({ layout } as Partial<S>);
    },
  };
  return controller;
}

export type WindowController<T extends WorkbenchWindow = WorkbenchWindow> = ReturnType<
  typeof createWindowController<T, WindowSnapshot<T>>
>;

/** Each app/area owns an instance; there is no process-global window registry. */
export function createWindowStore<T extends WorkbenchWindow>(
  options: {
    tabs?: T[];
    active?: string;
    storageKey?: string;
    beforeLeave?: WindowHost<T, WindowSnapshot<T>>["beforeLeave"];
  } = {},
) {
  let state: WindowSnapshot<T> = {
    tabs: options.tabs ?? [],
    active: options.active ?? options.tabs?.[0]?.id ?? "",
    layout: preferredWindowLayout(options.storageKey),
  };
  const listeners = new Set<() => void>();
  return createWindowController<T, WindowSnapshot<T>>({
    get: () => state,
    set: (next) => {
      state = next;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    storageKey: options.storageKey,
    beforeLeave: options.beforeLeave,
  });
}
