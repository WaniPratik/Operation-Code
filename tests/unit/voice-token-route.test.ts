import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const requireGuestSession = vi.fn();
const issueActiveMatchAccess = vi.fn();

vi.mock("@/server/services/session-service", () => ({
  SessionService: vi.fn().mockImplementation(() => ({
    requireGuestSession,
  })),
}));

vi.mock("@/server/services/voice-service", () => ({
  VoiceService: vi.fn().mockImplementation(() => ({
    issueActiveMatchAccess,
  })),
}));

describe("POST /api/voice/token", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "development";
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("returns room access for an authenticated matched user", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_a" });
    issueActiveMatchAccess.mockResolvedValue({
      serverUrl: "wss://example.livekit.cloud",
      roomName: "session_1",
      token: "jwt_token",
      participantIdentity: "user:user_a",
      participantName: "guest_a",
      matchId: "match_1",
    });

    const { POST } = await import("@/app/api/voice/token/route");
    const response = await POST();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      voice: expect.objectContaining({
        roomName: "session_1",
        token: "jwt_token",
      }),
    });
  });

  it("returns a forbidden error when the guest session user is not allowed in the room", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_a" });
    issueActiveMatchAccess.mockRejectedValue({
      message:
        "This live session is no longer available for your guest session. Return to the queue and try again.",
      statusCode: 403,
    });

    const { POST } = await import("@/app/api/voice/token/route");
    const response = await POST();

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error:
        "This live session is no longer available for your guest session. Return to the queue and try again.",
    });
  });

  it("returns readable local setup errors", async () => {
    requireGuestSession.mockResolvedValue({ userId: "user_a" });
    issueActiveMatchAccess.mockRejectedValue({
      message: "Missing required environment variable: NEXT_PUBLIC_LIVEKIT_URL",
    });

    const { POST } = await import("@/app/api/voice/token/route");
    const response = await POST();

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Missing required environment variable: NEXT_PUBLIC_LIVEKIT_URL",
    });
  });
});
