"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import { apiPost, isSessionExpiredError } from "@/lib/client/api";
import { COUNTRY_OPTIONS, MINIMUM_AGE } from "@/lib/constants";
import { useGuestSession } from "@/features/session/guest-session-provider";
import type { GuestSessionView } from "@/types/domain";

export function OnboardingPage() {
  const router = useRouter();
  const {
    session,
    loading,
    error: sessionError,
    sessionExpired,
    ensureSession,
    refreshSession,
    restartSession,
  } = useGuestSession();
  const [ageConfirmed, setAgeConfirmed] = useState(Boolean(session?.ageConfirmed));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setAgeConfirmed(Boolean(session?.ageConfirmed));
  }, [session?.ageConfirmed]);

  useEffect(() => {
    if (!loading && session?.onboardingCompleted && !submitting) {
      router.replace("/queue");
    }
  }, [loading, router, session?.onboardingCompleted, submitting]);

  const detectedCountryLabel = useMemo(() => {
    if (!session?.countryCode) {
      return "Unavailable";
    }

    return (
      COUNTRY_OPTIONS.find((country) => country.code === session.countryCode)?.name ??
      session.countryCode
    );
  }, [session?.countryCode]);

  const needsSessionRecovery = sessionExpired || (!loading && !session);
  const onboardingComplete = Boolean(session?.onboardingCompleted);

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="space-y-6 p-6 sm:p-8">
        <div className="space-y-3 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/72">
            Echotalk.live
          </p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Talk freely.
          </h1>
          <p className="mx-auto max-w-md text-base leading-7 text-ink/72">
            Anonymous voice chat. No sign-up.
          </p>
        </div>

        {loading && !session ? (
          <Notice title="Setting up your guest access" tone="info">
            We are creating or restoring your private guest session now.
          </Notice>
        ) : null}

        {needsSessionRecovery ? (
          <Notice title="Guest session needs a fresh start" tone="warning">
            {sessionExpired
              ? "Your guest session expired or could not be verified. Start a fresh session to continue."
              : sessionError ?? "We could not prepare a guest session right now."}
            <div className="mt-3">
              <Button
                variant="ghost"
                disabled={loading || submitting}
                onClick={async () => {
                  setError(null);
                  try {
                    await restartSession();
                  } catch (caughtError) {
                    setError(
                      caughtError instanceof Error
                        ? caughtError.message
                        : "Unable to start a fresh guest session.",
                    );
                  }
                }}
                className="w-full sm:w-auto"
              >
                Start a fresh session
              </Button>
            </div>
          </Notice>
        ) : null}

        {!onboardingComplete ? (
          <>
            <div className="space-y-4 rounded-[1.75rem] border border-line bg-sand/35 p-5">
              <p className="text-sm leading-7 text-ink/72">
                Confirm {MINIMUM_AGE}+ once and we’ll move you straight into the queue.
              </p>
              <p className="text-sm text-ink/68">Detected region: {loading ? "Checking..." : detectedCountryLabel}</p>
              <label className="flex items-start gap-3 text-sm leading-7 text-ink/82">
                <input
                  type="checkbox"
                  checked={ageConfirmed}
                  onChange={(event) => setAgeConfirmed(event.target.checked)}
                  className="mt-1 size-4 rounded border-line accent-ember"
                />
                <span>I confirm that I am {MINIMUM_AGE} or older.</span>
              </label>
            </div>

            {error ? (
              <Notice title="We still need one step" tone="warning">
                {error}
              </Notice>
            ) : null}

            <Button
              className="w-full"
              disabled={loading || submitting || needsSessionRecovery}
              onClick={async () => {
                if (!ageConfirmed) {
                  setError("You must confirm you are 18 or older to continue.");
                  return;
                }

                setSubmitting(true);
                setError(null);

                try {
                  if (!session) {
                    await ensureSession();
                  }

                  await apiPost<{ session: GuestSessionView }>("/api/session/onboarding", {
                    ageConfirmed,
                  });
                  await refreshSession();
                  router.push("/queue");
                } catch (caughtError) {
                  if (isSessionExpiredError(caughtError)) {
                    setError(
                      "Your guest session expired before onboarding finished. Start a fresh session and try again.",
                    );
                    return;
                  }

                  setError(
                    caughtError instanceof Error
                      ? caughtError.message
                      : "Unable to complete onboarding.",
                  );
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? "Jumping in..." : "Jump In"}
            </Button>
          </>
        ) : (
          <Notice title="Opening queue" tone="info">
            Your guest session is ready. Taking you straight to the queue.
          </Notice>
        )}
      </Card>
    </div>
  );
}
