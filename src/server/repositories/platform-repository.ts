import { createServiceSupabaseClient } from "@/server/supabase/service";
import type { AdminBlockView, AdminMatchView, AdminQuery, AdminReportView, AdminUserView, AnalyticsSummaryView, AuditEventView, FeedbackType, FeedbackView, MatchView, QueueFilters, QueueStatusView, ReportView } from "@/types/domain";

type SupabaseClient = ReturnType<typeof createServiceSupabaseClient>;

interface SessionRow {
  id: string;
  user_id: string;
  token_hash: string;
  fingerprint_hash: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  expires_at: string | null;
  user: {
    id: string;
    created_at: string;
    last_seen_at: string;
    deleted_at: string | null;
  } | null;
  profile: {
    anonymous_handle: string;
    age_attested_over_18: boolean;
    onboarding_completed_at: string | null;
    country_code: string | null;
    device_fingerprint_hash: string | null;
  } | null;
}

export interface ActiveMatchRecord {
  id: string;
  session_id: string;
  status: "matched" | "ended";
  matched_at: string;
  ended_at: string | null;
  end_reason: string | null;
  user_a_id: string;
  user_b_id: string;
  user_a_profile: { anonymous_handle: string; country_code: string | null } | null;
  user_b_profile: { anonymous_handle: string; country_code: string | null } | null;
}

interface ClaimedMatchRow {
  match_id: string;
  session_id: string;
  matched_at: string;
  user_a_id: string;
  user_b_id: string;
  phase_used: number;
  existing_match: boolean;
}

const STALE_QUEUE_MAX_AGE_MS = 5 * 60 * 1000;

export class PlatformRepository {
  private supabaseClient: SupabaseClient | null = null;

  constructor(private readonly createSupabaseClient: () => SupabaseClient = createServiceSupabaseClient) {}

  private get supabase() {
    if (this.supabaseClient === null) {
      this.supabaseClient = this.createSupabaseClient();
    }

    return this.supabaseClient;
  }

  private async getProfilesByUserIds(userIds: string[]) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (uniqueUserIds.length === 0) {
      return new Map<string, { anonymous_handle: string; country_code: string | null }>();
    }

