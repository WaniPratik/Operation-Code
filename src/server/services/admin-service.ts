import { PlatformRepository } from "@/server/repositories/platform-repository";
import { VoiceService } from "@/server/services/voice-service";
import type { AdminQuery } from "@/types/domain";

export class AdminService {
  constructor(
    private readonly repository = new PlatformRepository(),
    private readonly voiceService = new VoiceService(),
  ) {}

  getReports(query: AdminQuery) {
    return this.repository.getAdminReports(query);
  }

  getMatches(query: AdminQuery) {
    return this.repository.getAdminMatches(query);
  }

  getUsers(query: AdminQuery) {
    return this.repository.getAdminUsers(query);
  }

  getBlocks(query: AdminQuery) {
    return this.repository.getAdminBlocks(query);
  }

  getAuditLogs(query: AdminQuery) {
    return this.repository.getAdminAuditLogs(query);
  }

  getFeedback(query: AdminQuery) {
    return this.repository.getAdminFeedback(query);
  }

  getAnalyticsSummary(query: AdminQuery) {
    return this.repository.getAdminAnalyticsSummary(query);
  }

  async endMatch(matchId: string, reason = "admin_end") {
    const match = await this.repository.getMatchById(matchId);

    if (match.status === "matched") {
      await this.repository.adminEndMatchAtomically(matchId, reason);

      try {
        await this.voiceService.cleanupRoom(match.session_id);
      } catch (error) {
        console.warn("LiveKit room cleanup failed after admin ended a match.", error);
      }
    }

    return this.repository.getAdminMatchById(matchId);
  }
}
