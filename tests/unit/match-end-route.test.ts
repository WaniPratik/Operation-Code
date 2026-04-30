import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireGuestSession = vi.fn();
const endMatch = vi.fn();

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
