import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ensureGuestSession = vi.fn();
const applyGuestSessionCookie = vi.fn((response) => response);

vi.mock("@/server/services/session-service", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    ensureGuestSession,
    requireGuestSession: vi.fn(),
  })),
}));

vi.mock("@/server/auth/session-cookie", () => ({
  applyGuestSessionCookie,
}));

describe("POST /api/session", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns the created guest session and applies the cookie", async () => {
    ensureGuestSession.mockResolvedValue({
      session: {
        userId: "user_1",
        handle: "guest_abcd1234",
        ageConfirmed: false,
        onboardingCompleted: false,
        countryCode: null,
        fingerprintHash: null,
        createdAt: "2026-04-22T00:00:00.000Z",
        lastSeenAt: "2026-04-22T00:00:00.000Z",
      },
      cookieToken: "plain_token_1",
    });

    const { POST } = await import("@/app/api/session/route");
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      session: expect.objectContaining({
        userId: "user_1",
        handle: "guest_abcd1234",
      }),
    });
    expect(applyGuestSessionCookie).toHaveBeenCalledWith(response, "plain_token_1");
  });

  it("returns the real backend error details during local development", async () => {
    ensureGuestSession.mockRejectedValue({
      message: "Invalid path specified in request URL",
      code: "PGRST125",
      details: null,
      hint: null,
    });

    const { POST } = await import("@/app/api/session/route");
    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Invalid path specified in request URL (code: PGRST125)",
    });
  });
});
