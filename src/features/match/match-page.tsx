"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Notice } from "@/components/ui/notice";
import {
  apiGet,
  apiPost,
  isSessionExpiredError,
  sendBestEffortApiRequest,
} from "@/lib/client/api";
import type { QueueStatusView } from "@/types/domain";
import { LiveVoiceRoom } from "@/features/match/live-voice-room";
import { useGuestSession } from "@/features/session/guest-session-provider";

export function MatchPage() {
  const router = useRouter();
  const { restartSession } = useGuestSession();
  const [queue, setQueue] = useState<QueueStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorTitle, setErrorTitle] = useState("Match update failed");
  const [liveUpdateError, setLiveUpdateError] = useState<string | null>(null);
  const [sessionRecoveryNeeded, setSessionRecoveryNeeded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [now, setNow] = useState(Date.now());
  const cleanupMatchIdRef = useRef<string | null>(null);

  async function loadMatchState(options?: { background?: boolean }) {
    const isBackground = options?.background ?? false;

    if (!isBackground) {
      setLoading(true);
      setError(null);
      setErrorTitle("Match update failed");
    }

    try {
      const payload = await apiGet<{ queue: QueueStatusView }>("/api/match");
      setQueue(payload.queue);
      setSessionRecoveryNeeded(false);
      setLiveUpdateError(null);
      setError(null);
    } catch (caughtError) {
      const message = caughtError instanceof Error ? caughtError.message : "Unable to fetch match state.";
      const needsSessionRestart = isSessionExpiredError(caughtError);

      setSessionRecoveryNeeded(needsSessionRestart);

      if (needsSessionRestart || !isBackground) {
        setErrorTitle("Match update failed");
        setError(message);
        setLiveUpdateError(null);
        return;
      }

      setLiveUpdateError(message);
    } finally {
      if (!isBackground) {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    void loadMatchState();
  }, []);

  useEffect(() => {
    if (queue?.activeMatch?.status !== "matched" || sessionRecoveryNeeded) {
      return;
    }

    const interval = window.setInterval(() => {
      void loadMatchState({ background: true });
    }, 3000);

    return () => window.clearInterval(interval);
  }, [queue?.activeMatch?.status, sessionRecoveryNeeded]);

  useEffect(() => {
    if (queue?.activeMatch?.status !== "matched") {
      return;
    }

    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, [queue?.activeMatch?.status]);

  const currentMatch = queue?.activeMatch;
  const preConnectionSecondsRemaining = useMemo(() => {
    if (!currentMatch) {
      return 0;
    }

    const elapsed = Math.floor((now - Date.parse(currentMatch.matchedAt)) / 1000);
    return Math.max(0, currentMatch.preConnectionSeconds - elapsed);
  }, [currentMatch, now]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const activeMatchId = currentMatch?.status === "matched" ? currentMatch.matchId : null;

    const handlePageHide = () => {
      if (!activeMatchId || sessionRecoveryNeeded || activeMatchId === cleanupMatchIdRef.current) {
        return;
      }

      cleanupMatchIdRef.current = activeMatchId;
      sendBestEffortApiRequest("/api/match/end", {
        method: "POST",
        body: {
          matchId: activeMatchId,
          reason: "disconnect",
        },
      });
    };

    window.addEventListener("pagehide", handlePageHide);

    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [currentMatch, sessionRecoveryNeeded]);

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="space-y-6 p-6 sm:p-8">
        <div className="space-y-3 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-ember">Live voice</p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            You’re live.
          </h1>
          <p className="mx-auto max-w-md text-base leading-7 text-ink/70">
            {currentMatch
              ? preConnectionSecondsRemaining > 0
                ? "Almost there."
                : "Say hello when the room opens."
              : "We’ll send you back cleanly if this session is no longer active."}
          </p>
        </div>

        {loading && !queue ? (
          <Notice title="Checking your match" tone="info">
            We are verifying whether you still have an active session before opening voice.
          </Notice>
        ) : null}

        {sessionRecoveryNeeded ? (
          <Notice title="Guest session expired" tone="warning">
            Your guest session expired or could not be verified. Start a fresh guest session to continue.
            <div className="mt-3">
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await restartSession();
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

        {error && !sessionRecoveryNeeded ? (
          <Notice title={errorTitle} tone="warning">
            {error}
            <div className="mt-3">
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => void loadMatchState()}>
                Try Again
              </Button>
            </div>
          </Notice>
        ) : null}

        {liveUpdateError ? (
          <Notice title="Connection dropped." tone="warning">
            We lost live updates for a moment. Your session may still be active, and we’re retrying now.
            <div className="mt-3">
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={() => void loadMatchState({ background: true })}
              >
                Try Again
              </Button>
            </div>
          </Notice>
        ) : null}

        {currentMatch && currentMatch.status === "matched" ? (
          <>
            <p className="text-center text-sm text-ink/58">Matched with {currentMatch.counterpart.handle}</p>

            <LiveVoiceRoom
              match={currentMatch}
              preConnectionSecondsRemaining={preConnectionSecondsRemaining}
            />

            <div className="space-y-3">
              <Button
                className="w-full"
                disabled={submitting}
                onClick={async () => {
                  if (!currentMatch) {
                    return;
                  }

                  setSubmitting(true);
                  setError(null);
                  setErrorTitle("Match update failed");

                  try {
                    const payload = await apiPost<{ queue: QueueStatusView }>("/api/match/end", {
                      matchId: currentMatch.matchId,
                      reason: "user_end",
                    });
                    setQueue(payload.queue);
                    setLiveUpdateError(null);
                    setSessionRecoveryNeeded(false);
                  } catch (caughtError) {
                    setErrorTitle("End session failed");
                    setError(caughtError instanceof Error ? caughtError.message : "Unable to end match.");
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                End session
              </Button>
              <Link
                href="/session/complete"
                className="inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-ink/68 transition duration-150 hover:bg-sand/70 hover:text-ink active:translate-y-px active:scale-[0.99]"
              >
                Safety tools
              </Link>
            </div>
          </>
        ) : queue?.recentMatch?.status === "ended" ? (
          <div className="space-y-4">
            <Notice title="That session has ended" tone="info">
              You can head back to the queue or open the safety tools if needed.
            </Notice>
            <Button className="w-full" onClick={() => router.push("/queue")}>
              Back to queue
            </Button>
            <Link
              href="/session/complete"
              className="inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-ink/68 transition duration-150 hover:bg-sand/70 hover:text-ink active:translate-y-px active:scale-[0.99]"
            >
              Safety tools
            </Link>
          </div>
        ) : !loading ? (
          <div className="space-y-4">
            <Notice title="No active match" tone="warning">
              There is no live match to open right now.
            </Notice>
            <Button className="w-full" onClick={() => router.push("/queue")}>
              Back to queue
            </Button>
          </div>
        ) : null}
      </Card>
    </div>
  );
}
