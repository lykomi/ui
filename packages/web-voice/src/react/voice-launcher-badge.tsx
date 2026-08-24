/**
 * Shown over the collapsed chat launcher while a call is live.
 *
 * Closing the floating panel does not end the call: `VoiceSurface` is mounted
 * as a layout extra, so the session — and the microphone — outlive the panel
 * that started it, while every control goes away with it. A launcher that
 * looked idle while the microphone was still capturing is the problem this
 * solves. The dot says a call is running; the button ends it without making
 * the user guess that reopening chat is the way out.
 *
 * Reads assistant-ui state only, like the composer button, so it stays true
 * for any registered `RealtimeVoiceAdapter`.
 */

import { useVoiceControls, useVoiceState } from "@assistant-ui/react";
import { PhoneOff } from "lucide-react";

export function VoiceLauncherBadge() {
  const voice = useVoiceState();
  const controls = useVoiceControls();

  if (!voice || voice.status.type === "ended") return null;

  const connecting = voice.status.type === "starting";

  return (
    <span
      // The launcher wrapper is a positioned `group`, which is the anchor
      // contract this slot is documented against.
      className="pointer-events-none absolute -right-1 -top-1 z-10 flex items-center"
    >
      <span
        aria-hidden="true"
        className={`size-3 rounded-full bg-primary ring-2 ring-background ${
          connecting ? "animate-pulse" : "animate-[pulse_1.6s_ease-in-out_infinite]"
        }`}
      />
      {/* Revealed on hover of the launcher group — the slot is documented to
          support exactly this, so ending a call never needs the panel.
          Hidden with opacity, never `display:none`: a display-hidden control
          is not focusable, so it drops out of the tab order entirely and no
          `focus-visible:` rule on it can ever fire. That would leave keyboard
          and screen-reader users with a live microphone and no way to stop it
          — the very thing this badge exists to prevent. `group-focus-within`
          reveals it when tabbed to, and `pointer-events-none` keeps the
          invisible state from swallowing clicks meant for the launcher. */}
      <button
        type="button"
        onClick={(e) => {
          // The launcher underneath opens the chat; ending the call must not
          // also reopen the panel the user deliberately closed.
          e.stopPropagation();
          controls.disconnect();
        }}
        aria-label="End voice conversation"
        className={
          "pointer-events-none ml-1 flex items-center gap-1 rounded-full bg-background/95 " +
          "px-2 py-1 text-xs text-foreground opacity-0 shadow ring-1 ring-border " +
          "transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 " +
          "group-focus-within:pointer-events-auto group-focus-within:opacity-100 " +
          "focus-visible:pointer-events-auto focus-visible:opacity-100"
        }
      >
        <PhoneOff className="size-3.5" />
        End call
      </button>
      <span className="sr-only">Voice conversation in progress</span>
    </span>
  );
}
