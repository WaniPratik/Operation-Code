import type { GuestSessionView } from "@/types/domain";
import {
  createGuestSessionToken,
  hashGuestSessionToken,
  readGuestSessionTokenFromCookies,
} from "@/server/auth/session-cookie";
import {
  createRequestFingerprintHash,
  detectRequestCountryCode,
} from "@/server/auth/request-fingerprint";
import { PlatformRepository } from "@/server/repositories/platform-repository";

interface SessionServiceDeps {
  createGuestSessionToken: () => string;
  hashGuestSessionToken: (token: string) => string;
  readGuestSessionTokenFromCookies: () => Promise<string | null>;
  createRequestFingerprintHash: () => Promise<string | null>;
  detectRequestCountryCode: () => Promise<string | null>;
}

function createStatusError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export class SessionService {
  constructor(
    private readonly repository = new PlatformRepository(),
    private readonly deps: SessionServiceDeps = {
      createGuestSessionToken,
      hashGuestSessionToken,
      readGuestSessionTokenFromCookies,
      createRequestFingerprintHash,
      detectRequestCountryCode,
    },
  ) {}

  private mapSession(row: {
    user:
      | {
          id: string;
          created_at: string;
          last_seen_at: string;
          deleted_at?: string | null;
        }
      | null;
    profile:
      | {
          anonymous_handle: string;
          age_attested_over_18: boolean;
          onboarding_completed_at: string | null;
          country_code: string | null;
          device_fingerprint_hash: string | null;
        }
      | null;
  }): GuestSessionView {
    if (!row.user || !row.profile) {
      throw new Error("Session row missing user or profile.");
    }

    return {
      userId: row.user.id,
      handle: row.profile.anonymous_handle,
      ageConfirmed: row.profile.age_attested_over_18,
      onboardingCompleted: Boolean(row.profile.onboarding_completed_at),
      countryCode: row.profile.country_code,
      fingerprintHash: row.profile.device_fingerprint_hash,
      createdAt: row.user.created_at,
      lastSeenAt: row.user.last_seen_at,
    };
  }

  async ensureGuestSession(): Promise<{
    session: GuestSessionView;
    cookieToken: string | null;
  }> {
    const token = await this.deps.readGuestSessionTokenFromCookies();

    if (token) {
      const session = await this.repository.findSessionByTokenHash(
        this.deps.hashGuestSessionToken(token),
      );

      if (session?.user && session.profile) {
        await this.repository.touchSession(session.id, session.user.id);
        return {
          session: this.mapSession(session),
          cookieToken: null,
        };
      }
    }

    const createdToken = this.deps.createGuestSessionToken();
    const [fingerprintHash, detectedCountryCode] = await Promise.all([
      this.deps.createRequestFingerprintHash(),
      this.deps.detectRequestCountryCode(),
    ]);

    const session = await this.repository.createGuestUserSession({
      tokenHash: this.deps.hashGuestSessionToken(createdToken),
      fingerprintHash,
      countryCode: detectedCountryCode,
    });

    return {
      session: this.mapSession(session),
      cookieToken: createdToken,
    };
  }

  async requireGuestSession() {
    const token = await this.deps.readGuestSessionTokenFromCookies();

    if (!token) {
      throw createStatusError("Guest session is required.", 401);
    }

    const session = await this.repository.findSessionByTokenHash(
      this.deps.hashGuestSessionToken(token),
    );

    if (!session?.user || !session.profile) {
      throw createStatusError("Guest session is invalid.", 401);
    }

    await this.repository.touchSession(session.id, session.user.id);

    return this.mapSession(session);
  }

  async completeOnboarding(userId: string) {
    const detectedCountryCode = await this.deps.detectRequestCountryCode();

    await this.repository.completeOnboarding(userId, {
      countryCode: detectedCountryCode,
    });
    return this.requireGuestSession();
  }
}
