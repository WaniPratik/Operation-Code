"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FeedbackPrompt } from "@/components/ui/feedback-prompt";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { apiGet, apiPost, isSessionExpiredError } from "@/lib/client/api";
import { REPORT_REASONS } from "@/lib/constants";
import { useGuestSession } from "@/features/session/guest-session-provider";
import type { QueueStatusView, ReportView } from "@/types/domain";

interface ConfirmationState {
  title: string;
  message: string;
  tone: "info" | "warning";
}

export function PostSessionPage() {
  const { restartSession } = useGuestSession();
  const [queue, setQueue] = useState<QueueStatusView | null>(null);
  const [loading, setLoading] = useState(true);
  const [sessionRecoveryNeeded, setSessionRecoveryNeeded] = useState(false);
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [confirmation, setConfirmation] = useState<ConfirmationState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadPostSessionState() {
    setLoading(true);
    setError(null);

    try {
      const payload = await apiGet<{ queue: QueueStatusView }>("/api/match");
      setQueue(payload.queue);
      setSessionRecoveryNeeded(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Unable to load post-session state.");
      setSessionRecoveryNeeded(isSessionExpiredError(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPostSessionState();
  }, []);

  const recentMatch = queue?.recentMatch;
  const isLiveModeration = recentMatch?.status === "matched";
  const reasonError = !reason && error === "Select a report reason first." ? error : undefined;
  const detailError = details.trim().length > 400 ? "Details must be 400 characters or fewer." : undefined;

  async function startNewCall() {
    await apiPost<{ queue: QueueStatusView }>("/api/queue", {
      preferredCountries: queue?.filters.preferredCountries ?? [],
      excludedCountries: queue?.filters.excludedCountries ?? [],
    });
    window.location.href = "/queue";
  }

  return (
    <div className="mx-auto max-w-2xl">
      <Card className="space-y-6 p-6 sm:p-8">
        <div className="space-y-3 text-center">
          <p className="font-mono text-xs uppercase tracking-[0.24em] text-ink/72">Session ended</p>
          <h1 className="font-heading text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
            Talk again?
          </h1>
          <p className="mx-auto max-w-md text-base leading-7 text-ink/70">That session has ended.</p>
        </div>

        {loading ? (
          <Notice title="Loading session history" tone="info">
            We are checking your most recent match so the safety tools stay linked to the right conversation.
          </Notice>
        ) : null}

        {sessionRecoveryNeeded ? (
          <Notice title="Guest session expired" tone="warning">
            Your guest session expired before we could load this screen. Start a fresh guest session to continue.
            <div className="mt-3">
              <Button
                variant="ghost"
                className="w-full sm:w-auto"
                onClick={async () => {
                  setSubmitting(true);
                  try {
                    await restartSession();
                    window.location.href = "/onboarding";
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

        {confirmation ? (
          <Notice title={confirmation.title} tone={confirmation.tone}>
            {confirmation.message}
          </Notice>
        ) : recentMatch ? (
          <div className="space-y-4 rounded-[1.75rem] border border-line bg-white/70 p-5">
            {isLiveModeration ? (
              <Notice title="This ends the call immediately" tone="warning">
                Safety actions disconnect both sides right away.
              </Notice>
            ) : null}

            <Field label="Report reason" error={reasonError}>
              <Select
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                error={Boolean(reasonError)}
              >
                <option value="">Select a reason</option>
                {REPORT_REASONS.map((reportReason) => (
                  <option key={reportReason} value={reportReason}>
                    {reportReason}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label="Additional notes"
              hint="Optional"
              error={detailError}
            >
              <Textarea
                value={details}
                onChange={(event) => setDetails(event.target.value)}
                error={Boolean(detailError)}
                placeholder="Add context if it helps."
              />
            </Field>

            {error ? (
              <Notice title="We still need one detail" tone="warning">
                {error}
              </Notice>
            ) : null}

            <div className="flex flex-col gap-3">
              <Button
                variant="ghost"
                className="w-full"
                disabled={submitting}
                onClick={async () => {
                  if (!recentMatch || !reason) {
                    setError("Select a report reason first.");
                    return;
                  }

                  if (detailError) {
                    setError(detailError);
                    return;
                  }

                  setSubmitting(true);
                  setError(null);
                  setConfirmation(null);

                  const wasLiveSession = recentMatch.status === "matched";

                  try {
                    await apiPost<{ report: ReportView }>("/api/report", {
                      matchId: recentMatch.matchId,
                      reason,
                      details,
                    });
                    setConfirmation({
                      title: wasLiveSession ? "Report submitted and session ended" : "Report submitted",
                      tone: wasLiveSession ? "warning" : "info",
                      message: wasLiveSession
                        ? "Your report was saved. Finding the next voice now."
                        : "Your report was saved. Finding the next voice now.",
                    });
                    await loadPostSessionState();
                    await startNewCall();
                  } catch (caughtError) {
                    setError(
                      caughtError instanceof Error
                        ? caughtError.message
                        : "Your report was saved, but we could not start the next search yet.",
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                Report & Skip
              </Button>
              <Button
                variant="ghost"
                className="w-full"
                disabled={submitting}
                onClick={async () => {
                  if (!recentMatch) {
                    return;
                  }

                  setSubmitting(true);
                  setError(null);
                  setConfirmation(null);

                  const wasLiveSession = recentMatch.status === "matched";

                  try {
                    await apiPost("/api/block", {
                      matchId: recentMatch.matchId,
                    });
                    setConfirmation({
                      title: "User blocked. You won't be matched again.",
                      tone: "warning",
                      message: wasLiveSession
                        ? "The live session ended and the block was saved. Finding the next voice now."
                        : "The block was saved. Finding the next voice now.",
                    });
                    await loadPostSessionState();
                    await startNewCall();
                  } catch (caughtError) {
                    setError(
                      caughtError instanceof Error
                        ? caughtError.message
                        : "The block was saved, but we could not start the next search yet.",
                    );
                  } finally {
                    setSubmitting(false);
                  }
                }}
              >
                {isLiveModeration ? "Block user and end session" : "Block this user"}
              </Button>
            </div>
          </div>
        ) : !loading ? (
          <Notice title="Nothing to review" tone="info">
            There is no recent session linked to this guest right now.
          </Notice>
        ) : null}

        <div className="space-y-3">
          <Button
            className="w-full"
            disabled={submitting}
            onClick={async () => {
              setSubmitting(true);
              setError(null);

              try {
                await startNewCall();
              } catch (caughtError) {
                setError(caughtError instanceof Error ? caughtError.message : "Unable to start a new call yet.");
              } finally {
                setSubmitting(false);
              }
            }}
          >
            Start New Call
          </Button>
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center rounded-full px-5 py-3 text-sm font-medium text-ink/68 transition duration-150 hover:bg-sand/70 hover:text-ink active:translate-y-px active:scale-[0.99]"
          >
            Home
          </Link>
        </div>

        <FeedbackPrompt matchId={recentMatch?.matchId ?? null} defaultType="suggestion" />
      </Card>
    </div>
  );
}
