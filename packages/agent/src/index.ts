// --- AG-UI runner ---
export { AGUIRunner, type AGUIRunnerOptions, type AGUIRunInput } from "./client/agui-runner.ts";
export type { RunnerEvent } from "./client/runner-events.ts";

// --- Service fetch factory ---
export {
  createServiceFetch,
  type ServiceFetch,
  type ServiceFetchOptions,
} from "./client/service-fetch.ts";

// --- Tool registry ---
export {
  clientToolRegistry,
  type ClientToolEntry,
  type ToolRegistry,
} from "./tools/registry.ts";

// --- Stores (vanilla) ---
export {
  streamingStatusStore,
  type StreamingStatus,
} from "./store/streaming-status-store.ts";
export {
  citationStore,
  type CitationResult,
  type CitationHandler,
} from "./store/citation-store.ts";
