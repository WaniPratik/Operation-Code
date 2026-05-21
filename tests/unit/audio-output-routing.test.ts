import { describe, expect, it, vi } from "vitest";
import {
  applyAudioOutputMode,
  getBestEffortSpeakerSinkId,
  supportsAudioOutputRouting,
} from "@/features/match/audio-output-routing";

function createAudioElement(setSinkId?: (sinkId: string) => Promise<void>) {
  return { setSinkId } as HTMLMediaElement;
}

describe("audio output routing", () => {
  it("detects whether any rendered audio element supports setSinkId", () => {
    expect(supportsAudioOutputRouting([createAudioElement()])).toBe(false);
    expect(supportsAudioOutputRouting([createAudioElement(vi.fn())])).toBe(true);
  });

  it("chooses a non-default output device for speaker mode when available", () => {
    expect(
      getBestEffortSpeakerSinkId([
        { kind: "audiooutput", deviceId: "default" },
        { kind: "audiooutput", deviceId: "speaker_1" },
      ] as MediaDeviceInfo[]),
    ).toBe("speaker_1");
  });

  it("falls back gracefully when browser output routing is unsupported", async () => {
    await expect(applyAudioOutputMode([createAudioElement()], "speaker")).resolves.toEqual({
      supported: false,
      mode: "speaker",
      message: "Use your device audio controls.",
    });
  });

  it("applies default and speaker sink ids to supported audio elements", async () => {
    const setSinkId = vi.fn().mockResolvedValue(undefined);
    const element = createAudioElement(setSinkId);

    await applyAudioOutputMode([element], "default");
    await applyAudioOutputMode([element], "speaker", async () => [
      { kind: "audiooutput", deviceId: "speaker_1" },
    ] as MediaDeviceInfo[]);

    expect(setSinkId).toHaveBeenNthCalledWith(1, "default");
    expect(setSinkId).toHaveBeenNthCalledWith(2, "speaker_1");
  });
});