    const { data, error } = await this.supabase
      .from("anonymous_profiles")
      .select("user_id, anonymous_handle, country_code")
      .in("user_id", uniqueUserIds)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    return new Map(
      (data ?? []).map((row) => [
        row.user_id as string,
        {
          anonymous_handle: row.anonymous_handle as string,
          country_code: row.country_code as string | null,
        },
      ]),
    );
  }

  private async hydrateMatchProfiles(match: {
    id: string;
    session_id: string;
    status: "matched" | "ended";
    matched_at: string;
    ended_at: string | null;
    end_reason: string | null;
    user_a_id: string;
    user_b_id: string;
  }): Promise<ActiveMatchRecord> {
    const profiles = await this.getProfilesByUserIds([match.user_a_id, match.user_b_id]);

    return {
      ...match,
      user_a_profile: profiles.get(match.user_a_id) ?? null,
      user_b_profile: profiles.get(match.user_b_id) ?? null,
    };
  }

  private getTieredMatchPhase(waitSeconds: number) {
    if (waitSeconds < 3) {
      return 1;
    }

    if (waitSeconds < 6) {
      return 2;
    }

    return 3;
  }

  private mapExistingMatchClaim(match: ActiveMatchRecord): ClaimedMatchRow {
    return {
      match_id: match.id,
      session_id: match.session_id,
      matched_at: match.matched_at,
      user_a_id: match.user_a_id,
      user_b_id: match.user_b_id,
      phase_used: 0,
      existing_match: true,
    };
  }

  private isQueueCandidateFresh(lastSeenAt: string | null) {
    if (!lastSeenAt) {
      return false;
    }

    const lastSeenTime = new Date(lastSeenAt).getTime();

    if (Number.isNaN(lastSeenTime)) {
      return false;
    }

    return Date.now() - lastSeenTime <= STALE_QUEUE_MAX_AGE_MS;
  }

  private isActiveQueueUniqueViolation(error: unknown) {
    return Boolean(
      error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code?: string }).code === "23505" &&
        "message" in error &&
        typeof (error as { message?: string }).message === "string" &&
        (error as { message: string }).message.includes("queue_entries_active_user_idx"),
    );
  }

  private async leaveQueuedEntriesForUsers(userIds: string[], reason: string) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (uniqueUserIds.length === 0) {
      return 0;
    }

    const timestamp = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("queue_entries")
      .update({
        status: "left",
        exited_at: timestamp,
        exit_reason: reason,
      })
      .in("user_id", uniqueUserIds)
      .eq("status", "queued")
      .is("deleted_at", null)
      .select("id");

    if (error) {
      throw error;
    }

    return (data ?? []).length;
  }

  async findSessionByTokenHash(tokenHash: string) {
    const { data, error } = await this.supabase
      .from("guest_sessions")
      .select("id, user_id, token_hash, fingerprint_hash, created_at, last_seen_at, revoked_at, expires_at")
      .eq("token_hash", tokenHash)
      .is("revoked_at", null)
      .maybeSingle<Omit<SessionRow, "user" | "profile">>();

    if (error) {
      throw error;
    }

    if (!data) {
      return null;
    }

    const { data: user, error: userError } = await this.supabase
      .from("users")
      .select("id, created_at, last_seen_at, deleted_at")
      .eq("id", data.user_id)
      .is("deleted_at", null)
      .single<SessionRow["user"]>();

    if (userError) {
      throw userError;
    }

    const profile = await this.getProfile(data.user_id);

    return {
      ...data,
      user,
      profile: {
        anonymous_handle: profile.anonymous_handle,
        age_attested_over_18: profile.age_attested_over_18,
        onboarding_completed_at: profile.onboarding_completed_at,
        country_code: profile.country_code,
        device_fingerprint_hash: profile.device_fingerprint_hash,
      },
    } satisfies SessionRow;
  }

  async createGuestUserSession(input: {
    tokenHash: string;
    fingerprintHash: string | null;
    countryCode: string | null;
  }) {
    const { data: user, error: userError } = await this.supabase
      .from("users")
      .insert({
        auth_provider: "guest",
      })
      .select("id, created_at, last_seen_at, deleted_at")
      .single<{ id: string; created_at: string; last_seen_at: string; deleted_at: string | null }>();

    if (userError) {
      throw userError;
    }

    const { data: profile, error: profileError } = await this.supabase
      .from("anonymous_profiles")
      .insert({
        user_id: user.id,
        anonymous_handle: `guest_${user.id.slice(0, 8)}`,
        country_code: input.countryCode,
        device_fingerprint_hash: input.fingerprintHash,
      })
      .select("anonymous_handle, age_attested_over_18, onboarding_completed_at, country_code, device_fingerprint_hash")
      .single<SessionRow["profile"]>();

    if (profileError) {
      throw profileError;
    }

    const { data: session, error: sessionError } = await this.supabase
      .from("guest_sessions")
      .insert({
        user_id: user.id,
        token_hash: input.tokenHash,
        fingerprint_hash: input.fingerprintHash,
      })
      .select("id, user_id, token_hash, fingerprint_hash, created_at, last_seen_at, revoked_at, expires_at")
      .single<Omit<SessionRow, "user" | "profile">>();

    if (sessionError) {
      throw sessionError;
    }

    return {
      ...session,
      user,
      profile,
    } satisfies SessionRow;
  }

  async touchSession(sessionId: string, userId: string) {
    const now = new Date().toISOString();

    const { error } = await this.supabase
      .from("guest_sessions")
      .update({
        last_seen_at: now,
      })
      .eq("id", sessionId);

    if (error) {
      throw error;
    }

    const { error: userError } = await this.supabase
      .from("users")
      .update({
        last_seen_at: now,
      })
      .eq("id", userId);

    if (userError) {
      throw userError;
    }
  }

  async completeOnboarding(userId: string, input: { countryCode: string | null }) {
    const updates: {
      age_attested_over_18: boolean;
      onboarding_completed_at: string;
      updated_at: string;
      country_code?: string;
    } = {
      age_attested_over_18: true,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (input.countryCode) {
      updates.country_code = input.countryCode;
    }

    const { error } = await this.supabase
      .from("anonymous_profiles")
      .update(updates)
      .eq("user_id", userId);

    if (error) {
      throw error;
    }
  }

  async getProfile(userId: string) {
    const { data, error } = await this.supabase
      .from("anonymous_profiles")
      .select("user_id, anonymous_handle, age_attested_over_18, onboarding_completed_at, country_code, device_fingerprint_hash, created_at")
      .eq("user_id", userId)
      .is("deleted_at", null)
      .single<{
        user_id: string;
        anonymous_handle: string;
        age_attested_over_18: boolean;
        onboarding_completed_at: string | null;
        country_code: string | null;
        device_fingerprint_hash: string | null;
        created_at: string;
      }>();

    if (error) {
      throw error;
    }

    return data;
  }

  async getUser(userId: string) {
    const { data, error } = await this.supabase
      .from("users")
      .select("id, last_seen_at, deleted_at")
      .eq("id", userId)
      .maybeSingle<{
        id: string;
        last_seen_at: string;
        deleted_at: string | null;
      }>();

    if (error) {
      throw error;
    }

    return data;
  }

  async incrementRateLimit(input: {
    action: string;
    rateKey: string;
    windowMs: number;
  }) {
    const windowStartedAt = new Date(
      Math.floor(Date.now() / input.windowMs) * input.windowMs,
    ).toISOString();

    const { data: existing, error: existingError } = await this.supabase
      .from("beta_rate_limits")
      .select("id, count")
      .eq("action", input.action)
      .eq("rate_key", input.rateKey)
      .eq("window_started_at", windowStartedAt)
      .maybeSingle<{ id: string; count: number }>();

    if (existingError) {
      throw existingError;
    }

    if (existing) {
      const nextCount = existing.count + 1;
      const { error } = await this.supabase
        .from("beta_rate_limits")
        .update({
          count: nextCount,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existing.id);

      if (error) {
        throw error;
      }

      return nextCount;
    }

    const { error } = await this.supabase.from("beta_rate_limits").insert({
      action: input.action,
      rate_key: input.rateKey,
      window_started_at: windowStartedAt,
      count: 1,
    });

    if (error) {
      throw error;
    }

    return 1;
  }

  async getActiveUserCooldown(userId: string) {
    const { data, error } = await this.supabase
      .from("beta_user_cooldowns")
      .select("user_id, reason, expires_at")
      .eq("user_id", userId)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle<{ user_id: string; reason: string; expires_at: string }>();

    if (error) {
      throw error;
    }

    return data;
  }

  async setUserCooldown(input: { userId: string; reason: string; expiresAt: string }) {
    const { error } = await this.supabase.from("beta_user_cooldowns").upsert(
      {
        user_id: input.userId,
        reason: input.reason,
        expires_at: input.expiresAt,
        updated_at: new Date().toISOString(),
      },
      {
        onConflict: "user_id",
      },
    );

    if (error) {
      throw error;
    }
  }

  async getActiveQueueEntry(userId: string) {
    const { data, error } = await this.supabase
      .from("queue_entries")
      .select("id, user_id, status, entered_at, preferred_country_codes, excluded_country_codes")
      .eq("user_id", userId)
      .eq("status", "queued")
      .is("deleted_at", null)
      .order("entered_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        user_id: string;
        status: "queued";
        entered_at: string;
        preferred_country_codes: string[];
        excluded_country_codes: string[];
      }>();

    if (error) {
      throw error;
    }

    return data;
  }

  async getQueueEntryById(queueEntryId: string) {
    const { data, error } = await this.supabase
      .from("queue_entries")
      .select("id, user_id, status, entered_at, preferred_country_codes, excluded_country_codes")
      .eq("id", queueEntryId)
      .is("deleted_at", null)
      .maybeSingle<{
        id: string;
        user_id: string;
        status: "queued" | "matched" | "left";
        entered_at: string;
        preferred_country_codes: string[];
        excluded_country_codes: string[];
      }>();

    if (error) {
      throw error;
    }

    return data;
  }

  async createQueueEntry(userId: string, filters: QueueFilters) {
    const { data, error } = await this.supabase
      .from("queue_entries")
      .insert({
        user_id: userId,
        preferred_country_codes: filters.preferredCountries,
        excluded_country_codes: filters.excludedCountries,
      })
      .select("id, user_id, status, entered_at, preferred_country_codes, excluded_country_codes")
      .single<{
        id: string;
        user_id: string;
        status: "queued";
        entered_at: string;
        preferred_country_codes: string[];
        excluded_country_codes: string[];
      }>();

    if (error) {
      throw error;
    }

    return data;
  }

  async ensureActiveQueueEntry(userId: string, filters: QueueFilters) {
    const activeQueue = await this.getActiveQueueEntry(userId);

    if (activeQueue) {
      return {
        entry: activeQueue,
        createdNew: false,
      };
    }

    try {
      const createdQueue = await this.createQueueEntry(userId, filters);
      return {
        entry: createdQueue,
        createdNew: true,
      };
    } catch (error) {
      if (!this.isActiveQueueUniqueViolation(error)) {
        throw error;
      }

      const reusedQueue = await this.getActiveQueueEntry(userId);

      if (!reusedQueue) {
        throw error;
      }

      return {
        entry: reusedQueue,
        createdNew: false,
      };
    }
  }

  async cleanupStaleQueueEntries(maxAgeMs = STALE_QUEUE_MAX_AGE_MS) {
    const { data: activeMatches, error: activeMatchesError } = await this.supabase
      .from("matches")
      .select("user_a_id, user_b_id")
      .eq("status", "matched")
      .limit(100);

    if (activeMatchesError) {
      throw activeMatchesError;
    }

    const staleActiveMatchCount = await this.leaveQueuedEntriesForUsers(
      (activeMatches ?? []).flatMap((row) => [row.user_a_id as string, row.user_b_id as string]),
      "stale_active_match",
    );

    const staleBefore = new Date(Date.now() - maxAgeMs).toISOString();
    const { data: staleUsers, error: staleUsersError } = await this.supabase
      .from("users")
      .select("id")
      .lte("last_seen_at", staleBefore)
      .is("deleted_at", null)
      .limit(100);

    if (staleUsersError) {
      throw staleUsersError;
    }

    const staleInactiveSessionCount = await this.leaveQueuedEntriesForUsers(
      (staleUsers ?? []).map((row) => row.id as string),
      "stale_inactive_session",
    );

    return {
      staleActiveMatchCount,
      staleInactiveSessionCount,
    };
  }

  async getLatestQueueExit(userId: string) {
    const { data, error } = await this.supabase
      .from("queue_entries")
      .select("id, exited_at, exit_reason")
      .eq("user_id", userId)
      .not("exited_at", "is", null)
      .is("deleted_at", null)
      .order("exited_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        exited_at: string;
        exit_reason: string | null;
      }>();

    if (error) {
      throw error;
    }

    return data;
  }

  async leaveQueueEntry(queueEntryId: string, reason: string) {
    const { error } = await this.supabase
      .from("queue_entries")
      .update({
        status: "left",
        exited_at: new Date().toISOString(),
        exit_reason: reason,
      })
      .eq("id", queueEntryId)
      .eq("status", "queued");

    if (error) {
      throw error;
    }
  }

  async findTieredMatchCandidate(input: {
    requesterUserId: string;
    requesterQueueEntryId: string;
    requesterCountryCode: string | null;
    requesterPreferredCountries: string[];
    requesterExcludedCountries: string[];
    requesterWaitSeconds: number;
  }) {
    const { data, error } = await this.supabase.rpc("find_tiered_match_candidate", {
      requester_user_id: input.requesterUserId,
      requester_queue_entry_id: input.requesterQueueEntryId,
      requester_country_code: input.requesterCountryCode,
      requester_preferred_country_codes: input.requesterPreferredCountries,
      requester_excluded_country_codes: input.requesterExcludedCountries,
      requester_wait_seconds: Math.max(0, Math.floor(input.requesterWaitSeconds)),
    });

    if (error) {
      throw error;
    }

    const row = (data ?? [])[0] as
      | {
          candidate_queue_entry_id: string;
          candidate_user_id: string;
        }
      | undefined;

    return row
      ? {
          queueEntryId: row.candidate_queue_entry_id,
          userId: row.candidate_user_id,
        }
      : null;
  }

  async claimTieredMatch(userId: string) {
    const { data, error } = await this.supabase.rpc("claim_tiered_match", {
      requester_user_id: userId,
    });

    if (error) {
      throw error;
    }

    const row = (data ?? [])[0] as ClaimedMatchRow | undefined;

    return row ?? null;
  }

  private async markQueueEntriesMatched(queueEntryIds: string[]) {
    const timestamp = new Date().toISOString();
    const { data, error } = await this.supabase
      .from("queue_entries")
      .update({
        status: "matched",
        matched_at: timestamp,
        exited_at: timestamp,
        exit_reason: "matched",
      })
      .in("id", queueEntryIds)
      .eq("status", "queued")
      .is("deleted_at", null)
      .select("id");

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => row.id as string);
  }

  private async restoreQueueEntriesToQueued(queueEntryIds: string[]) {
    if (queueEntryIds.length === 0) {
      return;
    }

    const { error } = await this.supabase
      .from("queue_entries")
      .update({
        status: "queued",
        matched_at: null,
        exited_at: null,
        exit_reason: null,
      })
      .in("id", queueEntryIds)
      .eq("status", "matched")
      .is("deleted_at", null);

    if (error) {
      throw error;
    }
  }

  private async createLocalMatchRecord(input: {
    requesterUserId: string;
    requesterQueueEntryId: string;
    candidateUserId: string;
    candidateQueueEntryId: string;
    phaseUsed: number;
  }) {
    const { data, error } = await this.supabase
      .from("matches")
      .insert({
        user_a_id: input.requesterUserId,
        user_b_id: input.candidateUserId,
        queue_entry_a_id: input.requesterQueueEntryId,
        queue_entry_b_id: input.candidateQueueEntryId,
      })
      .select("id, session_id, matched_at, user_a_id, user_b_id")
      .single<{
        id: string;
        session_id: string;
        matched_at: string;
        user_a_id: string;
        user_b_id: string;
      }>();

    if (error) {
      throw error;
    }

    return {
      match_id: data.id,
      session_id: data.session_id,
      matched_at: data.matched_at,
      user_a_id: data.user_a_id,
      user_b_id: data.user_b_id,
      phase_used: input.phaseUsed,
      existing_match: false,
    } satisfies ClaimedMatchRow;
  }

  async claimTieredMatchLocally(userId: string) {
    const existingMatch = await this.getLatestMatchForUser(userId);

    if (existingMatch?.status === "matched") {
      return this.mapExistingMatchClaim(existingMatch);
    }

    const initiatorQueue = await this.getActiveQueueEntry(userId);

    if (!initiatorQueue) {
      return null;
    }

    const requesterProfile = await this.getProfile(userId);
    const requesterWaitSeconds = Math.max(
      0,
      Math.floor((Date.now() - new Date(initiatorQueue.entered_at).getTime()) / 1000),
    );
    const phaseUsed = this.getTieredMatchPhase(requesterWaitSeconds);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const candidate = await this.findTieredMatchCandidate({
        requesterUserId: userId,
        requesterQueueEntryId: initiatorQueue.id,
        requesterCountryCode: requesterProfile.country_code,
        requesterPreferredCountries: initiatorQueue.preferred_country_codes,
        requesterExcludedCountries: initiatorQueue.excluded_country_codes,
        requesterWaitSeconds,
      });

      if (!candidate) {
        return null;
      }

      const [candidateQueue, candidateUser, candidateExistingMatch] = await Promise.all([
        this.getQueueEntryById(candidate.queueEntryId),
        this.getUser(candidate.userId),
        this.getLatestMatchForUser(candidate.userId),
      ]);

      if (!candidateQueue || candidateQueue.status !== "queued" || candidateQueue.user_id !== candidate.userId) {
        continue;
      }

      if (candidateExistingMatch?.status === "matched") {
        await this.leaveQueueEntry(candidate.queueEntryId, "stale_active_match");
        continue;
      }

      if (!candidateUser || candidateUser.deleted_at || !this.isQueueCandidateFresh(candidateUser.last_seen_at)) {
        await this.leaveQueueEntry(candidate.queueEntryId, "stale_inactive_session");
        continue;
      }

      const queueEntryIds = [initiatorQueue.id, candidate.queueEntryId];
      const claimedQueueEntryIds = await this.markQueueEntriesMatched(queueEntryIds);

      if (claimedQueueEntryIds.length !== queueEntryIds.length) {
        await this.restoreQueueEntriesToQueued(claimedQueueEntryIds);
        continue;
      }

      try {
        return await this.createLocalMatchRecord({
          requesterUserId: userId,
          requesterQueueEntryId: initiatorQueue.id,
          candidateUserId: candidate.userId,
          candidateQueueEntryId: candidate.queueEntryId,
          phaseUsed,
        });
      } catch (error) {
        await this.restoreQueueEntriesToQueued(queueEntryIds).catch(() => undefined);
        throw error;
      }
    }

    return null;
  }

  async getLatestMatchForUser(userId: string) {
    const { data, error } = await this.supabase
      .from("matches")
      .select("id, session_id, status, matched_at, ended_at, end_reason, user_a_id, user_b_id")
      .or(`user_a_id.eq.${userId},user_b_id.eq.${userId}`)
      .order("matched_at", { ascending: false })
      .limit(1)
      .maybeSingle<{
        id: string;
        session_id: string;
        status: "matched" | "ended";
        matched_at: string;
        ended_at: string | null;
        end_reason: string | null;
        user_a_id: string;
        user_b_id: string;
      }>();

    if (error) {
      throw error;
    }

    return data ? this.hydrateMatchProfiles(data) : null;
  }

  async getMatchById(matchId: string) {
    const { data, error } = await this.supabase
      .from("matches")
      .select("id, session_id, status, matched_at, ended_at, end_reason, user_a_id, user_b_id")
      .eq("id", matchId)
      .single<{
        id: string;
        session_id: string;
        status: "matched" | "ended";
        matched_at: string;
        ended_at: string | null;
        end_reason: string | null;
        user_a_id: string;
        user_b_id: string;
      }>();

    if (error) {
      throw error;
    }

    return this.hydrateMatchProfiles(data);
  }

  async endMatchAtomically(matchId: string, actorUserId: string, reason: string) {
    const { data, error } = await this.supabase.rpc("end_match_transactional", {
      actor_user_id: actorUserId,
      target_match_id: matchId,
      end_reason_input: reason,
    });

    if (error) {
      throw error;
    }

    return (data ?? [])[0] as { match_id: string; ended_at: string | null } | undefined;
  }

  async createReport(input: {
    reporterUserId: string;
    reportedUserId: string;
    matchId: string;
    sessionId: string;
    reason: string;
    details: string;
  }) {
    const { data, error } = await this.supabase
      .from("reports")
      .insert({
        reporter_user_id: input.reporterUserId,
        reported_user_id: input.reportedUserId,
        match_id: input.matchId,
        session_id: input.sessionId,
        reason: input.reason,
        details: input.details,
      })
      .select("id, match_id, reporter_user_id, reported_user_id, reason, details, status, created_at")
      .single<{
        id: string;
        match_id: string | null;
        reporter_user_id: string;
        reported_user_id: string;
        reason: string;
        details: string;
        status: string;
        created_at: string;
      }>();

    if (error) {
      throw error;
    }

    return data;
  }

  async createBlock(input: {
    blockerUserId: string;
    blockedUserId: string;
    matchId: string;
  }) {
    const { error } = await this.supabase
      .from("blocks")
      .upsert(
        {
          blocker_user_id: input.blockerUserId,
          blocked_user_id: input.blockedUserId,
          match_id: input.matchId,
        },
        {
          onConflict: "blocker_user_id,blocked_user_id",
        },
      );

    if (error) {
      throw error;
    }
  }

  async countRecentReportsAgainstUser(input: { userId: string; since: string }) {
    const { count, error } = await this.supabase
      .from("reports")
      .select("id", { count: "exact", head: true })
      .eq("reported_user_id", input.userId)
      .gte("created_at", input.since);

    if (error) {
      throw error;
    }

    return count ?? 0;
  }

  async createFeedback(input: {
    feedbackType: FeedbackType;
    feedbackText: string;
    userId: string | null;
    matchId: string | null;
    userAgent: string | null;
    fingerprintHash: string | null;
  }) {
    const { data, error } = await this.supabase
      .from("feedback_submissions")
      .insert({
        feedback_type: input.feedbackType,
        feedback_text: input.feedbackText,
        user_id: input.userId,
        match_id: input.matchId,
        user_agent: input.userAgent,
        fingerprint_hash: input.fingerprintHash,
      })
      .select("id, feedback_type, feedback_text, user_id, match_id, user_agent, created_at")
      .single<{
        id: string;
        feedback_type: FeedbackType;
        feedback_text: string;
        user_id: string | null;
        match_id: string | null;
        user_agent: string | null;
        created_at: string;
      }>();

    if (error) {
      throw error;
    }

    return this.mapFeedbackRecord(data);
  }

  async writeAuditEvent(input: {
    actorUserId: string;
    targetUserId?: string | null;
    matchId?: string | null;
    eventName: string;
    metadata?: Record<string, unknown>;
  }) {
    const { error } = await this.supabase.from("audit_events").insert({
      actor_user_id: input.actorUserId,
      target_user_id: input.targetUserId ?? null,
      match_id: input.matchId ?? null,
      entity_type: "user_action",
      entity_id: input.matchId ?? null,
      event_name: input.eventName,
      metadata: input.metadata ?? {},
    });

    if (error) {
      throw error;
    }
  }

  private mapMatchForUser(userId: string, record: ActiveMatchRecord | null): MatchView | null {
    if (!record) {
      return null;
    }

    const isUserA = record.user_a_id === userId;
    const counterpart = isUserA
      ? {
          userId: record.user_b_id,
          handle: record.user_b_profile?.anonymous_handle ?? "unknown",
          countryCode: record.user_b_profile?.country_code ?? null,
        }
      : {
          userId: record.user_a_id,
          handle: record.user_a_profile?.anonymous_handle ?? "unknown",
          countryCode: record.user_a_profile?.country_code ?? null,
        };

    return {
      matchId: record.id,
      sessionId: record.session_id,
      status: record.status,
      matchedAt: record.matched_at,
      endedAt: record.ended_at,
      counterpart,
      preConnectionSeconds: 2,
    };
  }

  async getQueueSnapshot(userId: string): Promise<QueueStatusView> {
    const queueEntry = await this.getActiveQueueEntry(userId);
    const latestMatch = await this.getLatestMatchForUser(userId);

    return {
      status: latestMatch?.status === "matched" ? "matched" : queueEntry ? "queued" : "idle",
      queueEntryId: queueEntry?.id ?? null,
      enteredAt: queueEntry?.entered_at ?? null,
      filters: {
        preferredCountries: queueEntry?.preferred_country_codes ?? [],
        excludedCountries: queueEntry?.excluded_country_codes ?? [],
      },
      activeMatch: latestMatch?.status === "matched" ? this.mapMatchForUser(userId, latestMatch) : null,
      recentMatch: this.mapMatchForUser(userId, latestMatch),
    };
  }

  private createUnknownAdminUser(userId: string): AdminUserView {
    return {
      userId,
      handle: "unknown",
      countryCode: null,
      ageConfirmed: false,
      onboardingCompleted: false,
      onboardingCompletedAt: null,
      createdAt: "",
      reportsReceived: 0,
      blocksReceived: 0,
      activeCooldownReason: null,
      activeCooldownExpiresAt: null,
    };
  }

  private async getAdminTrustSignals(userIds: string[]) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));
    const emptySignals = new Map<string, Pick<
      AdminUserView,
      "reportsReceived" | "blocksReceived" | "activeCooldownReason" | "activeCooldownExpiresAt"
    >>();

    if (uniqueUserIds.length === 0) {
      return emptySignals;
    }

    const [reportsResult, blocksResult, cooldownsResult] = await Promise.all([
      this.supabase
        .from("reports")
        .select("reported_user_id")
        .in("reported_user_id", uniqueUserIds),
      this.supabase
        .from("blocks")
        .select("blocked_user_id")
        .in("blocked_user_id", uniqueUserIds),
      this.supabase
        .from("beta_user_cooldowns")
        .select("user_id, reason, expires_at")
        .in("user_id", uniqueUserIds)
        .gt("expires_at", new Date().toISOString()),
    ]);

    if (reportsResult.error) {
      throw reportsResult.error;
    }

    if (blocksResult.error) {
      throw blocksResult.error;
    }

    if (cooldownsResult.error) {
      throw cooldownsResult.error;
    }

    for (const userId of uniqueUserIds) {
      emptySignals.set(userId, {
        reportsReceived: 0,
        blocksReceived: 0,
        activeCooldownReason: null,
        activeCooldownExpiresAt: null,
      });
    }

    for (const report of reportsResult.data ?? []) {
      const userId = report.reported_user_id as string;
      const signal = emptySignals.get(userId);

      if (signal) {
        signal.reportsReceived = (signal.reportsReceived ?? 0) + 1;
      }
    }

    for (const block of blocksResult.data ?? []) {
      const userId = block.blocked_user_id as string;
      const signal = emptySignals.get(userId);

      if (signal) {
        signal.blocksReceived = (signal.blocksReceived ?? 0) + 1;
      }
    }

    for (const cooldown of cooldownsResult.data ?? []) {
      const userId = cooldown.user_id as string;
      const signal = emptySignals.get(userId);

      if (signal) {
        signal.activeCooldownReason = cooldown.reason as string;
        signal.activeCooldownExpiresAt = cooldown.expires_at as string;
      }
    }

    return emptySignals;
  }

  private async getAdminUserSummaries(userIds: string[]) {
    const uniqueUserIds = Array.from(new Set(userIds.filter(Boolean)));

    if (uniqueUserIds.length === 0) {
      return new Map<string, AdminUserView>();
    }

    const { data, error } = await this.supabase
      .from("anonymous_profiles")
      .select(
        "user_id, anonymous_handle, country_code, age_attested_over_18, onboarding_completed_at, created_at",
      )
      .in("user_id", uniqueUserIds)
      .is("deleted_at", null);

    if (error) {
      throw error;
    }

    const signals = await this.getAdminTrustSignals(uniqueUserIds);

    return new Map(
      (data ?? []).map((row) => [
        row.user_id as string,
        {
          userId: row.user_id as string,
          handle: row.anonymous_handle as string,
          countryCode: row.country_code as string | null,
          ageConfirmed: row.age_attested_over_18 as boolean,
          onboardingCompleted: Boolean(row.onboarding_completed_at),
          onboardingCompletedAt: row.onboarding_completed_at as string | null,
          createdAt: row.created_at as string,
          ...(signals.get(row.user_id as string) ?? {}),
        } satisfies AdminUserView,
      ]),
    );
  }

  private getAdminUserSummary(userId: string, summaries: Map<string, AdminUserView>) {
    return summaries.get(userId) ?? this.createUnknownAdminUser(userId);
  }

  private async getAdminMatchLinkSummaries(matchIds: Array<string | null>) {
    const uniqueMatchIds = Array.from(new Set(matchIds.filter((matchId): matchId is string => Boolean(matchId))));

    if (uniqueMatchIds.length === 0) {
      return new Map<string, { status: "matched" | "ended"; endReason: string | null }>();
    }

    const { data, error } = await this.supabase
      .from("matches")
      .select("id, status, end_reason")
      .in("id", uniqueMatchIds);

    if (error) {
      throw error;
    }

    return new Map(
      (data ?? []).map((row) => [
        row.id as string,
        {
          status: row.status as "matched" | "ended",
          endReason: row.end_reason as string | null,
        },
      ]),
    );
  }

  private mapAdminMatchRecord(
    record: {
      id: string;
      session_id: string;
      status: "matched" | "ended";
      matched_at: string;
      ended_at: string | null;
      end_reason: string | null;
      user_a_id: string;
      user_b_id: string;
    },
    summaries: Map<string, AdminUserView>,
  ): AdminMatchView {
    return {
      matchId: record.id,
      sessionId: record.session_id,
      status: record.status,
      matchedAt: record.matched_at,
      endedAt: record.ended_at,
      endReason: record.end_reason,
      userA: this.getAdminUserSummary(record.user_a_id, summaries),
      userB: this.getAdminUserSummary(record.user_b_id, summaries),
    };
  }

  async adminEndMatchAtomically(matchId: string, reason: string) {
    const { data, error } = await this.supabase.rpc("admin_end_match_transactional", {
      target_match_id: matchId,
      end_reason_input: reason,
    });

    if (error) {
      throw error;
    }

    return (data ?? [])[0] as { match_id: string; ended_at: string | null } | undefined;
  }

  async getAdminReports(query: AdminQuery): Promise<AdminReportView[]> {
    let request = this.supabase
      .from("reports")
      .select(
        "id, match_id, session_id, reporter_user_id, reported_user_id, reason, details, status, created_at",
      )
      .order("created_at", { ascending: false });

    if (query.userId) {
      request = request.or(`reporter_user_id.eq.${query.userId},reported_user_id.eq.${query.userId}`);
    }

    if (query.dateFrom) {
      request = request.gte("created_at", query.dateFrom);
    }

    if (query.dateTo) {
      request = request.lte("created_at", query.dateTo);
    }

    const { data, error } = await request.limit(100);

    if (error) {
      throw error;
    }

    const summaries = await this.getAdminUserSummaries(
      (data ?? []).flatMap((row) => [row.reporter_user_id as string, row.reported_user_id as string]),
    );
    const matchLinks = await this.getAdminMatchLinkSummaries(
      (data ?? []).map((row) => row.match_id as string | null),
    );

    return (data ?? []).map((row) => {
      const linkedMatch = row.match_id ? matchLinks.get(row.match_id as string) : null;

      return {
        reportId: row.id,
        matchId: row.match_id,
        sessionId: row.session_id,
        reporter: this.getAdminUserSummary(row.reporter_user_id, summaries),
        reported: this.getAdminUserSummary(row.reported_user_id, summaries),
        reason: row.reason,
        details: row.details,
        status: row.status,
        createdAt: row.created_at,
        linkedMatchStatus: linkedMatch?.status ?? null,
        linkedMatchEndReason: linkedMatch?.endReason ?? null,
      };
    });
  }

  async getAdminMatches(query: AdminQuery): Promise<AdminMatchView[]> {
    let request = this.supabase
      .from("matches")
      .select("id, session_id, status, matched_at, ended_at, end_reason, user_a_id, user_b_id")
      .order("matched_at", { ascending: false });

    if (query.userId) {
      request = request.or(`user_a_id.eq.${query.userId},user_b_id.eq.${query.userId}`);
    }

    if (query.dateFrom) {
      request = request.gte("matched_at", query.dateFrom);
    }

    if (query.dateTo) {
      request = request.lte("matched_at", query.dateTo);
    }

    const { data, error } = await request.limit(100);

    if (error) {
      throw error;
    }

    const summaries = await this.getAdminUserSummaries(
      (data ?? []).flatMap((row) => [row.user_a_id as string, row.user_b_id as string]),
    );

    return (data ?? []).map((row) => this.mapAdminMatchRecord(row, summaries));
  }

  async getAdminMatchById(matchId: string): Promise<AdminMatchView> {
    const match = await this.getMatchById(matchId);
    const summaries = await this.getAdminUserSummaries([match.user_a_id, match.user_b_id]);
    return this.mapAdminMatchRecord(match, summaries);
  }

  async getAdminUsers(query: AdminQuery): Promise<AdminUserView[]> {
    let request = this.supabase
      .from("anonymous_profiles")
      .select(
        "user_id, anonymous_handle, country_code, age_attested_over_18, onboarding_completed_at, created_at",
      )
      .is("deleted_at", null)
      .order("created_at", { ascending: false });

    if (query.userId) {
      request = request.eq("user_id", query.userId);
    }

    if (query.dateFrom) {
      request = request.gte("created_at", query.dateFrom);
    }

    if (query.dateTo) {
      request = request.lte("created_at", query.dateTo);
    }

    const { data, error } = await request.limit(100);

    if (error) {
      throw error;
    }

    const signals = await this.getAdminTrustSignals((data ?? []).map((row) => row.user_id as string));

    return (data ?? []).map((row) => ({
      userId: row.user_id,
      handle: row.anonymous_handle,
      countryCode: row.country_code,
      ageConfirmed: row.age_attested_over_18,
      onboardingCompleted: Boolean(row.onboarding_completed_at),
      onboardingCompletedAt: row.onboarding_completed_at,
      createdAt: row.created_at,
      ...(signals.get(row.user_id as string) ?? {}),
    }));
  }

  async getAdminBlocks(query: AdminQuery): Promise<AdminBlockView[]> {
    let request = this.supabase
      .from("blocks")
      .select("id, blocker_user_id, blocked_user_id, match_id, created_at")
      .order("created_at", { ascending: false });

    if (query.userId) {
      request = request.or(`blocker_user_id.eq.${query.userId},blocked_user_id.eq.${query.userId}`);
    }

    if (query.dateFrom) {
      request = request.gte("created_at", query.dateFrom);
    }

    if (query.dateTo) {
      request = request.lte("created_at", query.dateTo);
    }

    const { data, error } = await request.limit(100);

    if (error) {
      throw error;
    }

    const summaries = await this.getAdminUserSummaries(
      (data ?? []).flatMap((row) => [row.blocker_user_id as string, row.blocked_user_id as string]),
    );
    const matchLinks = await this.getAdminMatchLinkSummaries(
      (data ?? []).map((row) => row.match_id as string | null),
    );

    return (data ?? []).map((row) => {
      const linkedMatch = row.match_id ? matchLinks.get(row.match_id as string) : null;

      return {
        blockId: row.id,
        matchId: row.match_id,
        blocker: this.getAdminUserSummary(row.blocker_user_id, summaries),
        blocked: this.getAdminUserSummary(row.blocked_user_id, summaries),
        createdAt: row.created_at,
        linkedMatchStatus: linkedMatch?.status ?? null,
        linkedMatchEndReason: linkedMatch?.endReason ?? null,
      };
    });
  }

  async getAdminAuditLogs(query: AdminQuery): Promise<AuditEventView[]> {
    let request = this.supabase
      .from("audit_events")
      .select("id, event_name, actor_user_id, target_user_id, match_id, created_at, metadata")
      .order("created_at", { ascending: false });

    if (query.userId) {
      request = request.or(`actor_user_id.eq.${query.userId},target_user_id.eq.${query.userId}`);
    }

    if (query.type) {
      request = request.eq("event_name", query.type);
    }

    if (query.dateFrom) {
      request = request.gte("created_at", query.dateFrom);
    }

    if (query.dateTo) {
      request = request.lte("created_at", query.dateTo);
    }

    const { data, error } = await request.limit(200);

    if (error) {
      throw error;
    }

    return (data ?? []).map((row) => ({
      id: row.id,
      eventName: row.event_name,
      actorUserId: row.actor_user_id,
      targetUserId: row.target_user_id,
      matchId: row.match_id,
      createdAt: row.created_at,
      metadata: (row.metadata ?? {}) as Record<string, unknown>,
    }));
  }

  private mapFeedbackRecord(record: {
    id: string;
    feedback_type: FeedbackType;
    feedback_text: string;
    user_id: string | null;
    match_id: string | null;
    user_agent: string | null;
    created_at: string;
  }): FeedbackView {
    return {
      feedbackId: record.id,
      feedbackType: record.feedback_type,
      feedbackText: record.feedback_text,
      userId: record.user_id,
      matchId: record.match_id,
      userAgent: record.user_agent,
      createdAt: record.created_at,
    };
  }

  async getAdminFeedback(query: AdminQuery): Promise<FeedbackView[]> {
    let request = this.supabase
      .from("feedback_submissions")
      .select("id, feedback_type, feedback_text, user_id, match_id, user_agent, created_at")
      .order("created_at", { ascending: false });

    if (query.userId) {
      request = request.eq("user_id", query.userId);
    }

    if (query.type) {
      request = request.eq("feedback_type", query.type);
    }

    if (query.dateFrom) {
      request = request.gte("created_at", query.dateFrom);
    }

    if (query.dateTo) {
      request = request.lte("created_at", query.dateTo);
    }

    const { data, error } = await request.limit(100);

    if (error) {
      throw error;
    }

    return (data ?? []).map((record) => this.mapFeedbackRecord(record));
  }

  async getAdminAnalyticsSummary(query: AdminQuery): Promise<AnalyticsSummaryView[]> {
    let request = this.supabase
      .from("audit_events")
      .select("event_name, created_at")
      .in("event_name", [
        "session_created",
        "onboarding_completed",
        "queue_joined",
        "match_created",
        "voice_connected",
        "voice_failed",
        "end_find_next",
        "report_submitted",
        "block_submitted",
        "feedback_submitted",
      ]);

    if (query.dateFrom) {
      request = request.gte("created_at", query.dateFrom);
    }

    if (query.dateTo) {
      request = request.lte("created_at", query.dateTo);
    }

    const { data, error } = await request.limit(1000);

    if (error) {
      throw error;
    }

    const counts = new Map<string, number>();

    for (const row of data ?? []) {
      counts.set(row.event_name as string, (counts.get(row.event_name as string) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([eventName, count]) => ({ eventName, count }))
      .sort((left, right) => left.eventName.localeCompare(right.eventName));
  }

}
