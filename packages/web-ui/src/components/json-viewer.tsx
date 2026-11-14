/**
 * JsonViewer — Collapsible JSON tree renderer.
 *
 * Fetches JSON from a URL and renders it as an interactive tree
 * with syntax coloring and expand/collapse controls.
 */

import { useEffect, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@lykomi/web-primitives";

export function JsonViewer({
  url,
  defaultExpanded = 2,
}: {
  url: string;
  defaultExpanded?: number;
}) {
  const [state, setState] = useState<{
    data: unknown;
    loading: boolean;
    error: boolean;
  }>({ data: null, loading: true, error: false });

  useEffect(() => {
    let cancelled = false;
    fetch(url)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch");
        return r.json();
      })
      .then((json) => {
        if (!cancelled) setState({ data: json, loading: false, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ data: null, loading: false, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [url]);

  const { data, loading, error } = state;

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-12">
        Loading...
      </div>
    );
  }

  if (error || data == null) {
    return (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground p-12">
        Failed to load JSON
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto p-6">
      <div className="font-mono text-sm max-w-5xl">
        <JsonNode value={data} depth={0} defaultExpanded={defaultExpanded} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JsonNode — recursive tree node
// ---------------------------------------------------------------------------

function JsonNode({
  label,
  value,
  depth,
  defaultExpanded,
}: {
  label?: string;
  value: unknown;
  depth: number;
  defaultExpanded: number;
}) {
  const [expanded, setExpanded] = useState(depth < defaultExpanded);

  if (value === null || value === undefined) {
    return (
      <span>
        {label != null && <KeyLabel text={label} />}
        <span className="text-muted-foreground italic">null</span>
      </span>
    );
  }

  if (typeof value === "boolean") {
    return (
      <span>
        {label != null && <KeyLabel text={label} />}
        <span className="text-[var(--syntax-boolean)]">{String(value)}</span>
      </span>
    );
  }

  if (typeof value === "number") {
    return (
      <span>
        {label != null && <KeyLabel text={label} />}
        <span className="text-[var(--syntax-number)]">{value}</span>
      </span>
    );
  }

  if (typeof value === "string") {
    const display = value.length > 200 ? value.slice(0, 200) + "..." : value;
    return (
      <span>
        {label != null && <KeyLabel text={label} />}
        <span className="text-[var(--syntax-string)]">"{display}"</span>
      </span>
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return (
        <span>
          {label != null && <KeyLabel text={label} />}
          <span className="text-muted-foreground">[]</span>
        </span>
      );
    }

    return (
      <div>
        <ToggleButton expanded={expanded} onToggle={() => setExpanded(!expanded)}>
          {label != null && <KeyLabel text={label} />}
          <span className="text-muted-foreground ml-1">[{value.length} items]</span>
        </ToggleButton>
        {expanded && (
          <div className={cn("border-l border-border ml-2 pl-3", depth > 4 && "ml-1 pl-2")}>
            {value.map((item, i) => (
              <div key={i} className="py-0.5">
                <JsonNode
                  label={String(i)}
                  value={item}
                  depth={depth + 1}
                  defaultExpanded={defaultExpanded}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) {
      return (
        <span>
          {label != null && <KeyLabel text={label} />}
          <span className="text-muted-foreground">{"{}"}</span>
        </span>
      );
    }

    return (
      <div>
        <ToggleButton expanded={expanded} onToggle={() => setExpanded(!expanded)}>
          {label != null && <KeyLabel text={label} />}
          <span className="text-muted-foreground ml-1">
            {"{"}
            {entries.length} keys
            {"}"}
          </span>
        </ToggleButton>
        {expanded && (
          <div className={cn("border-l border-border ml-2 pl-3", depth > 4 && "ml-1 pl-2")}>
            {entries.map(([key, val]) => (
              <div key={key} className="py-0.5">
                <JsonNode
                  label={key}
                  value={val}
                  depth={depth + 1}
                  defaultExpanded={defaultExpanded}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <span>
      {label != null && <KeyLabel text={label} />}
      <span>{String(value)}</span>
    </span>
  );
}

function KeyLabel({ text }: { text: string }) {
  return <span className="text-[var(--syntax-key)]">{text}: </span>;
}

function ToggleButton({
  expanded,
  onToggle,
  children,
}: {
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex items-center gap-0.5 hover:bg-muted/50 rounded px-0.5 -ml-0.5"
    >
      {expanded ? (
        <ChevronDown className="size-3.5 text-muted-foreground" />
      ) : (
        <ChevronRight className="size-3.5 text-muted-foreground" />
      )}
      {children}
    </button>
  );
}
