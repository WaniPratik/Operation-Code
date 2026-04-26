import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceService } from "@/server/services/voice-service";

const originalLiveKitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL;

describe("VoiceService", () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_LIVEKIT_URL = "wss://example.livekit.cloud";
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_LIVEKIT_URL = originalLiveKitUrl;
    vi.restoreAllMocks();
  });

  it("issues room access for the current active match only", async () => {
    const repository = {
      getQueueSnapshot: vi.fn().mockResolvedValue({
        status: "matched",
        activeMatch: {
          matchId: "match_1",
          sessionId: "session_1",
          status: "matched",
          matchedAt: "2026-04-23T00:00:00.000Z",
          endedAt: null,
          counterpart: {
            userId: "user_b",
            handle: "guest_b",
            countryCode: "CA",
          },
          preConnectionSeconds: 2,
        },
      }),
      getProfile: vi.fn().mockResolvedValue({
        anonymous_handle: "guest_a",
      }),
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "matched",
        matched_at: "2026-04-23T00:00:00.000Z",
        ended_at: null,
        end_reason: null,
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
    };

    const createAccessToken = vi.fn().mockResolvedValue("jwt_token");
    const service = new VoiceService(repository as never, {
      createAccessToken,
      deleteRoom: vi.fn(),
    });

    const result = await service.issueActiveMatchAccess("user_a");

    expect(result).toEqual({
      serverUrl: "wss://example.livekit.cloud",
      roomName: "session_1",
      token: "jwt_token",
      participantIdentity: "user:user_a",
      participantName: "guest_a",
      matchId: "match_1",
    });
    expect(createAccessToken).toHaveBeenCalledWith({
      roomName: "session_1",
      participantIdentity: "user:user_a",
      participantName: "guest_a",
      metadata: {
        userId: "user_a",
        matchId: "match_1",
        sessionId: "session_1",
      },
    });
  });

  it("rejects access when there is no active match", async () => {
    const repository = {
      getQueueSnapshot: vi.fn().mockResolvedValue({
        status: "idle",
        activeMatch: null,
      }),
      getProfile: vi.fn(),
      getMatchById: vi.fn(),
    };

    const service = new VoiceService(repository as never, {
      createAccessToken: vi.fn(),
      deleteRoom: vi.fn(),
    });

    await expect(service.issueActiveMatchAccess("user_a")).rejects.toThrow(
      "Voice room is only available for an active match.",
    );
  });

  it("rejects access when the guest session user is not a participant in the matched room", async () => {
    const repository = {
      getQueueSnapshot: vi.fn().mockResolvedValue({
        status: "matched",
        activeMatch: {
          matchId: "match_1",
          sessionId: "session_1",
          status: "matched",
          matchedAt: "2026-04-23T00:00:00.000Z",
          endedAt: null,
          counterpart: {
            userId: "user_b",
            handle: "guest_b",
            countryCode: "CA",
          },
          preConnectionSeconds: 2,
        },
      }),
      getProfile: vi.fn().mockResolvedValue({
        anonymous_handle: "guest_a",
      }),
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "matched",
        matched_at: "2026-04-23T00:00:00.000Z",
        ended_at: null,
        end_reason: null,
        user_a_id: "user_x",
        user_b_id: "user_y",
      }),
    };

    const service = new VoiceService(repository as never, {
      createAccessToken: vi.fn(),
      deleteRoom: vi.fn(),
    });

    await expect(service.issueActiveMatchAccess("user_a")).rejects.toMatchObject({
      message:
        "This live session is no longer available for your guest session. Return to the queue and try again.",
      statusCode: 403,
    });
  });

  it("ignores a missing room during cleanup", async () => {
    const service = new VoiceService({} as never, {
      createAccessToken: vi.fn(),
      deleteRoom: vi.fn().mockRejectedValue({ code: "not_found" }),
    });

    await expect(service.cleanupRoom("session_1")).resolves.toBeUndefined();
  });
});
