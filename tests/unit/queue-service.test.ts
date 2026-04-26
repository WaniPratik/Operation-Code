import { describe, expect, it, vi } from "vitest";
import { QueueService } from "@/server/services/queue-service";

const idleSnapshot = {
  status: "idle" as const,
  queueEntryId: null,
  enteredAt: null,
  filters: {
    preferredCountries: [],
    excludedCountries: [],
  },
  activeMatch: null,
  recentMatch: null,
};

const queuedSnapshot = {
  status: "queued" as const,
  queueEntryId: "queue_1",
  enteredAt: "2026-04-23T00:00:00.000Z",
  filters: {
    preferredCountries: [],
    excludedCountries: [],
  },
  activeMatch: null,
  recentMatch: null,
};

const matchedSnapshot = {
  status: "matched" as const,
  queueEntryId: null,
  enteredAt: null,
  filters: {
    preferredCountries: [],
    excludedCountries: [],
  },
  activeMatch: {
    matchId: "match_1",
    sessionId: "session_1",
    status: "matched" as const,
    matchedAt: "2026-04-23T00:00:03.000Z",
    endedAt: null,
    counterpart: {
      userId: "user_2",
      handle: "guest_user_2",
      countryCode: "US",
    },
    preConnectionSeconds: 2,
  },
  recentMatch: {
    matchId: "match_1",
    sessionId: "session_1",
    status: "matched" as const,
    matchedAt: "2026-04-23T00:00:03.000Z",
    endedAt: null,
    counterpart: {
      userId: "user_2",
      handle: "guest_user_2",
      countryCode: "US",
    },
    preConnectionSeconds: 2,
  },
};

