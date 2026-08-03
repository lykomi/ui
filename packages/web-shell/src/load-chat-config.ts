import { reasoningDefaultStore, type ResolvedReasoningEffort } from "@iloveagents/foundry-agent";

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
export async function loadChatConfig(fetchImpl: typeof fetch): Promise<void> {
  const reset = () => reasoningDefaultStore.getState().setResolved(null);
  try {
    const response = await fetchImpl("/api/chat/config");
    if (!response.ok) {
      reset();
      return;
    }
    const body = (await response.json()) as {
      reasoning?: { defaultEffort?: unknown };
    };
    const effort = body?.reasoning?.defaultEffort;
    // `null` is meaningful (reasoning switched off) and anything unrecognised
    // is treated the same as unknown — neither is coerced into a level.
    if (typeof effort === "string" && VALID.includes(effort)) {
      reasoningDefaultStore.getState().setResolved(effort as ResolvedReasoningEffort);
    } else {
      reset();
    }
  } catch {
    reset();
  }
}
