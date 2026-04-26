import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireAdminSession = vi.fn();
const getAdminErrorStatus = vi.fn();
const getReports = vi.fn();

vi.mock("@/server/auth/admin-session", () => ({
  requireAdminSession,
  getAdminErrorStatus,
}));

vi.mock("@/server/services/admin-service", () => ({
  AdminService: vi.fn().mockImplementation(() => ({
    getReports,
  })),
}));

describe("GET /api/admin/reports", () => {
  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it("requires an authenticated admin session", async () => {
    requireAdminSession.mockRejectedValue(new Error("Admin authentication is required."));
    getAdminErrorStatus.mockReturnValue(401);

    const { GET } = await import("@/app/api/admin/reports/route");
    const response = await GET(new Request("http://localhost:3000/api/admin/reports"));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "Admin authentication is required.",
    });
  });

  it("returns reports for an authenticated admin", async () => {
    requireAdminSession.mockResolvedValue(undefined);
    getReports.mockResolvedValue([
      {
        reportId: "report_1",
        matchId: "match_1",
        sessionId: "session_1",
        reporter: {
          userId: "user_a",
          handle: "guest_a",
          countryCode: "US",
          ageConfirmed: true,
          onboardingCompleted: true,
          onboardingCompletedAt: "2026-04-23T00:00:00.000Z",
          createdAt: "2026-04-23T00:00:00.000Z",
        },
        reported: {
          userId: "user_b",
          handle: "guest_b",
          countryCode: "CA",
          ageConfirmed: true,
          onboardingCompleted: true,
          onboardingCompletedAt: "2026-04-23T00:00:00.000Z",
          createdAt: "2026-04-23T00:00:00.000Z",
        },
        reason: "harassment",
        details: "Repeated insults.",
        status: "submitted",
        createdAt: "2026-04-23T00:10:00.000Z",
      },
    ]);

    const { GET } = await import("@/app/api/admin/reports/route");
    const response = await GET(new Request("http://localhost:3000/api/admin/reports"));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      reports: [
        expect.objectContaining({
          reportId: "report_1",
          reason: "harassment",
        }),
      ],
    });
  });
});
