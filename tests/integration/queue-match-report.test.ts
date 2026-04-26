import { describe, expect, it } from "vitest";
import { QueueService } from "@/server/services/queue-service";
import { MatchService } from "@/server/services/match-service";
import { ModerationService } from "@/server/services/moderation-service";

class InMemoryPlatformRepository {
  users = new Map([
    [
      "user_a",
      {
        anonymous_handle: "guest_a",
        age_attested_over_18: true,
        onboarding_completed_at: "2026-04-14T00:00:00.000Z",
        country_code: "US",
        device_fingerprint_hash: "fp_a",
        created_at: "2026-04-14T00:00:00.000Z",
      },
    ],
    [
      "user_b",
      {
        anonymous_handle: "guest_b",
        age_attested_over_18: true,
        onboarding_completed_at: "2026-04-14T00:00:00.000Z",
        country_code: "CA",
        device_fingerprint_hash: "fp_b",
        created_at: "2026-04-14T00:00:00.000Z",
      },
    ],
  ]);

  queueEntries: Array<{
    id: string;
    user_id: string;
    status: "queued" | "matched" | "left";
    entered_at: string;
    preferred_country_codes: string[];
    excluded_country_codes: string[];
  }> = [];

  matches: Array<{
    id: string;
    session_id: string;
    status: "matched" | "ended";
    matched_at: string;
    ended_at: string | null;
    end_reason: string | null;
    user_a_id: string;
    user_b_id: string;
    user_a_profile: { anonymous_handle: string; country_code: string | null };
    user_b_profile: { anonymous_handle: string; country_code: string | null };
  }> = [];

  reports: Array<{ id: string; match_id: string; reporter_user_id: string; reported_user_id: string; reason: string; details: string; status: string; created_at: string }> = [];
  blocks: Array<{ blocker_user_id: string; blocked_user_id: string; match_id: string }> = [];
  activeParticipants = new Set<string>();
  dbAuditEvents: string[] = [];

  async getProfile(userId: string) {
    return {
      user_id: userId,
      ...this.users.get(userId)!,
    };
  }

  async getActiveQueueEntry(userId: string) {
    return this.queueEntries.find((entry) => entry.user_id === userId && entry.status === "queued") ?? null;
  }

  async createQueueEntry(userId: string, filters: { preferredCountries: string[]; excludedCountries: string[] }) {
    const entry = {
      id: `queue_${this.queueEntries.length + 1}`,
      user_id: userId,
      status: "queued" as const,
      entered_at: new Date().toISOString(),
      preferred_country_codes: filters.preferredCountries,
      excluded_country_codes: filters.excludedCountries,
    };
    this.queueEntries.push(entry);
    return entry;
  }

  async ensureActiveQueueEntry(userId: string, filters: { preferredCountries: string[]; excludedCountries: string[] }) {
    const existing = await this.getActiveQueueEntry(userId);

    if (existing) {
      return {
        entry: existing,
        createdNew: false,
      };
    }

    return {
      entry: await this.createQueueEntry(userId, filters),
      createdNew: true,
    };
  }

  async cleanupStaleQueueEntries() {
    return {
      staleActiveMatchCount: 0,
      staleInactiveSessionCount: 0,
    };
  }

  async getLatestQueueExit() {
    return null;
  }

  async leaveQueueEntry(queueEntryId: string) {
    const entry = this.queueEntries.find((item) => item.id === queueEntryId);
    if (entry) {
      entry.status = "left";
    }
  }

