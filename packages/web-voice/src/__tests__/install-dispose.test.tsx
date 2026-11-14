/**
 * Disposal must clear only what this installation still owns.
 *
 * Both registries are last-registration-wins, so a second installation
 * legitimately takes over. Clearing unconditionally means unmounting an OLDER
 * host strips the live one: the replacement loses its adapter (and with it the
 * runtime's voice capability) and its composer controls, while still mounted.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  registerChatSlots,
  registerVoiceAdapter,
  useChatSlotsStore,
  useVoiceAdapterStore,
} from "@lykomi/web-ui";
import { installVoice } from "../react/install.tsx";

const config = { connection: { proxyUrl: "ws://localhost:8080/ws" } };

afterEach(() => {
  useVoiceAdapterStore.setState({ voice: null, speech: null });
  useChatSlotsStore.setState({
    composerBanner: null,
    launcherBadge: null,
    composerActions: null,
    composerActionsReplaceSend: false,
    threadSurface: null,
  });
});

describe("installVoice disposal", () => {
  it("clears its own registrations", () => {
    const install = installVoice(config);
    expect(useVoiceAdapterStore.getState().voice).not.toBeNull();
    expect(useChatSlotsStore.getState().composerActions).not.toBeNull();

    install.dispose();

    expect(useVoiceAdapterStore.getState().voice).toBeNull();
    expect(useChatSlotsStore.getState().composerActions).toBeNull();
  });

  it("leaves a newer installation's registrations alone", () => {
    const older = installVoice(config);
    const newer = installVoice(config);
    const live = useVoiceAdapterStore.getState().voice;
    expect(live).not.toBeNull();

    older.dispose();

    expect(useVoiceAdapterStore.getState().voice, "the newer adapter was cleared").toBe(live);
    expect(useChatSlotsStore.getState().composerActions).not.toBeNull();

    newer.dispose();
    expect(useVoiceAdapterStore.getState().voice).toBeNull();
  });

  it("leaves a host's own adapter alone", () => {
    // Not another installation — an app that registered its own adapter after
    // ours. Same rule: we do not own it, so we do not clear it.
    const install = installVoice(config);
    const theirs = {
      connect: () => {
        throw new Error("unused");
      },
    } as never;
    registerVoiceAdapter(theirs);

    install.dispose();

    expect(useVoiceAdapterStore.getState().voice).toBe(theirs);
  });

  it("leaves a host's own composer control alone", () => {
    const install = installVoice(config);
    const TheirButton = () => null;
    registerChatSlots({ composerActions: TheirButton });

    install.dispose();

    expect(useChatSlotsStore.getState().composerActions).toBe(TheirButton);
  });
});
