import { afterEach, describe, expect, it, vi } from "vitest";

const requireGuestSession = vi.fn();
const completeOnboarding = vi.fn();

vi.mock("@/server/services/session-service", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    requireGuestSession,
    completeOnboarding,
  })),
}));

describe("POST /api/session/onboarding", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("returns the updated session when a valid guest session exists without requiring country input", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_1" });
    completeOnboarding.mockResolvedValue({
      userId: "user_1",
      handle: "guest_abcd1234",
      ageConfirmed: true,
      onboardingCompleted: true,
      countryCode: "US",
      fingerprintHash: null,
      createdAt: "2026-04-22T00:00:00.000Z",
      lastSeenAt: "2026-04-22T00:00:00.000Z",
    });

    const { POST } = await import("@/app/api/session/onboarding/route");
    const response = await POST(
      new Request("http://localhost:3000/api/session/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ageConfirmed: true }),
      }),
    );

    expect(response.status).toBe(200);
    expect(completeOnboarding).toHaveBeenCalledWith("user_1");
    await expect(response.json()).resolves.toEqual({
      session: expect.objectContaining({
        userId: "user_1",
        onboardingCompleted: true,
        countryCode: "US",
      }),
    });
  });

  it("returns a JSON 400 when no guest session exists", async () => {
    requireGuestSession.mockRejectedValue(new Error("Guest session is required."));

    const { POST } = await import("@/app/api/session/onboarding/route");
    const response = await POST(
      new Request("http://localhost:3000/api/session/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ageConfirmed: true }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "Guest session is required.",
    });
  });
});