  async claimTieredMatch(userId: string) {
    if (this.activeParticipants.has(userId)) {
      const existingMatch = this.matches.find(
        (match) =>
          match.status === "matched" &&
          (match.user_a_id === userId || match.user_b_id === userId),
      );

      return existingMatch
        ? {
            match_id: existingMatch.id,
            session_id: existingMatch.session_id,
            matched_at: existingMatch.matched_at,
            user_a_id: existingMatch.user_a_id,
            user_b_id: existingMatch.user_b_id,
            phase_used: 0,
            existing_match: true,
          }
        : null;
    }

    const requesterQueue = this.queueEntries.find(
      (entry) => entry.user_id === userId && entry.status === "queued",
    );

    if (!requesterQueue) {
      return null;
    }

    const waitSeconds = Math.floor(
      (Date.now() - Date.parse(requesterQueue.entered_at)) / 1000,
    );

    const recentMatchUserIds =
      waitSeconds < 3
        ? this.matches
            .slice(-5)
            .map((match) =>
              match.user_a_id === userId ? match.user_b_id : match.user_a_id,
            )
        : [];

    const candidate = this.queueEntries.find((entry) => {
      if (entry.user_id === userId || entry.status !== "queued") {
        return false;
      }

      if (this.activeParticipants.has(entry.user_id)) {
        return false;
      }

      if (
        this.blocks.some(
          (block) =>
            (block.blocker_user_id === userId && block.blocked_user_id === entry.user_id) ||
            (block.blocker_user_id === entry.user_id && block.blocked_user_id === userId),
        )
      ) {
        return false;
      }

      const requesterCountry = this.users.get(userId)?.country_code ?? null;
      const candidateCountry = this.users.get(entry.user_id)?.country_code ?? null;

      if (candidateCountry && requesterQueue.excluded_country_codes.includes(candidateCountry)) {
        return false;
      }

      if (requesterCountry && entry.excluded_country_codes.includes(requesterCountry)) {
        return false;
      }

      if (waitSeconds < 3) {
        if (
          requesterQueue.preferred_country_codes.length > 0 &&
          (!candidateCountry ||
            !requesterQueue.preferred_country_codes.includes(candidateCountry))
        ) {
          return false;
        }

        if (
          requesterCountry &&
          entry.preferred_country_codes.length > 0 &&
          !entry.preferred_country_codes.includes(requesterCountry)
        ) {
          return false;
        }

        if (recentMatchUserIds.includes(entry.user_id)) {
          return false;
        }
      }

      return true;
    });

    if (!candidate) {
      return null;
    }

    this.activeParticipants.add(userId);
    this.activeParticipants.add(candidate.user_id);

    const match = {
      id: `match_${this.matches.length + 1}`,
      session_id: `session_${this.matches.length + 1}`,
      status: "matched" as const,
      matched_at: new Date().toISOString(),
      ended_at: null,
      end_reason: null,
      user_a_id: userId,
      user_b_id: candidate.user_id,
      user_a_profile: {
        anonymous_handle: this.users.get(userId)!.anonymous_handle,
        country_code: this.users.get(userId)!.country_code,
      },
      user_b_profile: {
        anonymous_handle: this.users.get(candidate.user_id)!.anonymous_handle,
        country_code: this.users.get(candidate.user_id)!.country_code,
      },
    };

    this.matches.push(match);
    requesterQueue.status = "matched";
    candidate.status = "matched";
    this.dbAuditEvents.push("match_created");

    return {
      match_id: match.id,
      session_id: match.session_id,
      matched_at: match.matched_at,
      user_a_id: match.user_a_id,
      user_b_id: match.user_b_id,
      phase_used: waitSeconds < 3 ? 1 : waitSeconds < 6 ? 2 : 3,
      existing_match: false,
    };
  }

  async getLatestMatchForUser(userId: string) {
    return this.matches.find((match) => match.user_a_id === userId || match.user_b_id === userId) ?? null;
  }

  async getMatchById(matchId: string) {
    return this.matches.find((match) => match.id === matchId)!;
  }

  async endMatchAtomically(matchId: string, actorUserId: string, reason: string) {
    const match = this.matches.find((item) => item.id === matchId)!;
    match.status = "ended";
    match.end_reason = reason;
    match.ended_at = new Date().toISOString();
    this.activeParticipants.delete(match.user_a_id);
    this.activeParticipants.delete(match.user_b_id);
    this.dbAuditEvents.push("match_ended");
    return {
      match_id: match.id,
      ended_at: match.ended_at,
    };
  }

  async createReport(input: { reporterUserId: string; reportedUserId: string; matchId: string; sessionId: string; reason: string; details: string }) {
    const report = {
      id: `report_${this.reports.length + 1}`,
      match_id: input.matchId,
      reporter_user_id: input.reporterUserId,
      reported_user_id: input.reportedUserId,
      reason: input.reason,
      details: input.details,
      status: "submitted",
      created_at: new Date().toISOString(),
    };
    this.reports.push(report);
    return report;
  }

  async createBlock(input: { blockerUserId: string; blockedUserId: string; matchId: string }) {
    this.blocks.push({
      blocker_user_id: input.blockerUserId,
      blocked_user_id: input.blockedUserId,
      match_id: input.matchId,
    });
  }

  async writeAuditEvent() {}

