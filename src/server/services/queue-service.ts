import { AuditService } from "@/server/services/audit-service";
import { PlatformRepository } from "@/server/repositories/platform-repository";
import { normalizeCountryFilters } from "@/server/services/matching";
import type { QueueFilters } from "@/types/domain";

interface MatchClaimResult {
  match_id: string;
  session_id: string;
  matched_at: string;
  user_a_id: string;
  user_b_id: string;
  phase_used: number;
  existing_match: boolean;
}

const QUEUE_REENTRY_COOLDOWN_MS = 5_000;

function createStatusError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function isMissingClaimTieredMatchFunction(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const candidate = error as { code?: string; message?: string };

  return (
    candidate.code === "PGRST202" &&
    typeof candidate.message === "string" &&
    candidate.message.includes("claim_tiered_match")
  );
}

export class QueueService {
  constructor(
    private readonly repository = new PlatformRepository(),
    private readonly audit = new AuditService(),
  ) {}

  private async assertQueueCooldown(userId: string) {
    const latestQueueExit = await this.repository.getLatestQueueExit(userId);

    if (!latestQueueExit?.exited_at) {
      return;
    }

    const elapsedMs = Date.now() - new Date(latestQueueExit.exited_at).getTime();

    if (Number.isNaN(elapsedMs) || elapsedMs >= QUEUE_REENTRY_COOLDOWN_MS) {
      return;
    }

    const remainingSeconds = Math.max(1, Math.ceil((QUEUE_REENTRY_COOLDOWN_MS - elapsedMs) / 1000));
    throw createStatusError(
      `Please wait ${remainingSeconds} second${remainingSeconds === 1 ? "" : "s"} before joining the queue again.`,
      429,
    );
  }

  async getStatus(userId: string) {
    const snapshot = await this.repository.getQueueSnapshot(userId);

    if (snapshot.status === "queued" && !snapshot.activeMatch) {
      await this.attemptMatch(userId);
      return this.repository.getQueueSnapshot(userId);
    }

    return snapshot;
  }

  async joinQueue(userId: string, filters: QueueFilters) {
    const profile = await this.repository.getProfile(userId);
    const snapshot = await this.repository.getQueueSnapshot(userId);

    if (!profile.onboarding_completed_at) {
      throw new Error("Onboarding must be completed before joining the queue.");
    }

    if (snapshot.activeMatch) {
      throw new Error("Cannot join the queue while an active match exists.");
    }

    if (snapshot.status !== "queued") {
      await this.assertQueueCooldown(userId);
    }

    const normalizedFilters = normalizeCountryFilters(filters);
    const { entry: queueEntry, createdNew } = await this.repository.ensureActiveQueueEntry(
      userId,
      normalizedFilters,
    );

    if (createdNew) {
      await this.audit.write({
        actorUserId: userId,
        eventName: "queue_join",
        metadata: {
          queueEntryId: queueEntry.id,
          preferredCountries: normalizedFilters.preferredCountries,
          excludedCountries: normalizedFilters.excludedCountries,
        },
      });
    }

    await this.attemptMatch(userId);

    return this.repository.getQueueSnapshot(userId);
  }

  async leaveQueue(userId: string) {
    const activeQueue = await this.repository.getActiveQueueEntry(userId);

    if (!activeQueue) {
      return this.repository.getQueueSnapshot(userId);
    }

    await this.repository.leaveQueueEntry(activeQueue.id, "user_leave");
    await this.audit.write({
      actorUserId: userId,
      eventName: "queue_leave",
      metadata: {
        queueEntryId: activeQueue.id,
      },
    });

    return this.repository.getQueueSnapshot(userId);
  }

  private async writeLocalMatchCreatedAudit(match: MatchClaimResult) {
    if (match.existing_match) {
      return;
    }

    await this.audit.write({
      actorUserId: match.user_a_id,
      targetUserId: match.user_b_id,
      matchId: match.match_id,
      eventName: "match_created",
      metadata: {
        matchingPhase: match.phase_used,
        matcher: "local_fallback",
      },
    });

    await this.audit.write({
      actorUserId: match.user_b_id,
      targetUserId: match.user_a_id,
      matchId: match.match_id,
      eventName: "match_created",
      metadata: {
        matchingPhase: match.phase_used,
        matcher: "local_fallback",
      },
    });
  }

  async attemptMatch(userId: string) {
    await this.repository.cleanupStaleQueueEntries();

    const activeQueue = await this.repository.getActiveQueueEntry(userId);

    if (!activeQueue) {
      return null;
    }

    try {
      const claimed = await this.repository.claimTieredMatch(userId);

      if (!claimed) {
        return null;
      }

      return claimed;
    } catch (error) {
      if (!isMissingClaimTieredMatchFunction(error)) {
        throw error;
      }

      const claimed = await this.repository.claimTieredMatchLocally(userId);

      if (claimed) {
        await this.writeLocalMatchCreatedAudit(claimed);
      }

      return claimed;
    }
  }
}
