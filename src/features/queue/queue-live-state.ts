import type { QueueStatusView } from "@/types/domain";

export type QueueUiStatus = "idle" | "queued" | "connecting" | "matched";

export function getConnectingSecondsRemaining(queue: QueueStatusView | null, now = Date.now()) {
  const match = queue?.activeMatch;

  if (!match || match.status !== "matched") {
    return 0;
  }

  const elapsedSeconds = Math.floor((now - Date.parse(match.matchedAt)) / 1000);
  return Math.max(0, match.preConnectionSeconds - elapsedSeconds);
}

export function getQueueUiStatus(queue: QueueStatusView | null, now = Date.now()): QueueUiStatus {
  if (!queue) {
    return "idle";
  }

  if (queue.activeMatch?.status === "matched") {
    return getConnectingSecondsRemaining(queue, now) > 0 ? "connecting" : "matched";
  }

  return queue.status;
}

export function getQueuePollIntervalMs(queue: QueueStatusView | null, isDocumentVisible: boolean, now = Date.now()) {
  if (!queue) {
    return null;
  }

  const uiStatus = getQueueUiStatus(queue, now);

  if (uiStatus === "queued") {
    return isDocumentVisible ? 1000 : 3000;
  }

  if (uiStatus === "connecting") {
    return 1000;
  }

  return null;
}
