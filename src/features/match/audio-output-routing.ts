export type AudioOutputMode = "default" | "speaker";

type SinkCapableElement = HTMLMediaElement & {
  setSinkId?: (sinkId: string) => Promise<void>;
};

export interface AudioOutputRoutingResult {
  supported: boolean;
  mode: AudioOutputMode;
  message: string | null;
}

function canSetSinkId(element: HTMLMediaElement): element is SinkCapableElement {
  return typeof (element as SinkCapableElement).setSinkId === "function";
}

export function supportsAudioOutputRouting(elements: Iterable<HTMLMediaElement>) {
  for (const element of elements) {
    if (canSetSinkId(element)) {
      return true;
    }
  }

  return false;
}

export function getBestEffortSpeakerSinkId(devices: MediaDeviceInfo[]) {
  const speaker = devices.find(
    (device) =>
      device.kind === "audiooutput" &&
      device.deviceId &&
      !["default", "communications"].includes(device.deviceId),
  );

  return speaker?.deviceId ?? "default";
}

async function enumerateAudioOutputDevices() {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) {
    return [];
  }

  return navigator.mediaDevices.enumerateDevices();
}

export async function applyAudioOutputMode(
  elements: Iterable<HTMLMediaElement>,
  mode: AudioOutputMode,
  enumerateDevices = enumerateAudioOutputDevices,
): Promise<AudioOutputRoutingResult> {
  const sinkCapableElements = Array.from(elements).filter(canSetSinkId);

  if (sinkCapableElements.length === 0) {
    return {
      supported: false,
      mode,
      message: "Use your device audio controls.",
    };
  }

  const devices = mode === "speaker" ? await enumerateDevices().catch(() => []) : [];
  const sinkId = mode === "speaker" ? getBestEffortSpeakerSinkId(devices) : "default";

  await Promise.all(sinkCapableElements.map((element) => element.setSinkId(sinkId)));

  return {
    supported: true,
    mode,
    message:
      mode === "speaker" && sinkId === "default"
        ? "Speaker routing depends on this browser and device."
        : null,
  };
}
