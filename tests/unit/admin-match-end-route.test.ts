import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminSession = vi.fn();
const getAdminErrorStatus = vi.fn();
const endMatch = vi.fn();

vi.mock("@/server/auth/admin-session", () => ({
  requireAdminSession,
  getAdminErrorStatus,
}));

vi.mock("@/server/services/admin-service", () => ({
  AdminService: vi.fn().mockImplementation(() => ({
    endMatch,
  })),
}));

describe("POST /api/admin/matches/[matchId]/end", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("ends an active match for an authenticated admin", async () => {
    requireAdminSession.mockResolvedValue(undefined);
    endMatch.mockResolvedValue({
      matchId: "match_1",
      sessionId: "session_1",
      status: "ended",
      matchedAt: "2026-04-23T00:00:00.000Z",
      endedAt: "2026-04-23T00:03:00.000Z",
      endReason: "admin_end",
      userA: {
        userId: "user_a",
        handle: "guest_a",
        countryCode: "US",
        ageConfirmed: true,
        onboardingCompleted: true,
        onboardingCompletedAt: "2026-04-23T00:00:00.000Z",
        createdAt: "2026-04-23T00:00:00.000Z",
      },
      userB: {
        userId: "user_b",
        handle: "guest_b",
        countryCode: "CA",
        ageConfirmed: true,
        onboardingCompleted: true,
        onboardingCompletedAt: "2026-04-23T00:00:00.000Z",
        createdAt: "2026-04-23T00:00:00.000Z",
      },
    });

    const { POST } = await import("@/app/api/admin/matches/[matchId]/end/route");
    const response = await POST(
      new Request("http://localhost:3000/api/admin/matches/match_1/end", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "admin_end" }),
      }),
      { params: Promise.resolve({ matchId: "match_1" }) },
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      match: expect.objectContaining({
        matchId: "match_1",
        status: "ended",
      }),
    });
    expect(endMatch).toHaveBeenCalledWith("match_1", "admin_end");
  });
});
