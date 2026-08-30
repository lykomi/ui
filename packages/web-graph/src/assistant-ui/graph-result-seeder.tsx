/**
 * A graph result must reach the panel without anyone expanding anything.
 *
 * Folding a result into the open graph used to be a side effect of RENDERING
 * the tool card — and that card lives inside the turn's collapsed
 * "Worked · 3 tools" strip, which does not mount until the reader expands it.
 * So the merge never ran: the agent narrated an expansion, described four new
 * relationships by name, and the panel sat at three nodes with nothing
 * reporting a failure anywhere.
 *
 * This is the same failure `@ltwlf/spaces-web-ui`'s `CitationSeeder` and
 * `TaskSeeder` were written for, in the same strip, and it takes the same
 * shape: a headless watcher over the thread's own parts, mounted once with the
 * tool UIs, independent of what is expanded. The alternative — force-mounting
 * the strip's contents — makes a disclosure's contents cost something in every
 * transcript and replays every historical result on a reopened chat.
 */

import { useEffect, useRef } from "react";
import { useAuiState } from "@assistant-ui/react";
import { useToolPanelStore } from "@iloveagents/foundry-web-ui";
import { graphToolBindings } from "./graph-tool-registry.ts";
import { GRAPH_PANEL_TYPE, graphPanelContent } from "./graph-panel-content.ts";
import { mergeIntoOpenGraph } from "./merge-into-panel.ts";
import type { GraphPayload } from "../model.ts";

interface ToolishPart {
  type?: string;
  toolName?: string;
  toolCallId?: string;
  args?: unknown;
  result?: unknown;
}

export interface SeedableGraphResult {
  toolCallId: string;
  toolName: string;
  payload: GraphPayload;
  args: unknown;
  title: string;
  autoOpenPanel: boolean;
}

/**
 * Every graph-shaped tool result in the thread, oldest first.
 *
 * Keyed by `toolCallId` rather than by position, so a re-render that rebuilds
 * the parts array does not look like new results.
 */
export function seedableGraphResults(
  messages: readonly { parts?: readonly ToolishPart[] }[] | undefined,
  /**
   * Calls already dealt with. Checked BEFORE `extract` runs, which is the
   * whole point of the parameter: `thread.messages` is a new array on every
   * streamed token, so this walk happens per token, and extracting means
   * validating every node and edge of every graph the conversation has ever
   * produced — work that grows with the transcript and is thrown away every
   * time.
   */
  skip: ReadonlySet<string> = new Set(),
): SeedableGraphResult[] {
  const bindings = graphToolBindings();
  const found: SeedableGraphResult[] = [];
  const seen = new Set<string>();
  for (const message of messages ?? []) {
    for (const part of message?.parts ?? []) {
      const binding = part?.toolName ? bindings.get(part.toolName) : undefined;
      if (!binding) continue;
      // A call still streaming has no result yet, and `undefined` is not a
      // failure — it is simply not ready.
      if (part.result === undefined || part.result === null) continue;
      const id = part.toolCallId;
      if (!id || seen.has(id) || skip.has(id)) continue;
      const payload = binding.extract(part.result, part.args);
      if (!payload) continue;
      seen.add(id);
      found.push({
        toolCallId: id,
        toolName: binding.toolName,
        payload,
        args: part.args,
        title: binding.panelTitle?.(payload, part.args) ?? binding.title,
        autoOpenPanel: binding.autoOpenPanel,
      });
    }
  }
  return found;
}

/**
 * Headless. Acts on graph results that arrive while this thread is open.
 *
 * The baseline is what keeps a reopened conversation from replaying its whole
 * history — opening a saved chat rehydrates every turn it ever had, and
 * without this the last `show_graph` in it would throw a panel over whatever
 * the user was doing. Two details, both learned the hard way downstream
 * (ltwlf/lastspace#650):
 *
 * 1. **History arrives asynchronously.** A resumed thread mounts with NO
 *    messages and fills them in later, so a baseline taken on the first effect
 *    records an empty set and the entire history then looks new. It is taken
 *    on the first NON-EMPTY view instead.
 * 2. **The runtime can outlive the thread.** A host that switches threads
 *    without remounting would carry thread A's ids into thread B, so the
 *    baseline is re-taken whenever the thread identity changes.
 *
 * The card is untouched and still has its "Open in panel" action, so a result
 * in a reopened thread stays reachable that way.
 */
