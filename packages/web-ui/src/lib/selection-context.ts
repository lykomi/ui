import type { ContextItem } from "./app-store.ts";

export type SelectionContextItem = Omit<ContextItem, "id" | "createdAt">;

export interface SelectionContextInput {
  text: string;
  anchorNode: Node;
  focusNode: Node | null;
  range: Range;
  sourcePage: string;
}

export interface SelectionContextResult {
  item: SelectionContextItem;
  supportsModify?: boolean;
  formatModifyPrompt?: (prompt: string) => string;
}

export interface SelectionContextResolver {
  id: string;
  priority?: number;
  resolve: (input: SelectionContextInput) => SelectionContextResult | null;
}

const resolvers = new Map<string, SelectionContextResolver>();

function defaultSelectionContext(input: SelectionContextInput): SelectionContextResult {
  return {
    item: {
      type: "selection",
      label: input.text,
      payload: { kind: "text", text: input.text },
      sourcePage: input.sourcePage,
      persistence: "ephemeral",
    },
  };
}

export function registerSelectionContextResolver(
  resolver: SelectionContextResolver,
): () => void {
  resolvers.set(resolver.id, resolver);
  return () => {
    if (resolvers.get(resolver.id) === resolver) {
      resolvers.delete(resolver.id);
    }
  };
}

export function resolveSelectionContext(input: SelectionContextInput): SelectionContextResult {
  const sortedResolvers = [...resolvers.values()].sort(
    (a, b) => (b.priority ?? 0) - (a.priority ?? 0),
  );

  for (const resolver of sortedResolvers) {
    try {
      const resolved = resolver.resolve(input);
      if (resolved) return resolved;
    } catch {
      // A module resolver must never break the generic selection flow.
    }
  }

  return defaultSelectionContext(input);
}
