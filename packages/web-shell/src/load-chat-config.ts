import {
  contextUsageStore,
  reasoningDefaultStore,
  type ResolvedReasoningEffort,
} from "@iloveagents/foundry-agent";

const VALID: readonly string[] = ["low", "medium", "high", "xhigh"];

/**
 * Ask the backend what it does when the client sends no reasoning effort.
 *
 * The composer's `Auto` option sends nothing, so the level that actually
 * applies is the backend's. Showing the user which one that is turns `Auto`
 * from "some level, who knows" into a statement they can act on — it decides
 * cost and latency, so guessing is not acceptable.
 *
 * Every non-success path RESETS the store to `null` rather than leaving a
 * previous value behind. This function may be called again when the context
 * changes; keeping a stale level after a failed refresh would show the user
 * a label that no longer describes the backend — the exact lie this feature
 * exists to prevent. Unknown is safe; wrong is not.
 *
 * `fetchImpl` is the shell's agent fetch (auth + base URL); tests and custom
 * shells inject their own via the same `agentFetch` seam as the rest of the
 * shell.
 */
export async function loadChatConfig(
  fetchImpl: typeof fetch,
  params?: Record<string, string>,
): Promise<void> {
  const reset = () => {
    reasoningDefaultStore.getState().setResolved(null);
    contextUsageStore.getState().setWindow(null);
  };
  try {
    const query = params && Object.keys(params).length > 0 ? `?${new URLSearchParams(params)}` : "";
    const response = await fetchImpl(`/api/chat/config${query}`);
    if (!response.ok) {
      reset();
      return;
    }
    const body = (await response.json()) as {
      reasoning?: { defaultEffort?: unknown; scope?: unknown };
      context?: { windowTokens?: unknown };
    };
    // How much a chat can hold, if the backend says. Anything else leaves
    // the context indicator hidden rather than drawn against a guess.
    const windowTokens = body?.context?.windowTokens;
    contextUsageStore.getState().setWindow(typeof windowTokens === "number" ? windowTokens : null);
    const effort = body?.reasoning?.defaultEffort;
    const scope = body?.reasoning?.scope;
    // `null` is meaningful (reasoning switched off) and anything unrecognised
    // is treated the same as unknown — neither is coerced into a level. The
    // scope is the backend's phrase for WHERE the level came from ("for this
    // workspace"); non-string scopes are dropped, never rendered.
    if (typeof effort === "string" && VALID.includes(effort)) {
      reasoningDefaultStore
        .getState()
        .setResolved(
          effort as ResolvedReasoningEffort,
          typeof scope === "string" && scope ? scope : null,
        );
    } else {
      reset();
    }
  } catch {
    reset();
  }
}

// --- context-aware refresh -------------------------------------------------

let bootFetch: typeof fetch | null = null;

/** Wired by ShellApp at boot; refreshChatConfig is a no-op before that. */
export function _setChatConfigFetch(fetchImpl: typeof fetch): void {
  bootFetch = fetchImpl;
}

/**
 * Re-ask the backend what `Auto` resolves to, optionally for a context.
 *
 * Host apps call this when the user's context changes (e.g. switching
 * workspace) with opaque query params the backend understands — this
 * package deliberately knows nothing about what the params mean. Before
 * the shell has booted there is no fetch client yet; calling then is a
 * safe no-op and the boot-time load will run anyway.
 */
export async function refreshChatConfig(params?: Record<string, string>): Promise<void> {
  if (!bootFetch) return;
  await loadChatConfig(bootFetch, params);
}