export function GraphResultSeeder() {
  const messages = useAuiState((s) => s.thread.messages) as
    | readonly { parts?: readonly ToolishPart[] }[]
    | undefined;
  const threadId = useAuiState((s) => (s.thread as { threadId?: string }).threadId) as
    | string
    | undefined;
  // A GRAPH panel, not any panel. `isOpen` alone let a result be marked
  // handled while a PDF was up: the merge rejected the non-graph content and
  // the call was consumed anyway, so opening the graph later could never
  // apply it — the same loss the closed-panel deferral was added to prevent.
  const graphPanelOpen = useToolPanelStore(
    (state) => state.isOpen && state.content?.type === GRAPH_PANEL_TYPE,
  );
  const baseline = useRef<{ threadId: string | undefined; ids: Set<string> } | null>(null);
  /** Seen, extracted, and waiting for a graph panel. Cleared with the baseline. */
  const deferred = useRef<Set<string>>(new Set());

  useEffect(() => {
    const current = baseline.current;

    if (current === null || current.threadId !== threadId) {
      // Nothing to anchor to yet — an empty thread may simply not have loaded.
      if (!messages || messages.length === 0) return;
      deferred.current.clear();
      baseline.current = {
        threadId,
        ids: new Set(seedableGraphResults(messages).map((result) => result.toolCallId)),
      };
      return;
    }

    // Everything already acted on is skipped before its payload is extracted,
    // so a streaming turn re-walks the parts array without re-parsing the
    // whole conversation's graphs on every token.
    // Handled OR deferred: both are "do not extract this again". They stay
    // separate sets because only `ids` means finished — a deferred call has to
    // become extractable again the moment a graph panel is there for it.
    const skip = graphPanelOpen ? current.ids : new Set([...current.ids, ...deferred.current]);
    for (const result of seedableGraphResults(messages, skip)) {
      if (result.autoOpenPanel) {
        current.ids.add(result.toolCallId);
        useToolPanelStore.getState().openPanel(graphPanelContent(result.title, result.payload));
        continue;
      }
      // A result that arrives while the panel is CLOSED is not handled, it is
      // early. Ask for an expansion, close the panel before the tool returns,
      // reopen it: the merge had nothing to merge into, and marking the call
      // done anyway meant the answer the user asked for was gone for good.
      // Held back instead, and applied when a graph panel comes back — which
      // is why `graphPanelOpen` is a dependency of this effect.
      if (!graphPanelOpen) {
        // Deferred, and REMEMBERED as deferred. Leaving it out of `deferred`
        // as well as out of `ids` meant `seedableGraphResults` re-extracted it
        // on every pass — and a pass happens per streamed token — so a graph
        // held back while the panel was closed re-validated every node and
        // edge of itself for the rest of the turn. That is the same cost the
        // `skip` parameter exists to avoid; this set is the half of it the
        // deferral had quietly opted out of.
        deferred.current.add(result.toolCallId);
        continue;
      }
      deferred.current.delete(result.toolCallId);
      // Fold into the graph already open when it is about the same part of
      // the graph. This is what makes expanding a node — and watching the
      // agent write one — read as the workspace growing rather than as a
      // series of unrelated pictures. A `false` here with the panel OPEN is a
      // real decision — an unrelated result, or nothing new — so it counts as
      // handled either way.
      current.ids.add(result.toolCallId);
      mergeIntoOpenGraph(result.payload);
    }
  }, [messages, threadId, graphPanelOpen]);

  return null;
}
