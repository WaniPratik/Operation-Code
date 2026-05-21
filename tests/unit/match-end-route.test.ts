import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireGuestSession = vi.fn();
const endMatch = vi.fn();
const joinQueue = vi.fn();
const writeAudit = vi.fn();

vi.mock("@/server/services/session-service", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    requireGuestSession,
  })),
}));

vi.mock("@/server/services/match-service", () => ({
  MatchService: vi.fn().mockImplementation(() => ({
    endMatch,
  })),
}));

vi.mock("@/server/services/queue-service", () => ({
  QueueService: vi.fn().mockImplementation(() => ({
    joinQueue,
  })),
}));

vi.mock("@/server/services/audit-service", () => ({
  AuditService: vi.fn().mockImplementation(() => ({
    write: writeAudit,
  })),
}));

describe("POST /api/match/end", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns queue state when end succeeds", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    endMatch.mockResolvedValue({
      status: "idle",
      queueEntryId: null,
      enteredAt: null,
      filters: {
        preferredCountries: [],
        excludedCountries: [],
      },
      activeMatch: null,
      recentMatch: null,
    });

    const { POST } = await import("@/app/api/match/end/route");
    const response = await POST(
      new Request("http://localhost:3000/api/match/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: "match_1", reason: "user_end" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      queue: expect.objectContaining({
        status: "idle",
      }),
    });
    expect(endMatch).toHaveBeenCalledWith("user_1", "match_1", "user_end");
  });

  it("can end a match and immediately start finding the next one", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    endMatch.mockResolvedValue({
      status: "idle",
      queueEntryId: null,
      enteredAt: null,
      filters: {
        preferredCountries: [],
        excludedCountries: [],
      },
      activeMatch: null,
      recentMatch: {
        matchId: "match_1",
        sessionId: "session_1",
        status: "ended",
        matchedAt: "2026-04-23T00:00:03.000Z",
        endedAt: "2026-04-23T00:02:00.000Z",
        counterpart: {
          userId: "user_2",
          handle: "guest_user_2",
          countryCode: "US",
        },
        preConnectionSeconds: 2,
      },
    });
    joinQueue.mockResolvedValue({
      status: "queued",
      queueEntryId: "queue_next",
      enteredAt: "2026-04-23T00:02:01.000Z",
      filters: {
        preferredCountries: [],
        excludedCountries: [],
      },
      activeMatch: null,
      recentMatch: null,
    });

    const { POST } = await import("@/app/api/match/end/route");
    const response = await POST(
      new Request("http://localhost:3000/api/match/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: "match_1", reason: "user_end", findNext: true }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      queue: expect.objectContaining({
        status: "queued",
        queueEntryId: "queue_next",
      }),
    });
    expect(endMatch).toHaveBeenCalledWith("user_1", "match_1", "user_end");
    expect(joinQueue).toHaveBeenCalledWith("user_1", {
      preferredCountries: [],
      excludedCountries: [],
    });
    expect(writeAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user_1",
        matchId: "match_1",
        eventName: "end_find_next",
      }),
    );
  });

  it("still returns the ended queue state when next search is cooling down", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    endMatch.mockResolvedValue({
      status: "idle",
      queueEntryId: null,
      enteredAt: null,
      filters: {
        preferredCountries: [],
        excludedCountries: [],
      },
      activeMatch: null,
      recentMatch: {
        matchId: "match_1",
        sessionId: "session_1",
        status: "ended",
        matchedAt: "2026-04-23T00:00:03.000Z",
        endedAt: "2026-04-23T00:00:04.000Z",
        counterpart: {
          userId: "user_2",
          handle: "guest_user_2",
          countryCode: "US",
        },
        preConnectionSeconds: 2,
      },
    });
    joinQueue.mockRejectedValue(
      Object.assign(new Error("Please wait 5 seconds before joining the queue again."), {
        statusCode: 429,
      }),
    );

    const { POST } = await import("@/app/api/match/end/route");
    const response = await POST(
      new Request("http://localhost:3000/api/match/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: "match_1", reason: "user_end", findNext: true }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      queue: expect.objectContaining({
        status: "idle",
        recentMatch: expect.objectContaining({
          status: "ended",
        }),
      }),
      nextQueueError: "Please wait 5 seconds before joining the queue again.",
      nextQueueErrorStatus: 429,
    });
  });

  it("returns participant errors as 403 json responses", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    endMatch.mockRejectedValue(
      Object.assign(new Error("User is not a participant in this match."), { statusCode: 403 }),
    );

    const { POST } = await import("@/app/api/match/end/route");
    const response = await POST(
      new Request("http://localhost:3000/api/match/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: "match_2" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "User is not a participant in this match.",
    });
  });

  it("returns a 400 json error when the request body is malformed", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });

    const { POST } = await import("@/app/api/match/end/route");
    const response = await POST(
      new Request("http://localhost:3000/api/match/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{",
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "matchId is required.",
    });
  });
});