  async getQueueSnapshot(userId: string) {
    const activeQueue = await this.getActiveQueueEntry(userId);
    const latestMatch = await this.getLatestMatchForUser(userId);
    const counterpart =
      latestMatch && latestMatch.user_a_id === userId
        ? latestMatch.user_b_profile
        : latestMatch?.user_a_profile;

    return {
      status: latestMatch?.status === "matched" ? "matched" : activeQueue ? "queued" : "idle",
      queueEntryId: activeQueue?.id ?? null,
      enteredAt: activeQueue?.entered_at ?? null,
      filters: {
        preferredCountries: activeQueue?.preferred_country_codes ?? [],
        excludedCountries: activeQueue?.excluded_country_codes ?? [],
      },
      activeMatch:
        latestMatch?.status === "matched"
          ? {
              matchId: latestMatch.id,
              sessionId: latestMatch.session_id,
              status: latestMatch.status,
              matchedAt: latestMatch.matched_at,
              endedAt: latestMatch.ended_at,
              counterpart: {
                userId: latestMatch.user_a_id === userId ? latestMatch.user_b_id : latestMatch.user_a_id,
                handle: counterpart?.anonymous_handle ?? "unknown",
                countryCode: counterpart?.country_code ?? null,
              },
              preConnectionSeconds: 2,
            }
          : null,
      recentMatch:
        latestMatch
          ? {
              matchId: latestMatch.id,
              sessionId: latestMatch.session_id,
              status: latestMatch.status,
              matchedAt: latestMatch.matched_at,
              endedAt: latestMatch.ended_at,
              counterpart: {
                userId: latestMatch.user_a_id === userId ? latestMatch.user_b_id : latestMatch.user_a_id,
                handle: counterpart?.anonymous_handle ?? "unknown",
                countryCode: counterpart?.country_code ?? null,
              },
              preConnectionSeconds: 2,
            }
          : null,
    };
  }
}

