import { makeAssistantToolUI } from "@assistant-ui/react";
import { cn } from "@iloveagents/foundry-web-primitives";
import { ToolCallCard, type ToolCallStatus } from "@iloveagents/foundry-web-ui";
import { Brain, Clock3, Database, ExternalLink, FileText, Search, Wrench } from "lucide-react";

interface SearchToolArgs {
  query?: string;
  queries?: string[];
}

interface SearchResult {
  ref_id?: string;
  id?: string;
  chunk_id?: string;
  docKey?: string;
  title?: string;
  terms?: string;
  source?: string;
  source_name?: string;
  entity_name?: string;
  url?: string;
  content?: string;
  text?: string;
  snippet?: string;
  page_number?: number | null;
  page?: number | null;
  pages?: number[] | null;
  score?: number;
  reranker_score?: number;
  rerankerScore?: number;
  search_score?: number;
  searchScore?: number;
  sourceData?: unknown;
  [key: string]: unknown;
}

interface ToolPayload {
  query?: string;
  results?: SearchResult[];
  value?: SearchResult[];
  activity?: ActivityItem[];
  references?: SearchReference[];
  content?: unknown;
  retrieve?: unknown;
  raw?: unknown;
  activityError?: string;
  error?: string;
  message?: string;
}

interface SearchReference {
  id?: string;
  type?: string;
  activitySource?: number;
  docKey?: string;
  sourceData?: unknown;
  [key: string]: unknown;
}

interface ActivityItem {
  id?: number | string;
  type?: string;
  inputTokens?: number;
  outputTokens?: number;
  reasoningTokens?: number;
  elapsedMs?: number;
  count?: number;
  knowledgeSourceName?: string;
  queryTime?: string;
  modelName?: string;
  searchIndexArguments?: {
    search?: string;
    semanticConfigurationName?: string;
    [key: string]: unknown;
  };
  mcpToolArguments?: {
    search?: string;
    toolName?: string;
    toolArguments?: string;
    mcpInitializeElapsedMs?: number;
    mcpListToolElapsedMs?: number;
    llmToolInputElapsedMs?: number;
    mcpToolInvokationElapsedMs?: number;
  };
  [key: string]: unknown;
}

function parsePayload(result: unknown): unknown {
  if (typeof result !== "string") return result;
  try {
    return JSON.parse(result);
  } catch {
    return result;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function parseRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value === "string") {
    const parsed = parsePayload(value);
    return asRecord(parsed);
  }
  return asRecord(value);
}

function pickString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickNumber(...values: unknown[]): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function sourceData(result: SearchResult): Record<string, unknown> | null {
  return parseRecord(result.sourceData);
}

function unwrapToolPayload(result: unknown): ToolPayload | null {
  const parsed = parsePayload(result);
  const payload =
    parsed && typeof parsed === "object" && "data" in parsed
      ? (parsed as { data?: unknown }).data
      : parsed;

  return asRecord(payload) as ToolPayload | null;
}

function referenceResult(reference: SearchReference): SearchResult | null {
  const data = parseRecord(reference.sourceData);
  if (!data && !reference.docKey) return null;
  return {
    ...(data ?? {}),
    id: reference.id,
    docKey: reference.docKey,
    source: reference.docKey,
    sourceData: reference.sourceData,
  } as SearchResult;
}

function resultsFromReferences(references: SearchReference[] | undefined): SearchResult[] {
  if (!Array.isArray(references)) return [];
  return references.map(referenceResult).filter((result): result is SearchResult => Boolean(result));
}

