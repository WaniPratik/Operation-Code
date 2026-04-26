import { PlatformRepository } from "@/server/repositories/platform-repository";
import { VoiceService } from "@/server/services/voice-service";

export class MatchService {
  constructor(
    private readonly repository = new PlatformRepository(),
    private readonly voiceService = new VoiceService(),
  ) {}

  async getMatchState(userId: string) {
    return this.repository.getQueueSnapshot(userId);
  }

  async endMatch(userId: string, matchId: string, reason = "user_end") {
    const match = await this.repository.getMatchById(matchId);

    if (match.user_a_id !== userId && match.user_b_id !== userId) {
      throw new Error("User is not a participant in this match.");
    }

    if (match.status === "matched") {
      await this.repository.endMatchAtomically(matchId, userId, reason);

      try {
        await this.voiceService.cleanupRoom(match.session_id);
      } catch (error) {
        console.warn("LiveKit room cleanup failed after match end.", error);
      }
    }

    return this.repository.getQueueSnapshot(userId);
  }
}
