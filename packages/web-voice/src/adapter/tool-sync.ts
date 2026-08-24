/**
 * Keeps the live session's tool catalogue in step with the page's.
 *
 * Two things this has to get right, and an inline callback got both wrong:
 *
 * - **Nothing may be dropped while the session is still connecting.** Page
 *   tools are registered and cleared on navigation, so the catalogue can
 *   change between mount and `session.created`. A callback that returns
 *   early when the session is not ready loses that change permanently —
 *   nothing replays it — and the model is left unable to act on the page
 *   the user is looking at, or calling a tool that no longer exists. The
 *   fix is not inside this class: the caller must `sync()` again the moment
 *   the session becomes ready, which the dedupe below makes free.
 *
 * - **Not every registry notification is a tool change.** `clientToolRegistry`
 *   is a zustand store, so subscribers fire on *any* state write. Sending a
 *   `session.update` for each one is pointless traffic on a live socket.
 *   Comparing the serialized catalogue collapses those to nothing.
 */

import type { ToolRegistry } from "@iloveagents/foundry-agent";
import type { Tool } from "@iloveagents/foundry-voice-live-react";
import { sessionTools } from "./session-config.ts";

export class ToolSync {
  /** Serialized catalogue last put on the wire, or null if none has been. */
  private lastSent: string | null = null;

  constructor(private readonly send: (tools: Tool[]) => void) {}

  /**
   * Push the session's current catalogue, unless it is already on the wire.
   *
   * `hostTools` is not optional decoration: `session.update` replaces the
   * catalogue outright, so sending the registry's tools alone withdraws every
   * MCP server and Foundry agent tool the host configured, and any host
   * override of a registry tool. It has to be the same merge the session was
   * built with, which is why both go through `sessionTools`.
   */
  sync(registry: ToolRegistry, hostTools: Tool[] | undefined): void {
    const tools = sessionTools(registry, hostTools) ?? [];
    const key = JSON.stringify(tools);
    if (key === this.lastSent) return;
    this.lastSent = key;
    this.send(tools);
  }

  /**
   * Forget what was sent.
   *
   * A new session starts with whatever catalogue its own `session.update`
   * carried, but this object cannot know that — so after a disconnect it
   * must assume nothing, or the first sync of the next session is skipped
   * as a duplicate and that session runs with a catalogue nobody sent.
   */
  reset(): void {
    this.lastSent = null;
  }
}
