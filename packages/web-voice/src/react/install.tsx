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
import { useEffect, useState } from "react";
import { registerChatSlots, registerVoiceAdapter } from "@iloveagents/foundry-web-ui";
import { VoiceBridge } from "../adapter/voice-bridge.ts";
import type { VoiceConfig } from "../adapter/types.ts";
import { VoiceMicButton } from "./voice-mic-button.tsx";
import { VoiceStatusStrip } from "./voice-status-strip.tsx";
import { VoiceLauncherBadge } from "./voice-launcher-badge.tsx";
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
  /**
   * Replace the chat thread with the voice stage while a call is live.
   * Turn off to keep the transcript visible and show the avatar floating.
   * @default true
   */
  stage?: boolean;
}

export interface VoiceInstallation {
  bridge: VoiceBridge;
  /** Mount this inside the assistant runtime — it owns the session. */
  Host: ComponentType;
  /** Undo the registrations (adapter and, if claimed, the chat slots). */
  dispose: () => void;
}

export function installVoice(options: VoiceInstallOptions): VoiceInstallation {
  const { chrome = true, avatar = true, stage = true, ...config } = options;
  const bridge = new VoiceBridge(config);

  registerVoiceAdapter(bridge.createAdapter());
  if (chrome) {
    registerChatSlots({
      composerActions: VoiceMicButton,
      composerBanner: VoiceStatusStrip,
      // A call outlives the panel that started it, so the collapsed launcher
      // has to show one is running and offer a way out. Renders nothing while
      // idle, so a chat with no call looks exactly as it did.
      launcherBadge: VoiceLauncherBadge,
      // Nothing typed means Send has nothing to do; the corner is
      // better spent on the other way of asking.
      composerActionsReplaceSend: true,
    });
  }

  const Host: ComponentType = () => (
    <VoiceSurface bridge={bridge} config={config} avatar={avatar} stage={stage} />
  );
  Host.displayName = "FoundryVoiceHost";

  return {
    bridge,
    Host,
    dispose: () => {
      registerVoiceAdapter(null);
      if (chrome) {
        registerChatSlots({
          composerActions: null,
          composerBanner: null,
          launcherBadge: null,
          composerActionsReplaceSend: false,
          threadSurface: null,
        });
      }
    },
  };
}

/**
 * Drop-in voice for an app that composes its own runtime.
 *
 * Render it anywhere inside `AGUIRuntimeProvider`. Installation happens in
 * an effect, never during render: `installVoice` writes to zustand stores,
 * and a store write during render is exactly what StrictMode's double-
 * invoked initializers exist to catch — two bridges get built, the adapter
 * from the *discarded* one stays registered, the mounted host owns the
 * other, and the first connect waits on a bridge nobody attached to until
 * the 10s timeout errors it out.
 *
 * Registering after mount is safe because both seams are reactive: the
 * runtime provider re-reads the adapter store on every render, and the chat
 * slots are subscriptions. The installation is created once per mount, so a
 * caller passing inline config objects cannot churn the session; config
 * changes need a remount (`key`), same as the module path.
 */
export function FoundryVoice(props: VoiceInstallOptions): ReactNode {
  const [installation, setInstallation] = useState<VoiceInstallation | null>(null);

  // Captured at install time, deliberately — see the docstring.
  const [initialProps] = useState(props);
  useEffect(() => {
    const inst = installVoice(initialProps);
    setInstallation(inst);
    return () => inst.dispose();
  }, [initialProps]);

  const Host = installation?.Host;
  return Host ? <Host /> : null;
}