function unwrapResults(result: unknown): SearchResult[] {
  const payload = unwrapToolPayload(result);

  if (payload) {
    if (Array.isArray(payload.results) && payload.results.length > 0) return payload.results;
    if (Array.isArray(payload.value) && payload.value.length > 0) return payload.value;
    if (Array.isArray(payload.content)) return payload.content as SearchResult[];
    const referenceResults = resultsFromReferences(payload.references);
    if (referenceResults.length > 0) return referenceResults;

    if (payload.content) {
      const content = payload.content;
      if (Array.isArray(content)) return content as SearchResult[];
      if (asRecord(content)) {
        const contentRecord = content as Record<string, unknown>;
        if (Array.isArray(contentRecord.results)) return contentRecord.results as SearchResult[];
        if (Array.isArray(contentRecord.value)) return contentRecord.value as SearchResult[];
      }
    }
  }

  const parsed = parsePayload(result);
  const directPayload =
    parsed && typeof parsed === "object" && "data" in parsed
      ? (parsed as { data?: unknown }).data
      : parsed;

  if (Array.isArray(directPayload)) return directPayload as SearchResult[];

  if (directPayload && typeof directPayload === "object") {
    const record = directPayload as Record<string, unknown>;
    if (Array.isArray(record.results)) return record.results as SearchResult[];
    if (Array.isArray(record.value)) return record.value as SearchResult[];

    const content = record.content;
    if (Array.isArray(content)) {
      const text = content
        .map((item) =>
          item && typeof item === "object" && typeof (item as { text?: unknown }).text === "string"
            ? (item as { text: string }).text
            : "",
        )
        .find(Boolean);
      const nested = parsePayload(text);
      if (Array.isArray(nested)) return nested as SearchResult[];
    }
  }

  return [];
}

function unwrapActivity(result: unknown): ActivityItem[] {
  const payload = unwrapToolPayload(result);
  if (payload && Array.isArray(payload.activity)) return payload.activity;

  const content = payload?.content;
  if (asRecord(content) && Array.isArray((content as Record<string, unknown>).activity)) {
    return (content as { activity: ActivityItem[] }).activity;
  }

  const raw = payload?.raw;
  if (asRecord(raw) && Array.isArray((raw as Record<string, unknown>).activity)) {
    return (raw as { activity: ActivityItem[] }).activity;
  }

  return [];
}

function unwrapReferences(result: unknown): SearchReference[] {
  const payload = unwrapToolPayload(result);
  if (payload && Array.isArray(payload.references)) return payload.references;

  const content = payload?.content;
  if (asRecord(content) && Array.isArray((content as Record<string, unknown>).references)) {
    return (content as { references: SearchReference[] }).references;
  }

  const raw = payload?.raw;
  if (asRecord(raw) && Array.isArray((raw as Record<string, unknown>).references)) {
    return (raw as { references: SearchReference[] }).references;
  }

  return [];
}

function unwrapActivityError(result: unknown): string | null {
  const payload = unwrapToolPayload(result);
  return typeof payload?.activityError === "string" && payload.activityError.trim()
    ? payload.activityError
    : null;
}

function unwrapError(result: unknown): string | null {
  const payload = unwrapToolPayload(result);
  const error = payload?.error ?? payload?.message;
  return typeof error === "string" ? error : null;
}

function queryFromArgs(args: SearchToolArgs | undefined): string {
  if (typeof args?.query === "string") return args.query;
  if (Array.isArray(args?.queries) && typeof args.queries[0] === "string") return args.queries[0];
  return "";
}

function rawContent(result: SearchResult): string {
  const source = sourceData(result);
  return (
    pickString(
      result.snippet,
      result.content,
      result.text,
      source?.content,
      source?.text,
      source?.snippet,
    ) ?? ""
  );
}

function cleanSnippet(value: string | undefined): string {
  if (!value) return "";
  let text = value.trim();
  text = text.replace(/<!--[\s\S]*?-->/g, " ");
  text = text.replace(/!\[[^\]]*]\([^)]*\)/g, " ");
  text = text.replace(/\[([^\]]+)]\([^)]*\)/g, "$1");
  text = text.replace(/^```[a-zA-Z0-9-]*\s*\n?/, "");
  text = text.replace(/\n?```\s*$/, "");
  text = text.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  text = text.replace(/^\s*[-*_]{3,}\s*$/gm, " ");
  text = text.replace(/\s+/g, " ");
  return text.trim();
}

