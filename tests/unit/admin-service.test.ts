import { describe, expect, it, vi } from "vitest";
import { AdminService } from "@/server/services/admin-service";

describe("AdminService", () => {
  it("ends an active match and cleans up the voice room", async () => {
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "matched",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
      adminEndMatchAtomically: vi.fn().mockResolvedValue({
        match_id: "match_1",
        ended_at: "2026-04-23T00:03:00.000Z",
      }),
      getAdminMatchById: vi.fn().mockResolvedValue({
        matchId: "match_1",
        sessionId: "session_1",
        status: "ended",
        matchedAt: "2026-04-23T00:00:00.000Z",
        endedAt: "2026-04-23T00:03:00.000Z",
        endReason: "admin_end",
      }),
    };
    const voiceService = {
      cleanupRoom: vi.fn().mockResolvedValue(undefined),
    };

    const service = new AdminService(repository as never, voiceService as never);
    const result = await service.endMatch("match_1", "admin_end");

    expect(repository.adminEndMatchAtomically).toHaveBeenCalledWith("match_1", "admin_end");
    expect(voiceService.cleanupRoom).toHaveBeenCalledWith("session_1");
    expect(result).toEqual(
      expect.objectContaining({
        matchId: "match_1",
        status: "ended",
      }),
    );
  });

  it("does not fail admin match end when room cleanup throws", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "matched",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
      adminEndMatchAtomically: vi.fn().mockResolvedValue({
        match_id: "match_1",
        ended_at: "2026-04-23T00:03:00.000Z",
      }),
      getAdminMatchById: vi.fn().mockResolvedValue({
        matchId: "match_1",
        sessionId: "session_1",
        status: "ended",
        matchedAt: "2026-04-23T00:00:00.000Z",
        endedAt: "2026-04-23T00:03:00.000Z",
        endReason: "admin_end",
      }),
    };
    const voiceService = {
      cleanupRoom: vi.fn().mockRejectedValue(new Error("room cleanup failed")),
    };

    const service = new AdminService(repository as never, voiceService as never);
    const result = await service.endMatch("match_1", "admin_end");

    expect(result).toEqual(expect.objectContaining({ matchId: "match_1" }));
    expect(warnSpy).toHaveBeenCalled();
  });
});
