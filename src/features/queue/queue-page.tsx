"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CountryFilterPicker } from "@/components/ui/country-filter-picker";
import { FeedbackPrompt } from "@/components/ui/feedback-prompt";
import { Notice } from "@/components/ui/notice";
import {
  apiDelete,
  apiGet,
  apiPost,
  isSessionExpiredError,
  sendBestEffortApiRequest,
} from "@/lib/client/api";
import { useGuestSession } from "@/features/session/guest-session-provider";
import {
  getConnectingSecondsRemaining,
  getQueuePollIntervalMs,
  getQueueUiStatus,
} from "@/features/queue/queue-live-state";
import type { QueueStatusView } from "@/types/domain";

export function QueuePage() {
  const router = useRouter();
  const {
    session,
    loading: sessionLoading,
    error: sessionError,
    sessionExpired,
    restartSession,
  } = useGuestSession();
  const [queue, setQueue] = useState<QueueStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [liveUpdateError, setLiveUpdateError] = useState<string | null>(null);
  const [queueSessionExpired, setQueueSessionExpired] = useState(false);
  const [preferredCountries, setPreferredCountries] = useState<string[]>([]);
  const [excludedCountries, setExcludedCountries] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [isDocumentVisible, setIsDocumentVisible] = useState(true);
  const cleanupQueueEntryIdRef = useRef<string | null>(null);

  async function loadQueueState(options?: { background?: boolean }) {
    const isBackground = options?.background ?? false;

    if (!isBackground) {
      setLoading(true);
      setError(null);
    }

    try {
      const payload = await apiGet<{ queue: QueueStatusView }>("/api/queue");
      setQueue(payload.queue);
      setPreferredCountries(payload.queue.filters.preferredCountries);
      setExcludedCountries(payload.queue.filters.excludedCountries);
      setLiveUpdateError(null);
      setQueueSessionExpired(false);
      setError(null);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to load queue.";

      if (isSessionExpiredError(caughtError)) {
        setQueueSessionExpired(true);
        setQueue(null);
        setLiveUpdateError(null);
        setError(message);
        return;
      }

      if (isBackground) {
        setLiveUpdateError(message);
      } else {
        setError(message);
      }
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    if (!sessionLoading) {
      void loadQueueState();
    }
  }, [sessionLoading]);

  useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    const handleVisibilityChange = () => {
      setIsDocumentVisible(document.visibilityState === "visible");
    };

    handleVisibilityChange();
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  const queueUiStatus = useMemo(() => getQueueUiStatus(queue, now), [queue, now]);
  const connectingSecondsRemaining = useMemo(
    () => getConnectingSecondsRemaining(queue, now),
    [queue, now],
  );
  const needsSessionRecovery = sessionExpired || queueSessionExpired;

  useEffect(() => {
    const intervalMs = getQueuePollIntervalMs(queue, isDocumentVisible, now);

    if (!intervalMs || needsSessionRecovery) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadQueueState({ background: true });
    }, intervalMs);

    return () => window.clearInterval(interval);
  }, [isDocumentVisible, needsSessionRecovery, now, queue]);

  useEffect(() => {
    if (queueUiStatus !== "connecting") {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [queueUiStatus]);

  useEffect(() => {
    if (queueUiStatus !== "matched") {
      return;
    }

    router.push("/match");
  }, [queueUiStatus, router]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const activeQueueEntryId = queueUiStatus === "queued" ? queue?.queueEntryId : null;

    const handlePageHide = () => {
      if (!activeQueueEntryId || needsSessionRecovery || activeQueueEntryId === cleanupQueueEntryIdRef.current) {
        return;
      }

      cleanupQueueEntryIdRef.current = activeQueueEntryId;
      sendBestEffortApiRequest("/api/queue", { method: "DELETE" });
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [needsSessionRecovery, queue?.queueEntryId, queueUiStatus]);

  const canJoin =
    Boolean(session?.onboardingCompleted) &&
    queueUiStatus !== "queued" &&
    queueUiStatus !== "connecting" &&
    !needsSessionRecovery;
  const canLeave = Boolean(queue) && queueUiStatus === "queued" && !needsSessionRecovery;

  function toggleFilter(
    current: string[],
    setter: (next: string[]) => void,
    countryCode: string,
  ) {
    setter(
      current.includes(countryCode)
        ? current.filter((value) => value !== countryCode)
        : [...current, countryCode],
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="space-y-6 p-6 sm:p-8">
        <div className="space-y-3 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/72">Queue</p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            {queueUiStatus === "connecting" ? "Bridging..." : "Finding your match..."}
          </h1>
          <p className="mx-auto max-w-md text-base leading-7 text-ink/70">
            {queueUiStatus === "connecting"
              ? "Almost there."
              : "Stay here and we’ll move you into voice automatically."}
          </p>
        </div>

        {loading && !queue ? (
          <Notice title="Loading queue status" tone="info">
            We are checking whether you already have an active queue entry or match.
          </Notice>
        ) : null}

        {needsSessionRecovery ? (
          <Notice title="Guest session expired" tone="warning">
            Your guest session expired or could not be verified. Start a fresh session to continue.
            <div className="mt-3">
              <Button
                variant="ghost"
                disabled={submitting}
                className="w-full sm:w-auto"
                onClick={async () => {
                  setSubmitting(true);
                  setError(null);
                  try {
                    await restartSession();
                    setQueueSessionExpired(false);
                    router.push("/onboarding");
                  } catch (caughtError) {
                    setError(
                      caughtError instanceof Error
                        ? caughtError.message
                        : "Unable to start a fresh guest session.",
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                Start a fresh session
              </Button>
            </div>
          </Notice>
        ) : null}

        {!sessionLoading && !session ? (
          <Notice title="Guest session unavailable" tone="warning">
            {sessionError ?? "We could not restore your guest session."}
          </Notice>
        ) : null}

        {error && !needsSessionRecovery ? (
          <div className="space-y-4">
            <Notice title="Queue update failed" tone="warning">
              {error}
              <div className="mt-3">
                <Button variant="ghost" className="w-full sm:w-auto" onClick={() => void loadQueueState()}>
                  Try Again
                </Button>
              </div>
            </Notice>
            <FeedbackPrompt defaultType="matching issue" label="Tell us what happened" />
          </div>
        ) : null}

        {liveUpdateError ? (
          <div className="space-y-4">
            <Notice title="Connection dropped." tone="warning">
              Live updates paused for a moment. We’re still retrying in the background.
              <div className="mt-3">
                <Button
                  variant="ghost"
                  className="w-full sm:w-auto"
                  onClick={() => void loadQueueState({ background: true })}
                >
                  Try Again
                </Button>
              </div>
            </Notice>
            <FeedbackPrompt defaultType="matching issue" label="Tell us what happened" />
          </div>
        ) : null}

        {!session?.onboardingCompleted ? (
          <div className="space-y-4">
            <Notice title="Finish onboarding first" tone="warning">
              Complete the 18+ confirmation step before joining the queue.
            </Notice>
            <Button className="w-full" onClick={() => router.push("/onboarding")}>
              Jump In
            </Button>
          </div>
        ) : null}

        {queueUiStatus === "idle" && session?.onboardingCompleted ? (
          <div className="space-y-5">
            <details className="rounded-[1.75rem] border border-line bg-white/70 p-5 text-sm text-ink/68">
              <summary className="cursor-pointer list-none font-medium text-ink/78">
                Optional country filters
              </summary>
              <div className="mt-4 space-y-5">
                <CountryFilterPicker
                  label="Preferred countries"
                  selected={preferredCountries}
                  disabledCodes={excludedCountries}
                  onToggle={(countryCode) =>
                    toggleFilter(preferredCountries, setPreferredCountries, countryCode)
                  }
                />
                <CountryFilterPicker
                  label="Excluded countries"
                  selected={excludedCountries}
                  disabledCodes={preferredCountries}
                  onToggle={(countryCode) =>
                    toggleFilter(excludedCountries, setExcludedCountries, countryCode)
                  }
                />
              </div>
            </details>

            <Button
              className="w-full"
              disabled={!canJoin || submitting}
              onClick={async () => {
                setSubmitting(true);
                setError(null);

                try {
                  const payload = await apiPost<{ queue: QueueStatusView }>("/api/queue", {
                    preferredCountries,
                    excludedCountries,
                  });
                  setQueue(payload.queue);
                  setQueueSessionExpired(false);
                  setLiveUpdateError(null);
                } catch (caughtError) {
                  if (isSessionExpiredError(caughtError)) {
                    setQueueSessionExpired(true);
                  }

                  setError(caughtError instanceof Error ? caughtError.message : "Unable to join queue.");
                } finally {
                  setSubmitting(false);
                }
              }}
            >
              {submitting ? "Joining..." : "Jump In"}
            </Button>
          </div>
        ) : null}

        {queueUiStatus === "queued" ? (
          <div className="space-y-5 text-center">
            <div className="rounded-[1.75rem] border border-line bg-white/70 px-6 py-8 sm:px-8">
              <div className="mx-auto flex w-fit items-center gap-3 rounded-full bg-sand/70 px-4 py-2 text-sm text-ink/68">
                <span className="inline-flex size-2.5 rounded-full bg-ember animate-pulse" />
                Live queue is active
              </div>
              <p className="mt-6 font-heading text-3xl font-semibold text-ink sm:text-4xl">
                Finding your match...
              </p>
              <p className="mt-3 text-sm leading-7 text-ink/68">
                Keep this screen open. We’ll move you forward automatically.
              </p>
            </div>

            <Button
              variant="ghost"
              className="w-full"
              onClick={async () => {
                setSubmitting(true);
                setError(null);

                try {
                  const payload = await apiDelete<{ queue: QueueStatusView }>("/api/queue");
                  setQueue(payload.queue);
                  setQueueSessionExpired(false);
                  setLiveUpdateError(null);
                } catch (caughtError) {
                  if (isSessionExpiredError(caughtError)) {
                    setQueueSessionExpired(true);
                  }

                  setError(caughtError instanceof Error ? caughtError.message : "Unable to leave queue.");
                } finally {
                  setSubmitting(false);
                }
              }}
              disabled={!canLeave || submitting}
            >
              Leave Queue
            </Button>
          </div>
        ) : null}

        {queueUiStatus === "connecting" && queue?.activeMatch ? (
          <div className="rounded-[1.75rem] border border-line bg-white/70 px-6 py-8 text-center sm:px-8">
            <div className="mx-auto flex w-fit items-center gap-3 rounded-full bg-sand/70 px-4 py-2 text-sm text-ink/68">
              <span className="inline-flex size-2.5 rounded-full bg-mint animate-pulse" />
              Match ready
            </div>
            <p className="mt-6 font-heading text-3xl font-semibold text-ink sm:text-4xl">Bridging...</p>
            <p className="mt-3 text-sm leading-7 text-ink/68">Almost there.</p>
            <p className="mt-2 text-sm text-ink/68">{queue.activeMatch.counterpart.handle}</p>
            <p className="mt-6 font-heading text-5xl font-semibold text-ink">{connectingSecondsRemaining}</p>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