function derivedTitleFromContent(value: string): string | null {
  const heading = value.match(/(?:^|\n)\s{0,3}#{1,6}\s+(.+?)(?:\n|$)/);
  if (heading?.[1]?.trim()) return cleanSnippet(heading[1]).slice(0, 80);

  const pageHeader = value.match(/<!--\s*PageHeader:\s*(.*?)\s*-->/i);
  if (pageHeader?.[1]?.trim()) return cleanSnippet(pageHeader[1]).slice(0, 80);

  return null;
}

function resultTitle(result: SearchResult, index: number): string {
  const source = sourceData(result);
  const content = rawContent(result);
  return (
    pickString(
      result.title,
      source?.title,
      result.entity_name,
      source?.entity_name,
      result.source_name,
      source?.source_name,
      source?.metadata_storage_name,
      source?.name,
      result.source,
      result.docKey,
    ) ||
    derivedTitleFromContent(content) ||
    pickString(result.ref_id, result.id, result.chunk_id) ||
    `Result ${index + 1}`
  );
}

function resultPage(result: SearchResult): string | null {
  if (Array.isArray(result.pages) && result.pages.length > 1) {
    const min = Math.min(...result.pages);
    const max = Math.max(...result.pages);
    return min === max ? `p. ${min}` : `p. ${min}-${max}`;
  }
  const page = result.page_number ?? result.page;
  return typeof page === "number" && page > 0 ? `p. ${page}` : null;
}

function resultScore(result: SearchResult): number | null {
  const source = sourceData(result);
  return pickNumber(
    result.rerankerScore,
    result.reranker_score,
    result["@search.rerankerScore"],
    source?.rerankerScore,
    source?.["@search.rerankerScore"],
    result.score,
    result.searchScore,
    result.search_score,
    result["@search.score"],
    source?.score,
    source?.searchScore,
    source?.["@search.score"],
  );
}

function normalizeScore(score: number, maxScore: number): number {
  const denominator = maxScore <= 1 ? maxScore : maxScore <= 4 ? 4 : maxScore;
  const percent = denominator > 0 ? Math.round((score / denominator) * 100) : 0;
  return Math.max(0, Math.min(100, percent));
}

function formatScore(score: number): string {
  return Number.isInteger(score) ? String(score) : score.toFixed(score < 1 ? 3 : 2);
}

function scoreClass(percent: number): string {
  if (percent >= 75) return "bg-primary";
  if (percent >= 50) return "bg-primary/70";
  if (percent >= 25) return "bg-primary/45";
  return "bg-primary/25";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(value);
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)} s`;
  return `${(ms / 60000).toFixed(1)} min`;
}

function activityLabel(type: string | undefined): string {
  switch (type) {
    case "modelQueryPlanning":
      return "Query planning";
    case "searchIndex":
      return "Search index";
    case "azureBlob":
      return "Azure Blob";
    case "mcpTool":
      return "MCP tool";
    case "agenticReasoning":
      return "Reasoning";
    case "modelAnswerSynthesis":
      return "Answer synthesis";
    default:
      return type || "Activity";
  }
}

function activityAccent(type: string | undefined): string {
  switch (type) {
    case "modelQueryPlanning":
      return "border-l-violet-500 bg-violet-500/5";
    case "searchIndex":
    case "azureBlob":
      return "border-l-emerald-500 bg-emerald-500/5";
    case "mcpTool":
      return "border-l-cyan-500 bg-cyan-500/5";
    case "agenticReasoning":
      return "border-l-amber-500 bg-amber-500/5";
    case "modelAnswerSynthesis":
      return "border-l-primary bg-primary/5";
    default:
      return "border-l-border bg-muted/40";
  }
}

function activityIcon(type: string | undefined) {
  switch (type) {
    case "modelQueryPlanning":
    case "agenticReasoning":
    case "modelAnswerSynthesis":
      return <Brain className="size-3.5" />;
    case "searchIndex":
    case "azureBlob":
      return <Database className="size-3.5" />;
    case "mcpTool":
      return <Wrench className="size-3.5" />;
    default:
      return <Clock3 className="size-3.5" />;
  }
}

function activityQuery(item: ActivityItem): string | null {
  const indexSearch = item.searchIndexArguments?.search;
  if (typeof indexSearch === "string" && indexSearch.trim()) return indexSearch;

  const sourceArgs = activitySourceArguments(item);
  const sourceSearch = sourceArgs?.search;
  if (typeof sourceSearch === "string" && sourceSearch.trim()) return sourceSearch;

  const search = item.mcpToolArguments?.search;
  if (typeof search === "string" && search.trim()) return search;

  const toolArguments = item.mcpToolArguments?.toolArguments;
  if (typeof toolArguments !== "string") return null;
  try {
    const parsed = JSON.parse(toolArguments) as Record<string, unknown>;
    if (typeof parsed.query === "string") return parsed.query;
    if (Array.isArray(parsed.queries) && typeof parsed.queries[0] === "string") {
      return parsed.queries[0];
    }
  } catch {
    return toolArguments;
  }
  return null;
}

function activityTool(item: ActivityItem): string | null {
  return item.knowledgeSourceName ?? item.mcpToolArguments?.toolName ?? item.modelName ?? null;
}

function activityDuration(item: ActivityItem): number {
  const args = item.mcpToolArguments;
  return (
    (item.elapsedMs ?? 0) +
    (args?.mcpInitializeElapsedMs ?? 0) +
    (args?.mcpListToolElapsedMs ?? 0) +
    (args?.llmToolInputElapsedMs ?? 0) +
    (args?.mcpToolInvokationElapsedMs ?? 0)
  );
}

function activitySourceArguments(item: ActivityItem): Record<string, unknown> | null {
  if (!item.type) return null;
  return asRecord(item[`${item.type}Arguments`]);
}

function isSourceActivity(item: ActivityItem): boolean {
  if (!item.type) return false;
  if (item.type === "mcpTool" || item.type === "searchIndex") return true;
  if (item.type.startsWith("model") || item.type === "agenticReasoning" || item.type === "imageServing") {
    return false;
  }
  return Boolean(item.knowledgeSourceName || activitySourceArguments(item));
}

function activityId(item: ActivityItem): number | string | null {
  return item.id ?? null;
}

function sameActivitySource(reference: SearchReference, item: ActivityItem): boolean {
  const id = activityId(item);
  if (id === null || reference.activitySource === undefined) return false;
  return String(reference.activitySource) === String(id);
}

function sourceActivityCount(activity: ActivityItem[]): number {
  return activity.filter(isSourceActivity).length;
}

function resultsForActivity(
  item: ActivityItem,
  activity: ActivityItem[],
  results: SearchResult[],
  references: SearchReference[],
): SearchResult[] {
  const matchedReferences = references.filter((reference) => sameActivitySource(reference, item));
  if (matchedReferences.length > 0) return resultsFromReferences(matchedReferences);

  if (!isSourceActivity(item) || results.length === 0) return [];

  if (item.type === "mcpTool" || sourceActivityCount(activity) === 1) {
    const limit = typeof item.count === "number" && item.count > 0 ? item.count : results.length;
    return results.slice(0, limit);
  }

  return [];
}

function activitySummary(activity: ActivityItem[]) {
  let inputTokens = 0;
  let outputTokens = 0;
  let elapsedMs = 0;
  let toolCalls = 0;
  let iterations = 0;

  for (const item of activity) {
    inputTokens += item.inputTokens ?? 0;
    outputTokens += (item.outputTokens ?? 0) + (item.reasoningTokens ?? 0);
    elapsedMs += activityDuration(item);
    if (isSourceActivity(item)) toolCalls += 1;
    if (item.type === "modelQueryPlanning") iterations += 1;
  }

  return {
    iterations: iterations || (activity.length > 0 ? 1 : 0),
    toolCalls,
    inputTokens,
    outputTokens,
    elapsedMs,
  };
}

function SearchResultsBody({ results }: { results: SearchResult[] }) {
  if (results.length === 0) {
    return <div className="text-xs text-muted-foreground">No results returned.</div>;
  }

  const scores = results.map(resultScore).filter((score): score is number => score !== null);
  const maxScore = Math.max(...scores, 0.001);

  return (
    <div className="flex flex-col divide-y divide-border/50">
      {results.map((result, index) => {
        const title = resultTitle(result, index);
        const score = resultScore(result);
        const snippet = cleanSnippet(rawContent(result));
        const preview = snippet.length > 180 ? `${snippet.slice(0, 180).trimEnd()}...` : snippet;
        const page = resultPage(result);
        const relevance = score === null ? null : normalizeScore(score, maxScore);
        const scoreLabel = score === null ? null : formatScore(score);
        const key = result.chunk_id ?? result.id ?? result.ref_id ?? `${title}-${index}`;
        const rowContent = (
          <>
            <span className="mt-0.5 w-5 shrink-0 text-right text-[11px] font-semibold text-primary">
              [{index + 1}]
            </span>
            <FileText className="mt-0.5 size-3.5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="truncate font-medium text-foreground">{title}</span>
                {page && <span className="shrink-0 text-muted-foreground">{page}</span>}
                <div className="ml-auto flex shrink-0 items-center gap-1.5">
                  {relevance === null ? (
                    <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary">
                      Rank #{index + 1}
                    </span>
                  ) : (
                    <>
                      <span className="text-[11px] text-muted-foreground">
                        Score {scoreLabel}
                      </span>
                      <div
                        className="flex h-2 w-16 justify-end overflow-hidden rounded-full border border-primary/30 bg-muted"
                        title={`Score: ${scoreLabel}`}
                      >
                        <div
                          className={cn("h-full rounded-full transition-all", scoreClass(relevance))}
                          style={{ width: `${Math.max(relevance, 8)}%` }}
                        />
                      </div>
                    </>
                  )}
                  {result.url && (
                    <ExternalLink className="size-3 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </div>
              </div>
              {preview && <p className="mt-0.5 line-clamp-2 text-muted-foreground">{preview}</p>}
            </div>
          </>
        );

        if (result.url) {
          return (
            <a
              key={key}
              href={result.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group -mx-1 flex w-full items-start gap-2 rounded px-1 py-2 text-left text-xs transition-colors hover:bg-muted/80"
            >
              {rowContent}
            </a>
          );
        }

        return (
          <div key={key} className="-mx-1 flex w-full items-start gap-2 rounded px-1 py-2 text-xs">
            {rowContent}
          </div>
        );
      })}
    </div>
  );
}

function ActivityViewer({
  activity,
  results,
  references,
}: {
  activity: ActivityItem[];
  results: SearchResult[];
  references: SearchReference[];
}) {
  if (activity.length === 0) return null;

  const summary = activitySummary(activity);
  const sorted = [...activity].sort((a, b) => Number(a.id ?? 0) - Number(b.id ?? 0));

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
        <Clock3 className="size-3.5 text-primary" />
        Activity
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
        <ActivityMetric label="Iterations" value={String(summary.iterations)} />
        <ActivityMetric label="Tool calls" value={String(summary.toolCalls)} />
        <ActivityMetric label="Input" value={formatNumber(summary.inputTokens)} />
        <ActivityMetric label="Output" value={formatNumber(summary.outputTokens)} />
        <ActivityMetric label="Time" value={formatDuration(summary.elapsedMs)} />
      </div>
      <div className="space-y-2">
        {sorted.map((item, index) => {
          const activityResults = resultsForActivity(item, sorted, results, references);
          return (
            <ActivityRow
              key={`${item.id ?? index}-${item.type ?? "activity"}`}
              item={item}
              results={activityResults}
            />
          );
        })}
      </div>
    </div>
  );
}

function ActivityMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/70 px-2 py-1.5">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="truncate text-xs font-semibold text-foreground">{value}</div>
    </div>
  );
}

function ActivityRow({ item, results }: { item: ActivityItem; results: SearchResult[] }) {
  const query = activityQuery(item);
  const tool = activityTool(item);
  const duration = activityDuration(item);
  const details = compactActivityDetails(item);

  return (
    <div
      className={cn("rounded-md border border-border/70 border-l-4 p-2", activityAccent(item.type))}
    >
      <div className="flex items-center gap-2 text-xs">
        <span className="text-primary">{activityIcon(item.type)}</span>
        <span className="font-medium text-foreground">{activityLabel(item.type)}</span>
        {tool && (
          <span className="rounded bg-background/80 px-1.5 py-0.5 text-[11px] text-muted-foreground">
            {tool}
          </span>
        )}
        {typeof item.count === "number" && (
          <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] text-primary">
            {item.count} results
          </span>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">
          {item.id !== undefined ? `Step ${item.id}` : null}
          {duration > 0 ? ` · ${formatDuration(duration)}` : null}
        </span>
      </div>
      {query && <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{query}</div>}
      {results.length > 0 && <ActivityResultsList results={results} />}
      {details && (
        <pre className="mt-2 max-h-32 overflow-auto rounded border border-border/60 bg-background/80 p-2 text-[11px] text-muted-foreground">
          {details}
        </pre>
      )}
    </div>
  );
}

function ActivityResultsList({ results }: { results: SearchResult[] }) {
  const visibleResults = results.slice(0, 5);
  const hiddenCount = results.length - visibleResults.length;

  return (
    <div className="mt-2 rounded border border-border/60 bg-background/75 p-2">
      <div className="mb-1 text-[11px] font-medium text-foreground">Returned results</div>
      <div className="space-y-1.5">
        {visibleResults.map((result, index) => {
          const title = resultTitle(result, index);
          const snippet = cleanSnippet(rawContent(result));
          const preview = snippet.length > 140 ? `${snippet.slice(0, 140).trimEnd()}...` : snippet;
          return (
            <div key={result.chunk_id ?? result.id ?? result.ref_id ?? `${title}-${index}`} className="text-xs">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="w-5 shrink-0 text-right text-[11px] font-semibold text-primary">
                  [{index + 1}]
                </span>
                <FileText className="size-3 shrink-0 text-primary" />
                <span className="truncate font-medium text-foreground">{title}</span>
                {resultPage(result) && (
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {resultPage(result)}
                  </span>
                )}
              </div>
              {preview && (
                <div className="ml-8 line-clamp-2 text-[11px] text-muted-foreground">
                  {preview}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 && (
        <div className="mt-1 text-[11px] text-muted-foreground">
          +{hiddenCount} more result{hiddenCount === 1 ? "" : "s"}
        </div>
      )}
    </div>
  );
}

function compactActivityDetails(item: ActivityItem): string | null {
  const excluded = new Set([
    "id",
    "type",
    "inputTokens",
    "outputTokens",
    "reasoningTokens",
    "elapsedMs",
    "count",
    "knowledgeSourceName",
    "queryTime",
    "mcpToolArguments",
  ]);
  const details: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(item)) {
    if (!excluded.has(key) && value !== null && value !== undefined) details[key] = value;
  }

  if (item.mcpToolArguments?.toolArguments) {
    try {
      details.toolArguments = JSON.parse(item.mcpToolArguments.toolArguments);
    } catch {
      details.toolArguments = item.mcpToolArguments.toolArguments;
    }
  }

  return Object.keys(details).length > 0 ? JSON.stringify(details, null, 2) : null;
}

function renderSearchCard(
  title: string,
  args: SearchToolArgs | undefined,
  result: unknown,
  status: ToolCallStatus,
) {
  const results = status.type === "running" ? [] : unwrapResults(result);
  const activity = status.type === "running" ? [] : unwrapActivity(result);
  const references = status.type === "running" ? [] : unwrapReferences(result);
  const errorMessage = status.type === "running" ? null : unwrapError(result);
  const activityError = status.type === "running" ? null : unwrapActivityError(result);
  const effectiveStatus =
    status.type !== "running" && errorMessage
      ? ({ type: "incomplete", reason: "error" } satisfies ToolCallStatus)
      : status;
  const query = queryFromArgs(args);
  const displayQuery = query.length > 60 ? `${query.slice(0, 60).trimEnd()}...` : query;
  const quoted = displayQuery ? `"${displayQuery}"` : "";
  const description =
    effectiveStatus.type === "running"
      ? `Searching ${quoted || "..."}`
      : errorMessage
        ? quoted
          ? `${errorMessage} (${quoted})`
          : errorMessage
        : results.length > 0
          ? quoted
            ? `${results.length} results for ${quoted} - expand for details`
            : `${results.length} results - expand for details`
          : quoted
            ? `No results for ${quoted}`
            : "No results";

  return (
    <ToolCallCard
      icon={<Search className="size-3.5" />}
      title={title}
      description={description}
      status={effectiveStatus}
      className="w-full"
    >
      {errorMessage && <div className="mb-2 text-xs text-destructive">{errorMessage}</div>}
      <SearchResultsBody results={results} />
      <ActivityViewer activity={activity} results={results} references={references} />
      {activity.length === 0 && activityError && (
        <div className="mt-3 rounded-md border border-border/70 bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
          Activity unavailable from the retrieve API: {activityError}
        </div>
      )}
    </ToolCallCard>
  );
}

export const FoundryIQSearchToolUI = makeAssistantToolUI<SearchToolArgs, unknown>({
  toolName: "foundry_iq_search",
  render: ({ args, result, status }) => renderSearchCard("Foundry IQ Search", args, result, status),
});
