import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireGuestSession = vi.fn();
const joinQueue = vi.fn();

vi.mock("@/server/services/session-service", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    requireGuestSession,
  })),
}));

vi.mock("@/server/services/queue-service", () => ({
  QueueService: vi.fn().mockImplementation(() => ({
    joinQueue,
  })),
}));

describe("POST /api/queue", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns queue status when join succeeds", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    joinQueue.mockResolvedValue({
      status: "queued",
      queueEntryId: "queue_1",
      enteredAt: "2026-04-23T00:00:00.000Z",
      filters: {
        preferredCountries: [],
        excludedCountries: [],
      },
      activeMatch: null,
      recentMatch: null,
    });

    const { POST } = await import("@/app/api/queue/route");
    const response = await POST(
      new Request("http://localhost:3000/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCountries: [], excludedCountries: [] }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      queue: expect.objectContaining({
        status: "queued",
        queueEntryId: "queue_1",
      }),
    });
  });

  it("returns a cooldown status when the user is rejoining too quickly", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    joinQueue.mockRejectedValue({
      message: "Please wait 5 seconds before joining the queue again.",
      statusCode: 429,
    });

    const { POST } = await import("@/app/api/queue/route");
    const response = await POST(
      new Request("http://localhost:3000/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCountries: [], excludedCountries: [] }),
      }),
    );

    expect(response.status).toBe(429);
    await expect(response.json()).resolves.toEqual({
      error: "Please wait 5 seconds before joining the queue again.",
    });
  });

  it("returns the real backend cause during local development", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    joinQueue.mockRejectedValue({
      message: "Could not find the function public.claim_tiered_match(requester_user_id) in the schema cache",
      code: "PGRST202",
      details: "Searched for the function in the schema cache.",
      hint: "Perhaps you meant to call public.find_tiered_match_candidate",
    });

    const { POST } = await import("@/app/api/queue/route");
    const response = await POST(
      new Request("http://localhost:3000/api/queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferredCountries: [], excludedCountries: [] }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error:
        "Could not find the function public.claim_tiered_match(requester_user_id) in the schema cache (code: PGRST202; details: Searched for the function in the schema cache.; hint: Perhaps you meant to call public.find_tiered_match_candidate)",
    });
  });
});
