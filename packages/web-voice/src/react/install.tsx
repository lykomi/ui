/**
 * Installing the voice tier: one bridge, one adapter registration, one
 * (optional) set of chat-chrome slots.
 *
 * Two ways in, one implementation:
 *
 *   - `createVoiceModule(config)` for `bootstrapShell` apps — the module's
 *     `layoutExtras` mounts the session host.
 *   - `<FoundryVoice {...config} />` for apps that compose the runtime
 *     themselves and never use the shell.
 *
 * Registration happens when the voice tier is *installed*, not when its host
 * mounts. `useLocalRuntime` re-applies its options on every render, so a
 * later registration would also be picked up — but installing first means
 * the adapter is already there when the runtime first mounts, and the order
 * never has to be reasoned about.
 */

import type { ComponentType, ReactNode } from "react";
import { useState } from "react";
import { registerChatSlots, registerVoiceAdapter } from "@iloveagents/foundry-web-ui";
import { VoiceBridge } from "../adapter/voice-bridge.ts";
import type { VoiceConfig } from "../adapter/types.ts";
import { VoiceMicButton } from "./voice-mic-button.tsx";
import { VoiceStatusStrip } from "./voice-status-strip.tsx";
import { VoiceSurface } from "./voice-surface.tsx";

export interface VoiceInstallOptions extends VoiceConfig {
  /**
   * Register the mic button and status strip into the chat composer.
   * Turn off to place `VoiceMicButton` / `VoiceStatusStrip` yourself.
   * @default true
   */
  chrome?: boolean;
  /** Render the avatar panel when the session config asks for an avatar. @default true */
  avatar?: boolean;
}

export interface VoiceInstallation {
  bridge: VoiceBridge;
  /** Mount this inside the assistant runtime — it owns the session. */
  Host: ComponentType;
  /** Undo the registrations (adapter and, if claimed, the chat slots). */
  dispose: () => void;
}

export function installVoice(options: VoiceInstallOptions): VoiceInstallation {
  const { chrome = true, avatar = true, ...config } = options;
  const bridge = new VoiceBridge(config);

  registerVoiceAdapter(bridge.createAdapter());
  if (chrome) {
    registerChatSlots({ composerActions: VoiceMicButton, composerBanner: VoiceStatusStrip });
  }

  const Host: ComponentType = () => (
    <VoiceSurface bridge={bridge} config={config} avatar={avatar} />
  );
  Host.displayName = "FoundryVoiceHost";

  return {
    bridge,
    Host,
    dispose: () => {
      registerVoiceAdapter(null);
      if (chrome) registerChatSlots({ composerActions: null, composerBanner: null });
    },
  };
}

/**
 * Drop-in voice for an app that composes its own runtime.
 *
 * Render it anywhere inside `AGUIRuntimeProvider`. The installation is
 * created once per mount and never re-created, so a caller passing inline
 * config objects cannot churn the session.
 */
export function FoundryVoice(props: VoiceInstallOptions): ReactNode {
  const [{ Host }] = useState(() => installVoice(props));
  return <Host />;
}
