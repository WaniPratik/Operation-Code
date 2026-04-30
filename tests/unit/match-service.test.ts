import { describe, expect, it, vi } from "vitest";
import { MatchService } from "@/server/services/match-service";

describe("MatchService", () => {
  it("ends the match and cleans up the voice room", async () => {
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "matched",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
      endMatchAtomically: vi.fn().mockResolvedValue({
        match_id: "match_1",
        ended_at: "2026-04-23T00:00:10.000Z",
      }),
      getQueueSnapshot: vi.fn().mockResolvedValue({
        status: "idle",
        queueEntryId: null,
        enteredAt: null,
        filters: {
          preferredCountries: [],
          excludedCountries: [],
        },
        activeMatch: null,
        recentMatch: null,
      }),
    };
    const voiceService = {
      cleanupRoom: vi.fn().mockResolvedValue(undefined),
    };

    const service = new MatchService(repository as never, voiceService as never);
    const result = await service.endMatch("user_a", "match_1", "user_end");

    expect(repository.endMatchAtomically).toHaveBeenCalledWith("match_1", "user_a", "user_end");
    expect(voiceService.cleanupRoom).toHaveBeenCalledWith("session_1");
    expect(result.status).toBe("idle");
  });

  it("rejects users who are not participants with a 403 status", async () => {
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "matched",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
    };

    const service = new MatchService(repository as never, { cleanupRoom: vi.fn() } as never);

    await expect(service.endMatch("user_c", "match_1")).rejects.toMatchObject({
      message: "User is not a participant in this match.",
      statusCode: 403,
    });
  });

  it("does not fail match end if room cleanup throws", async () => {
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "matched",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
      endMatchAtomically: vi.fn().mockResolvedValue({
        match_id: "match_1",
        ended_at: "2026-04-23T00:00:10.000Z",
      }),
      getQueueSnapshot: vi.fn().mockResolvedValue({
        status: "idle",
        queueEntryId: null,
        enteredAt: null,
        filters: {
          preferredCountries: [],
          excludedCountries: [],
        },
        activeMatch: null,
        recentMatch: null,
      }),
    };
    const voiceService = {
      cleanupRoom: vi.fn().mockRejectedValue(new Error("room cleanup failed")),
    };
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    const service = new MatchService(repository as never, voiceService as never);
    const result = await service.endMatch("user_a", "match_1", "user_end");

    expect(result.status).toBe("idle");
    expect(warnSpy).toHaveBeenCalled();
  });
});
