import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button, cn } from "@lykomi/web-primitives";
import { useThemeRuntime } from "./theme-runtime-provider.tsx";
import { mermaidDocument, mermaidTheme, renderMermaid } from "../lib/mermaid-render.ts";

export const MermaidStreamingContext = createContext(false);

/** A diagram and its editable source share one representation across chat and documents. */
export function MermaidDiagram({
  source,
  title = "Mermaid diagram",
  isStreaming,
  className,
  onEditSource,
}: {
  source: string;
  title?: string;
  isStreaming?: boolean;
  className?: string;
  /** Opens the host editor from Source; omit for a read-only source view. */
  onEditSource?: () => void;
}) {
  const streamingContext = useContext(MermaidStreamingContext);
  const streaming = isStreaming ?? streamingContext;
  const theme = useThemeRuntime();
  const themeKey = JSON.stringify([theme.mode, theme.variables]);
  const host = useRef<HTMLDivElement>(null);
  const [result, setResult] = useState<{ source: string; themeKey: string; svg: string } | null>(
    null,
  );
  const [error, setError] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [width, setWidth] = useState(600);
  const svg = result?.source === source && result.themeKey === themeKey ? result.svg : null;

  useEffect(() => {
    const element = host.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setWidth(element.clientWidth || 600));
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    setError(false);
    if (streaming || !source.trim()) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!host.current) return;
      void renderMermaid(source, mermaidTheme(host.current, theme.mode === "dark"))
        .then((next) => {
          if (!cancelled) setResult({ source, themeKey, svg: next });
        })
        .catch(() => {
          if (!cancelled) setError(true);
        });
    }, 200);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [source, streaming, themeKey, theme.mode]);

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(timer);
  }, [copied]);

  const viewBox = svg
    ?.match(/viewBox="([^"]+)"/)?.[1]
    .split(/\s+/)
    .map(Number);
  const validSize =
    viewBox &&
    Number.isFinite(viewBox[2]) &&
    Number.isFinite(viewBox[3]) &&
    viewBox[2] > 0 &&
    viewBox[3] > 0;
  const ratio = validSize ? viewBox[3] / viewBox[2] : 0.6;
  const fittedWidth = validSize ? Math.min(width, viewBox[2]) : width;
  const height = Math.min(1200, Math.max(120, fittedWidth * ratio));
  const sourceVisible = showSource || error || streaming;

  return (
    <div ref={host} className={cn("my-4 min-w-0 max-w-full", className)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div role="group" aria-label="Diagram view" className="flex gap-1">
          <Button
            type="button"
            variant={showSource ? "ghost" : "secondary"}
            size="sm"
            aria-pressed={!showSource}
            onClick={() => setShowSource(false)}
          >
            Diagram
          </Button>
          <Button
            type="button"
            variant={showSource ? "secondary" : "ghost"}
            size="sm"
            aria-pressed={showSource}
            onClick={() => (onEditSource ? onEditSource() : setShowSource(true))}
          >
            Source
          </Button>
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Copy Mermaid source"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(source)
                .then(() => setCopied(true))
                .catch(() => setCopied(false));
            }}
          >
            {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
          </Button>
        </div>
      </div>
      {error && (
        <p role="status" className="mb-2 text-sm text-muted-foreground">
          Could not render this diagram. Check the Mermaid source.
        </p>
      )}
      {!source.trim() ? (
        <p className="text-sm text-muted-foreground">Add Mermaid source to draw a diagram.</p>
      ) : sourceVisible ? (
        <>
          {streaming && (
            <p role="status" className="mb-2 text-sm text-muted-foreground">
              Writing diagram…
            </p>
          )}
          <pre className="overflow-x-auto rounded-lg bg-code-block p-4 text-sm text-code-block-foreground">
            <code>{source}</code>
          </pre>
        </>
      ) : svg ? (
        <iframe
          title={title}
          sandbox=""
          referrerPolicy="no-referrer"
          srcDoc={mermaidDocument(svg)}
          className="w-full border-0"
          style={{ height }}
        />
      ) : (
        <p role="status" className="text-sm text-muted-foreground">
          Drawing diagram…
        </p>
      )}
    </div>
  );
}