describe("queue -> match -> end -> report flow", () => {
  it("submitting a report during a live match ends the session immediately and persists the moderation record", async () => {
    const repository = new InMemoryPlatformRepository();
    const auditEvents: string[] = [];
    const audit = {
      write: async (input: { eventName: string }) => {
        auditEvents.push(input.eventName);
      },
    };

    const queueService = new QueueService(repository as never, audit as never);
    const matchService = new MatchService(repository as never);
    const moderationService = new ModerationService(repository as never, audit as never, matchService as never);

    await queueService.joinQueue("user_a", {
      preferredCountries: ["CA"],
      excludedCountries: [],
    });

    const queueAfterB = await queueService.joinQueue("user_b", {
      preferredCountries: ["US"],
      excludedCountries: [],
    });

    expect(queueAfterB.activeMatch?.counterpart.handle).toBe("guest_a");

    await moderationService.submitReport("user_a", {
      matchId: queueAfterB.activeMatch!.matchId,
      reason: "harassment",
      details: "Escalated in test flow",
    });

    expect(repository.matches[0]?.status).toBe("ended");
    expect(repository.matches[0]?.end_reason).toBe("report_submitted");
    expect(repository.reports).toHaveLength(1);
    expect(repository.dbAuditEvents).toContain("match_created");
    expect(repository.dbAuditEvents).toContain("match_ended");
    expect(auditEvents).toContain("queue_join");
    expect(auditEvents).toContain("report_submitted");
  });

  it("blocking during a live match ends the session immediately and persists the block record", async () => {
    const repository = new InMemoryPlatformRepository();
    const auditEvents: string[] = [];
    const audit = {
      write: async (input: { eventName: string }) => {
        auditEvents.push(input.eventName);
      },
    };

    const queueService = new QueueService(repository as never, audit as never);
    const matchService = new MatchService(repository as never);
    const moderationService = new ModerationService(repository as never, audit as never, matchService as never);

    await queueService.joinQueue("user_a", {
      preferredCountries: ["CA"],
      excludedCountries: [],
    });
    const queueAfterB = await queueService.joinQueue("user_b", {
      preferredCountries: ["US"],
      excludedCountries: [],
    });

    await moderationService.blockUser("user_a", {
      matchId: queueAfterB.activeMatch!.matchId,
    });

    expect(repository.matches[0]?.status).toBe("ended");
    expect(repository.matches[0]?.end_reason).toBe("user_blocked");
    expect(repository.blocks).toHaveLength(1);
    expect(repository.dbAuditEvents).toContain("match_ended");
    expect(auditEvents).toContain("user_blocked");
  });

  it("keeps repeated polling idempotent once a match exists", async () => {
    const repository = new InMemoryPlatformRepository();
    const queueService = new QueueService(repository as never, { write: async () => {} } as never);

    await queueService.joinQueue("user_a", {
      preferredCountries: ["CA"],
      excludedCountries: [],
    });
    await queueService.joinQueue("user_b", {
      preferredCountries: ["US"],
      excludedCountries: [],
    });

    const first = await queueService.getStatus("user_a");
    const second = await queueService.getStatus("user_a");

    expect(first.activeMatch?.matchId).toBe(second.activeMatch?.matchId);
    expect(repository.matches).toHaveLength(1);
  });

  it("does not create duplicate queue entries for repeated joins", async () => {
    const repository = new InMemoryPlatformRepository();
    const audit = {
      write: async () => {},
    };
    const queueService = new QueueService(repository as never, audit as never);

    await queueService.joinQueue("user_a", {
      preferredCountries: ["CA"],
      excludedCountries: [],
    });
    await queueService.joinQueue("user_a", {
      preferredCountries: ["CA"],
      excludedCountries: [],
    });

    expect(repository.queueEntries.filter((entry) => entry.user_id === "user_a")).toHaveLength(1);
  });

  it("prevents two users from both claiming the same candidate concurrently", async () => {
    const repository = new InMemoryPlatformRepository();

    repository.users.set("user_c", {
      anonymous_handle: "guest_c",
      age_attested_over_18: true,
      onboarding_completed_at: "2026-04-14T00:00:00.000Z",
      country_code: "US",
      device_fingerprint_hash: "fp_c",
      created_at: "2026-04-14T00:00:00.000Z",
    });

    repository.queueEntries.push(
      {
        id: "queue_a",
        user_id: "user_a",
        status: "queued",
        entered_at: new Date().toISOString(),
        preferred_country_codes: ["CA"],
        excluded_country_codes: [],
      },
      {
        id: "queue_b",
        user_id: "user_b",
        status: "queued",
        entered_at: new Date().toISOString(),
        preferred_country_codes: ["US"],
        excluded_country_codes: [],
      },
      {
        id: "queue_c",
        user_id: "user_c",
        status: "queued",
        entered_at: new Date().toISOString(),
        preferred_country_codes: ["CA"],
        excluded_country_codes: [],
      },
    );

    const [claimA, claimC] = await Promise.all([
      repository.claimTieredMatch("user_a"),
      repository.claimTieredMatch("user_c"),
    ]);

    const matchedUsers = repository.matches.flatMap((match) => [match.user_a_id, match.user_b_id]);
    const userBClaims = matchedUsers.filter((userId) => userId === "user_b");

    expect(userBClaims).toHaveLength(1);
    expect([claimA?.user_b_id, claimA?.user_a_id, claimC?.user_b_id, claimC?.user_a_id].filter(Boolean)).toContain("user_b");
  });

  it("keeps one active participant record per user", async () => {
    const repository = new InMemoryPlatformRepository();
    const queueService = new QueueService(repository as never, { write: async () => {} } as never);

    await queueService.joinQueue("user_a", {
      preferredCountries: ["CA"],
      excludedCountries: [],
    });
    await queueService.joinQueue("user_b", {
      preferredCountries: ["US"],
      excludedCountries: [],
    });

    await expect(
      repository.claimTieredMatch("user_a"),
    ).resolves.toMatchObject({
      existing_match: true,
    });
  });

  it("does not leave partial state behind when claiming fails before commit", async () => {
    class FailingClaimRepository extends InMemoryPlatformRepository {
      override async claimTieredMatch(_userId: string): Promise<null> {
        throw new Error("claim failed");
      }
    }

    const repository = new FailingClaimRepository();
    const queueService = new QueueService(repository as never, { write: async () => {} } as never);

    await repository.createQueueEntry("user_a", {
      preferredCountries: ["CA"],
      excludedCountries: [],
    });

    await expect(
      queueService.attemptMatch("user_a"),
    ).rejects.toThrow("claim failed");

    expect(repository.matches).toHaveLength(0);
    expect(repository.activeParticipants.size).toBe(0);
    expect(repository.queueEntries[0]?.status).toBe("queued");
  });
});
