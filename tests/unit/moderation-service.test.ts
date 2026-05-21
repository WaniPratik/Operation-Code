import { describe, expect, it, vi } from "vitest";
import { ModerationService } from "@/server/services/moderation-service";

describe("ModerationService", () => {
  it("submitting a report during a live match ends the session first and writes audit metadata", async () => {
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "matched",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
      createReport: vi.fn().mockResolvedValue({
        id: "report_1",
      }),
    };
    const audit = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const matchService = {
      endMatch: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ModerationService(repository as never, audit as never, matchService as never);

    await service.submitReport("user_a", {
      matchId: "match_1",
      reason: "harassment",
      details: "Escalated during the live call.",
    });

    expect(matchService.endMatch).toHaveBeenCalledWith("user_a", "match_1", "report_submitted");
    expect(repository.createReport).toHaveBeenCalledWith({
      reporterUserId: "user_a",
      reportedUserId: "user_b",
      matchId: "match_1",
      sessionId: "session_1",
      reason: "harassment",
      details: "Escalated during the live call.",
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user_a",
        targetUserId: "user_b",
        matchId: "match_1",
        eventName: "report_submitted",
        metadata: expect.objectContaining({
          reportId: "report_1",
          reason: "harassment",
        }),
      }),
    );
  });

  it("rejects report submissions from non-participants with a 403 status", async () => {
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "ended",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
    };

    const service = new ModerationService(
      repository as never,
      { write: vi.fn() } as never,
      { endMatch: vi.fn() } as never,
    );

    await expect(
      service.submitReport("user_c", {
        matchId: "match_1",
        reason: "other",
        details: "Not part of the match.",
      }),
    ).rejects.toMatchObject({
      message: "User is not a participant in this match.",
      statusCode: 403,
    });
  });

  it("blocking during a live match ends the session first and writes block audit metadata", async () => {
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "matched",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
      createBlock: vi.fn().mockResolvedValue(undefined),
    };
    const audit = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const matchService = {
      endMatch: vi.fn().mockResolvedValue(undefined),
    };

    const service = new ModerationService(repository as never, audit as never, matchService as never);

    await service.blockUser("user_a", {
      matchId: "match_1",
    });

    expect(matchService.endMatch).toHaveBeenCalledWith("user_a", "match_1", "user_blocked");
    expect(repository.createBlock).toHaveBeenCalledWith({
      blockerUserId: "user_a",
      blockedUserId: "user_b",
      matchId: "match_1",
    });
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user_a",
        targetUserId: "user_b",
        matchId: "match_1",
        eventName: "user_blocked",
      }),
    );
    expect(audit.write).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user_a",
        targetUserId: "user_b",
        matchId: "match_1",
        eventName: "block_submitted",
      }),
    );
    expect(audit.write).toHaveBeenCalledTimes(2);
  });

  it("adds a temporary queue cooldown after repeated recent reports", async () => {
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "ended",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
      createReport: vi.fn().mockResolvedValue({
        id: "report_1",
      }),
      countRecentReportsAgainstUser: vi.fn().mockResolvedValue(3),
      setUserCooldown: vi.fn().mockResolvedValue(undefined),
    };
    const audit = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const matchService = {
      endMatch: vi.fn(),
    };

    const service = new ModerationService(repository as never, audit as never, matchService as never);

    await service.submitReport("user_a", {
      matchId: "match_1",
      reason: "harassment",
      details: "Repeated report.",
    });

    expect(repository.countRecentReportsAgainstUser).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_b",
      }),
    );
    expect(repository.setUserCooldown).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "user_b",
        reason: "repeated_reports",
      }),
    );
  });

  it("rejects blocks from non-participants with a 403 status", async () => {
    const repository = {
      getMatchById: vi.fn().mockResolvedValue({
        id: "match_1",
        session_id: "session_1",
        status: "ended",
        user_a_id: "user_a",
        user_b_id: "user_b",
      }),
    };

    const service = new ModerationService(
      repository as never,
      { write: vi.fn() } as never,
      { endMatch: vi.fn() } as never,
    );

    await expect(service.blockUser("user_c", { matchId: "match_1" })).rejects.toMatchObject({
      message: "User is not a participant in this match.",
      statusCode: 403,
    });
  });
});
