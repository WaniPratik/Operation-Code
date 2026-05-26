import { AuditService } from "@/server/services/audit-service";
import { PlatformRepository } from "@/server/repositories/platform-repository";
import { MatchService } from "@/server/services/match-service";
import type { ReportReason } from "@/types/domain";

function createStatusError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export class ModerationService {
  constructor(
    private readonly repository = new PlatformRepository(),
    private readonly audit = new AuditService(),
    private readonly matchService = new MatchService(),
  ) {}

  async submitReport(userId: string, input: { matchId: string; reason: ReportReason; details: string }) {
    const match = await this.repository.getMatchById(input.matchId);

    if (match.user_a_id !== userId && match.user_b_id !== userId) {
      throw createStatusError("User is not a participant in this match.", 403);
    }

    const targetUserId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;

    if (match.status === "matched") {
      await this.matchService.endMatch(userId, input.matchId, "report_submitted");
    }

    const report = await this.repository.createReport({
      reporterUserId: userId,
      reportedUserId: targetUserId,
      matchId: match.id,
      sessionId: match.session_id,
      reason: input.reason,
      details: input.details,
    });

    if (!report) {
      throw new Error("Report submission did not return a saved report.");
    }

    await this.audit.write({
      actorUserId: userId,
      targetUserId,
      matchId: match.id,
      eventName: "report_submitted",
      metadata: {
        reportId: report.id,
        reason: input.reason,
      },
    });

    if ("countRecentReportsAgainstUser" in this.repository && "setUserCooldown" in this.repository) {
      const recentReportCount = await this.repository.countRecentReportsAgainstUser({
        userId: targetUserId,
        since: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
      });

      if (recentReportCount >= 3) {
        await this.repository.setUserCooldown({
          userId: targetUserId,
          reason: "repeated_reports",
          expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        });
      }
    }

    return report;
  }

  async blockUser(userId: string, input: { matchId: string }) {
    const match = await this.repository.getMatchById(input.matchId);

    if (match.user_a_id !== userId && match.user_b_id !== userId) {
      throw createStatusError("User is not a participant in this match.", 403);
    }

    const targetUserId = match.user_a_id === userId ? match.user_b_id : match.user_a_id;

    if (match.status === "matched") {
      await this.matchService.endMatch(userId, input.matchId, "user_blocked");
    }

    await this.repository.createBlock({
      blockerUserId: userId,
      blockedUserId: targetUserId,
      matchId: match.id,
    });

    await this.audit.write({
      actorUserId: userId,
      targetUserId,
      matchId: match.id,
      eventName: "user_blocked",
      metadata: {
        cooldownLoggedOnly: true,
      },
    });
    await this.audit.write({
      actorUserId: userId,
      targetUserId,
      matchId: match.id,
      eventName: "block_submitted",
      metadata: {
        cooldownLoggedOnly: true,
      },
    });
  }
}