describe("QueueService", () => {
  it("creates a real local match when claim_tiered_match is missing locally", async () => {
    const repository = {
      getProfile: vi.fn().mockResolvedValue({
        onboarding_completed_at: "2026-04-23T00:00:00.000Z",
        country_code: null,
      }),
      getQueueSnapshot: vi
        .fn()
        .mockResolvedValueOnce(idleSnapshot)
        .mockResolvedValueOnce(matchedSnapshot),
      getLatestQueueExit: vi.fn().mockResolvedValue(null),
      ensureActiveQueueEntry: vi.fn().mockResolvedValue({
        entry: { id: "queue_1" },
        createdNew: true,
      }),
      cleanupStaleQueueEntries: vi.fn().mockResolvedValue({
        staleActiveMatchCount: 0,
        staleInactiveSessionCount: 0,
      }),
      getActiveQueueEntry: vi.fn().mockResolvedValue({ id: "queue_1" }),
      claimTieredMatch: vi.fn().mockRejectedValue({
        code: "PGRST202",
        message: "Could not find the function public.claim_tiered_match(requester_user_id) in the schema cache",
      }),
      claimTieredMatchLocally: vi.fn().mockResolvedValue({
        match_id: "match_1",
        session_id: "session_1",
        matched_at: "2026-04-23T00:00:03.000Z",
        user_a_id: "user_1",
        user_b_id: "user_2",
        phase_used: 1,
        existing_match: false,
      }),
    };
    const audit = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const queueService = new QueueService(repository as never, audit as never);

    const result = await queueService.joinQueue("user_1", {
      preferredCountries: [],
      excludedCountries: [],
    });

    expect(result).toEqual(matchedSnapshot);
    expect(repository.getLatestQueueExit).toHaveBeenCalledWith("user_1");
    expect(repository.ensureActiveQueueEntry).toHaveBeenCalledWith("user_1", {
      preferredCountries: [],
      excludedCountries: [],
    });
    expect(repository.cleanupStaleQueueEntries).toHaveBeenCalled();
    expect(repository.claimTieredMatchLocally).toHaveBeenCalledWith("user_1");
    expect(audit.write).toHaveBeenCalledTimes(3);
  });

  it("keeps queue join idempotent when the user already has an active queued entry", async () => {
    const repository = {
      getProfile: vi.fn().mockResolvedValue({
        onboarding_completed_at: "2026-04-23T00:00:00.000Z",
        country_code: null,
      }),
      getQueueSnapshot: vi
        .fn()
        .mockResolvedValueOnce(queuedSnapshot)
        .mockResolvedValueOnce(queuedSnapshot),
      getLatestQueueExit: vi.fn(),
      ensureActiveQueueEntry: vi.fn().mockResolvedValue({
        entry: { id: "queue_1" },
        createdNew: false,
      }),
      cleanupStaleQueueEntries: vi.fn().mockResolvedValue({
        staleActiveMatchCount: 0,
        staleInactiveSessionCount: 0,
      }),
      getActiveQueueEntry: vi.fn().mockResolvedValue({ id: "queue_1" }),
      claimTieredMatch: vi.fn().mockResolvedValue(null),
      claimTieredMatchLocally: vi.fn(),
    };
    const audit = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const queueService = new QueueService(repository as never, audit as never);

    const result = await queueService.joinQueue("user_1", {
      preferredCountries: [],
      excludedCountries: [],
    });

    expect(result).toEqual(queuedSnapshot);
    expect(repository.getLatestQueueExit).not.toHaveBeenCalled();
    expect(audit.write).not.toHaveBeenCalled();
    expect(repository.claimTieredMatchLocally).not.toHaveBeenCalled();
  });

  it("keeps the user queued when the local fallback does not find a candidate yet", async () => {
    const repository = {
      getProfile: vi.fn().mockResolvedValue({
        onboarding_completed_at: "2026-04-23T00:00:00.000Z",
        country_code: null,
      }),
      getQueueSnapshot: vi
        .fn()
        .mockResolvedValueOnce(idleSnapshot)
        .mockResolvedValueOnce(queuedSnapshot),
      getLatestQueueExit: vi.fn().mockResolvedValue(null),
      ensureActiveQueueEntry: vi.fn().mockResolvedValue({
        entry: { id: "queue_1" },
        createdNew: true,
      }),
      cleanupStaleQueueEntries: vi.fn().mockResolvedValue({
        staleActiveMatchCount: 1,
        staleInactiveSessionCount: 2,
      }),
      getActiveQueueEntry: vi.fn().mockResolvedValue({ id: "queue_1" }),
      claimTieredMatch: vi.fn().mockRejectedValue({
        code: "PGRST202",
        message: "Could not find the function public.claim_tiered_match(requester_user_id) in the schema cache",
      }),
      claimTieredMatchLocally: vi.fn().mockResolvedValue(null),
    };
    const audit = {
      write: vi.fn().mockResolvedValue(undefined),
    };
    const queueService = new QueueService(repository as never, audit as never);

    const result = await queueService.joinQueue("user_1", {
      preferredCountries: [],
      excludedCountries: [],
    });

    expect(result).toEqual(queuedSnapshot);
    expect(repository.claimTieredMatchLocally).toHaveBeenCalledWith("user_1");
    expect(audit.write).toHaveBeenCalledTimes(1);
  });

  it("blocks rapid queue re-entry for a short cooldown window", async () => {
    const repository = {
      getProfile: vi.fn().mockResolvedValue({
        onboarding_completed_at: "2026-04-23T00:00:00.000Z",
        country_code: null,
      }),
      getQueueSnapshot: vi.fn().mockResolvedValue(idleSnapshot),
      getLatestQueueExit: vi.fn().mockResolvedValue({
        id: "queue_old",
        exited_at: new Date().toISOString(),
        exit_reason: "user_leave",
      }),
      ensureActiveQueueEntry: vi.fn(),
      cleanupStaleQueueEntries: vi.fn(),
      getActiveQueueEntry: vi.fn(),
      claimTieredMatch: vi.fn(),
      claimTieredMatchLocally: vi.fn(),
    };
    const queueService = new QueueService(
      repository as never,
      { write: vi.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(
      queueService.joinQueue("user_1", {
        preferredCountries: [],
        excludedCountries: [],
      }),
    ).rejects.toMatchObject({
      statusCode: 429,
      message: expect.stringContaining("Please wait"),
    });
    expect(repository.ensureActiveQueueEntry).not.toHaveBeenCalled();
  });

  it("rethrows queue matching failures that are not the missing local RPC case", async () => {
    const repository = {
      getProfile: vi.fn().mockResolvedValue({
        onboarding_completed_at: "2026-04-23T00:00:00.000Z",
        country_code: null,
      }),
      getQueueSnapshot: vi.fn().mockResolvedValue(idleSnapshot),
      getLatestQueueExit: vi.fn().mockResolvedValue(null),
      ensureActiveQueueEntry: vi.fn().mockResolvedValue({
        entry: { id: "queue_1" },
        createdNew: true,
      }),
      cleanupStaleQueueEntries: vi.fn().mockResolvedValue({
        staleActiveMatchCount: 0,
        staleInactiveSessionCount: 0,
      }),
      getActiveQueueEntry: vi.fn().mockResolvedValue({ id: "queue_1" }),
      claimTieredMatch: vi.fn().mockRejectedValue({
        code: "23505",
        message: "duplicate key value violates unique constraint",
      }),
      claimTieredMatchLocally: vi.fn(),
    };
    const queueService = new QueueService(
      repository as never,
      { write: vi.fn().mockResolvedValue(undefined) } as never,
    );

    await expect(
      queueService.joinQueue("user_1", {
        preferredCountries: [],
        excludedCountries: [],
      }),
    ).rejects.toEqual({
      code: "23505",
      message: "duplicate key value violates unique constraint",
    });
    expect(repository.claimTieredMatchLocally).not.toHaveBeenCalled();
  });
});
