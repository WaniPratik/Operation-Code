import { describe, expect, it } from "vitest";
import {
  getConnectingSecondsRemaining,
  getQueuePollIntervalMs,
  getQueueUiStatus,
} from "@/features/queue/queue-live-state";
import type { QueueStatusView } from "@/types/domain";

function buildQueue(overrides: Partial<QueueStatusView> = {}): QueueStatusView {
  return {
    status: "queued",
    queueEntryId: "queue_1",
    enteredAt: "2026-04-23T00:00:00.000Z",
    filters: {
      preferredCountries: [],
      excludedCountries: [],
    },
    activeMatch: null,
    recentMatch: null,
    ...overrides,
  };
}

describe("queue live state", () => {
  it("stays queued when there is no active match", () => {
    expect(getQueueUiStatus(buildQueue(), Date.now())).toBe("queued");
  });

  it("switches to connecting while the pre-connection window is still active", () => {
    const queue = buildQueue({
      status: "matched",
      activeMatch: {
        matchId: "match_1",
        sessionId: "session_1",
        status: "matched",
        matchedAt: "2026-04-23T00:00:01.000Z",
        endedAt: null,
        counterpart: {
          userId: "user_2",
          handle: "guest_b",
          countryCode: "CA",
        },
        preConnectionSeconds: 2,
      },
    });

    expect(getConnectingSecondsRemaining(queue, Date.parse("2026-04-23T00:00:02.200Z"))).toBe(1);
    expect(getQueueUiStatus(queue, Date.parse("2026-04-23T00:00:02.200Z"))).toBe("connecting");
  });

  it("switches to matched after the connecting window ends", () => {
    const queue = buildQueue({
      status: "matched",
      activeMatch: {
        matchId: "match_1",
        sessionId: "session_1",
        status: "matched",
        matchedAt: "2026-04-23T00:00:01.000Z",
        endedAt: null,
        counterpart: {
          userId: "user_2",
          handle: "guest_b",
          countryCode: "CA",
        },
        preConnectionSeconds: 2,
      },
    });

    expect(getConnectingSecondsRemaining(queue, Date.parse("2026-04-23T00:00:05.000Z"))).toBe(0);
    expect(getQueueUiStatus(queue, Date.parse("2026-04-23T00:00:05.000Z"))).toBe("matched");
  });

  it("uses faster polling while visible and queued", () => {
    const now = Date.parse("2026-04-23T00:00:02.200Z");
    expect(getQueuePollIntervalMs(buildQueue(), true, now)).toBe(1000);
    expect(getQueuePollIntervalMs(buildQueue(), false, now)).toBe(3000);
  });

  it("keeps polling during connecting but stops after matched", () => {
    const connectingQueue = buildQueue({
      status: "matched",
      activeMatch: {
        matchId: "match_1",
        sessionId: "session_1",
        status: "matched",
        matchedAt: new Date(Date.now()).toISOString(),
        endedAt: null,
        counterpart: {
          userId: "user_2",
          handle: "guest_b",
          countryCode: null,
        },
        preConnectionSeconds: 2,
      },
    });

    const connectingNow = Date.parse(connectingQueue.activeMatch!.matchedAt) + 1000;
    expect(getQueuePollIntervalMs(connectingQueue, true, connectingNow)).toBe(1000);
    expect(
      getQueuePollIntervalMs(
        {
          ...connectingQueue,
          activeMatch: {
            ...connectingQueue.activeMatch!,
            matchedAt: "2026-04-23T00:00:00.000Z",
          },
        },
        true,
        Date.parse("2026-04-23T00:00:05.000Z"),
      ),
    ).toBeNull();
  });
});
