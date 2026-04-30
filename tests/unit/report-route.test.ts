import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireGuestSession = vi.fn();
const submitReport = vi.fn();

vi.mock("@/server/services/session-service", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    requireGuestSession,
  })),
}));

vi.mock("@/server/services/moderation-service", () => ({
  ModerationService: vi.fn().mockImplementation(() => ({
    submitReport,
  })),
}));

describe("POST /api/report", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("returns report details when submission succeeds", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    submitReport.mockResolvedValue({
      id: "report_1",
      matchId: "match_1",
    });

    const { POST } = await import("@/app/api/report/route");
    const response = await POST(
      new Request("http://localhost:3000/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: "match_1",
          reason: "harassment",
          details: "unsafe behavior",
        }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      report: expect.objectContaining({
        id: "report_1",
      }),
    });
    expect(submitReport).toHaveBeenCalledWith("user_1", {
      matchId: "match_1",
      reason: "harassment",
      details: "unsafe behavior",
    });
  });

  it("returns participant errors as 403 json responses", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    submitReport.mockRejectedValue(
      Object.assign(new Error("User is not a participant in this match."), { statusCode: 403 }),
    );

    const { POST } = await import("@/app/api/report/route");
    const response = await POST(
      new Request("http://localhost:3000/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: "match_1",
          reason: "harassment",
        }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "User is not a participant in this match.",
    });
  });
});
