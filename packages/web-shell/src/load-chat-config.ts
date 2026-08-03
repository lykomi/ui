import { reasoningDefaultStore, type ResolvedReasoningEffort } from "@iloveagents/foundry-agent";
import { defaultAgentFetch } from "./service-fetch-default.ts";

const VALID: readonly string[] = ["low", "medium", "high", "xhigh"];

/**
 * Ask the backend what it does when the client sends no reasoning effort.
 *
 * The composer's `Auto` option sends nothing, so the level that actually
 * applies is the backend's. Showing the user which one that is turns `Auto`
 * from "some level, who knows" into a statement they can act on — it decides
 * cost and latency, so guessing is not acceptable.
 *
 * Fails silently on purpose. If the backend is older, the route is absent, or
 * the call 401s, {@link reasoningDefaultStore} keeps `resolved: null` and the
 * picker says "uses the app's configured level" instead of naming one. A
 * wrong level is worse than an unknown level; nothing here invents a value.
 *
 * Called once the user is authenticated, since the endpoint sits behind the
 * same auth as the rest of the API.
 */
export async function loadChatConfig(): Promise<void> {
  try {
    const response = await defaultAgentFetch("/api/chat/config");
    if (!response.ok) return;
    const body = (await response.json()) as {
      reasoning?: { defaultEffort?: unknown };
    };
    const effort = body?.reasoning?.defaultEffort;
    // `null` is meaningful (reasoning switched off) and must not be coerced
    // into a level; anything unrecognised is treated the same as unknown
    // rather than passed through to a label.
    if (typeof effort === "string" && VALID.includes(effort)) {
      reasoningDefaultStore.getState().setResolved(effort as ResolvedReasoningEffort);
    }
  } catch {
    // Network/parse failure — leave the store unset. See above.
  }
}
