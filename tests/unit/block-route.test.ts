import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireGuestSession = vi.fn();
const blockUser = vi.fn();

vi.mock("@/server/services/session-service", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    requireGuestSession,
  })),
}));

vi.mock("@/server/services/moderation-service", () => ({
  ModerationService: vi.fn().mockImplementation(() => ({
    blockUser,
  })),
}));

describe("POST /api/block", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns success when blocking succeeds", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    blockUser.mockResolvedValue(undefined);

    const { POST } = await import("@/app/api/block/route");
    const response = await POST(
      new Request("http://localhost:3000/api/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: "match_1" }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(blockUser).toHaveBeenCalledWith("user_1", {
      matchId: "match_1",
    });
  });

  it("returns participant errors as 403 json responses", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    blockUser.mockRejectedValue(
      Object.assign(new Error("User is not a participant in this match."), { statusCode: 403 }),
    );

    const { POST } = await import("@/app/api/block/route");
    const response = await POST(
      new Request("http://localhost:3000/api/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId: "match_1" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "User is not a participant in this match.",
    });
  });
});
