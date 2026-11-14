/**
 * Client-side tools, callable by voice.
 *
 * The tools the typed chat can call (`ui_navigate`, `ui_open_panel`, the
 * page-scoped `page_*` set) live in `clientToolRegistry`. In `realtime` mode
 * the Voice Live model is the one deciding to call them, so it needs both
 * the schemas (see `session-config.ts`) and an executor.
 *
 * The SDK owns the wire half: an executor that returns a value has it sent
 * as the `function_call_output` for that `call_id`, and a follow-up response
 * triggered — serialized against any response already running. So all that
 * is left here is dispatch, with the *same* failure semantics as
 * `AGUIRunner`'s tool interception, so a tool that misbehaves reports
 * identically whether it was called by voice or by typing.
 */

import type { ToolRegistry } from "@lykomi/agent";
import type { ToolExecutor } from "@iloveagents/foundry-voice-live-react";

/**
 * A `ToolExecutor` that dispatches into the client tool registry.
 *
 * Always resolves to a JSON string, never rejects: an unanswered function
 * call makes the model re-issue the tool and then report that it did not
 * complete, so an error result is strictly better than no result.
 */
export function createRegistryToolExecutor(registry: ToolRegistry): ToolExecutor {
  return async (name: string, args: string): Promise<string> => {
    if (!registry.isRegistered(name)) {
      return JSON.stringify({ error: `Unknown client tool: ${name}` });
    }
    try {
      return await registry.executeTool(name, args);
    } catch (err) {
      return JSON.stringify({
        error: err instanceof Error ? err.message : "Client-side tool failed",
      });
    }
  };
}
