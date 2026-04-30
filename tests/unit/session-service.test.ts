import { beforeEach, describe, expect, it, vi } from "vitest";
import { SessionService } from "@/server/services/session-service";

function buildSessionRow(overrides: Partial<ReturnType<typeof buildSessionRowBase>> = {}) {
  return {
    ...buildSessionRowBase(),
    ...overrides,
    user: {
      ...buildSessionRowBase().user,
      ...(overrides.user ?? {}),
    },
    profile: {
      ...buildSessionRowBase().profile,
      ...(overrides.profile ?? {}),
    },
  };
}

function buildSessionRowBase() {
  return {
    id: "guest_session_1",
    user_id: "user_1",
    token_hash: "hashed_token_1",
    fingerprint_hash: "fingerprint_1",
    created_at: "2026-04-22T00:00:00.000Z",
    last_seen_at: "2026-04-22T00:00:00.000Z",
    revoked_at: null,
    expires_at: null,
    user: {
      id: "user_1",
      created_at: "2026-04-22T00:00:00.000Z",
      last_seen_at: "2026-04-22T00:00:00.000Z",
      deleted_at: null,
    },
    profile: {
      anonymous_handle: "guest_abcd1234",
      age_attested_over_18: false,
      onboarding_completed_at: null,
      country_code: null,
      device_fingerprint_hash: "fingerprint_1",
    },
  };
}

describe("SessionService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reuses an existing guest session when the token lookup succeeds", async () => {
    const row = buildSessionRow();
    const repository = {
      findSessionByTokenHash: vi.fn().mockResolvedValue(row),
      touchSession: vi.fn().mockResolvedValue(undefined),
    };
    const service = new SessionService(repository as never, {
      createGuestSessionToken: vi.fn(),
      hashGuestSessionToken: vi.fn().mockReturnValue("hashed_token_1"),
      readGuestSessionTokenFromCookies: vi.fn().mockResolvedValue("plain_token_1"),
      createRequestFingerprintHash: vi.fn(),
      detectRequestCountryCode: vi.fn(),
    });

    const result = await service.ensureGuestSession();

    expect(result.cookieToken).toBeNull();
    expect(result.session.userId).toBe("user_1");
    expect(repository.findSessionByTokenHash).toHaveBeenCalledWith("hashed_token_1");
    expect(repository.touchSession).toHaveBeenCalledWith("guest_session_1", "user_1");
  });

  it("creates a new guest session with a detected country and immediately reuses it", async () => {
    const createdRow = buildSessionRow({
      id: "guest_session_2",
      token_hash: "hashed_token_2",
      profile: {
        country_code: "CA",
      },
    });

    const repository = {
      findSessionByTokenHash: vi.fn().mockResolvedValue(createdRow),
      createGuestUserSession: vi.fn().mockResolvedValue(createdRow),
      touchSession: vi.fn().mockResolvedValue(undefined),
    };

    const hashGuestSessionToken = vi.fn((token: string) => `hashed:${token}`);
    const createService = new SessionService(repository as never, {
      createGuestSessionToken: vi.fn().mockReturnValue("plain_token_2"),
      hashGuestSessionToken,
      readGuestSessionTokenFromCookies: vi.fn().mockResolvedValue(null),
      createRequestFingerprintHash: vi.fn().mockResolvedValue("fingerprint_2"),
      detectRequestCountryCode: vi.fn().mockResolvedValue("CA"),
    });

    const created = await createService.ensureGuestSession();

    const reuseService = new SessionService(repository as never, {
      createGuestSessionToken: vi.fn(),
      hashGuestSessionToken,
      readGuestSessionTokenFromCookies: vi.fn().mockResolvedValue(created.cookieToken),
      createRequestFingerprintHash: vi.fn(),
      detectRequestCountryCode: vi.fn(),
    });
    const reused = await reuseService.requireGuestSession();

    expect(created.cookieToken).toBe("plain_token_2");
    expect(created.session.handle).toBe("guest_abcd1234");
    expect(created.session.countryCode).toBe("CA");
    expect(reused.userId).toBe("user_1");
    expect(hashGuestSessionToken).toHaveBeenCalledWith("plain_token_2");
    expect(repository.createGuestUserSession).toHaveBeenCalledWith({
      tokenHash: "hashed:plain_token_2",
      fingerprintHash: "fingerprint_2",
      countryCode: "CA",
    });
    expect(repository.findSessionByTokenHash).toHaveBeenCalledWith("hashed:plain_token_2");
  });

  it("completes onboarding when a detected country is available", async () => {
    const onboardedRow = buildSessionRow({
      profile: {
        age_attested_over_18: true,
        onboarding_completed_at: "2026-04-22T00:05:00.000Z",
        country_code: "US",
      },
    });
    const repository = {
      completeOnboarding: vi.fn().mockResolvedValue(undefined),
      findSessionByTokenHash: vi.fn().mockResolvedValue(onboardedRow),
      touchSession: vi.fn().mockResolvedValue(undefined),
    };
    const service = new SessionService(repository as never, {
      createGuestSessionToken: vi.fn(),
      hashGuestSessionToken: vi.fn().mockReturnValue("hashed_token_1"),
      readGuestSessionTokenFromCookies: vi.fn().mockResolvedValue("plain_token_1"),
      createRequestFingerprintHash: vi.fn(),
      detectRequestCountryCode: vi.fn().mockResolvedValue("US"),
    });

    const updated = await service.completeOnboarding("user_1");

    expect(repository.completeOnboarding).toHaveBeenCalledWith("user_1", { countryCode: "US" });
    expect(updated.onboardingCompleted).toBe(true);
    expect(updated.countryCode).toBe("US");
  });

  it("completes onboarding with a safe null-country fallback when detection fails", async () => {
    const onboardedRow = buildSessionRow({
      profile: {
        age_attested_over_18: true,
        onboarding_completed_at: "2026-04-22T00:05:00.000Z",
        country_code: null,
      },
    });
    const repository = {
      completeOnboarding: vi.fn().mockResolvedValue(undefined),
      findSessionByTokenHash: vi.fn().mockResolvedValue(onboardedRow),
      touchSession: vi.fn().mockResolvedValue(undefined),
    };
    const service = new SessionService(repository as never, {
      createGuestSessionToken: vi.fn(),
      hashGuestSessionToken: vi.fn().mockReturnValue("hashed_token_1"),
      readGuestSessionTokenFromCookies: vi.fn().mockResolvedValue("plain_token_1"),
      createRequestFingerprintHash: vi.fn(),
      detectRequestCountryCode: vi.fn().mockResolvedValue(null),
    });

    const updated = await service.completeOnboarding("user_1");

    expect(repository.completeOnboarding).toHaveBeenCalledWith("user_1", { countryCode: null });
    expect(updated.onboardingCompleted).toBe(true);
    expect(updated.countryCode).toBeNull();
  });

  it("throws a 401 when requireGuestSession is called without a cookie", async () => {
    const repository = {
      findSessionByTokenHash: vi.fn(),
      touchSession: vi.fn(),
    };
    const service = new SessionService(repository as never, {
      createGuestSessionToken: vi.fn(),
      hashGuestSessionToken: vi.fn(),
      readGuestSessionTokenFromCookies: vi.fn().mockResolvedValue(null),
      createRequestFingerprintHash: vi.fn(),
      detectRequestCountryCode: vi.fn(),
    });

    await expect(service.requireGuestSession()).rejects.toMatchObject({
      message: "Guest session is required.",
      statusCode: 401,
    });
  });
});
