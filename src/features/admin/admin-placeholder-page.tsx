"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Notice } from "@/components/ui/notice";
import { SectionHeading } from "@/components/ui/section-heading";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  apiDelete,
  apiGet,
  apiPost,
  isAdminSessionExpiredError,
} from "@/lib/client/api";
import type {
  AdminBlockView,
  AdminMatchView,
  AdminReportView,
  AdminUserView,
  AnalyticsSummaryView,
  AuditEventView,
  FeedbackView,
} from "@/types/domain";

interface AdminPayload {
  reports: AdminReportView[];
  matches: AdminMatchView[];
  users: AdminUserView[];
  blocks: AdminBlockView[];
  auditLogs: AuditEventView[];
  feedback: FeedbackView[];
  analytics: AnalyticsSummaryView[];
}

function formatDate(value: string | null) {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString();
}

function getLinkedMatchTone(status: "matched" | "ended" | null) {
  if (status === "ended") {
    return "success" as const;
  }

  if (status === "matched") {
    return "warning" as const;
  }

  return "neutral" as const;
}

function UserSummary({ user }: { user: AdminUserView }) {
  return (
    <div className="rounded-2xl border border-line/80 bg-white/80 p-3 text-sm">
      <p className="font-medium text-ink">{user.handle}</p>
      <p className="mt-1 font-mono text-xs text-ink/60">{user.userId}</p>
      <p className="mt-2 text-ink/72">{user.countryCode ?? "Country unavailable"}</p>
      <p className="text-ink/60">{user.ageConfirmed ? "18+ attested" : "18+ not attested"}</p>
    </div>
  );
}

export function AdminPlaceholderPage() {
  const [userId, setUserId] = useState("");
  const [eventType, setEventType] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [expandedReportId, setExpandedReportId] = useState<string | null>(null);
  const [data, setData] = useState<AdminPayload>({
    reports: [],
    matches: [],
    users: [],
    blocks: [],
    auditLogs: [],
    feedback: [],
    analytics: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sessionExpired, setSessionExpired] = useState(false);
  const [endingMatchId, setEndingMatchId] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  async function loadAdminDashboard() {
    setLoading(true);
    setError(null);

    try {
      const query = new URLSearchParams();

      if (userId) {
        query.set("userId", userId);
      }

      if (eventType) {
        query.set("type", eventType);
      }

      if (dateFrom) {
        query.set("dateFrom", `${dateFrom}T00:00:00.000Z`);
      }

      if (dateTo) {
        query.set("dateTo", `${dateTo}T23:59:59.999Z`);
      }

      const suffix = query.toString() ? `?${query.toString()}` : "";

      const [reports, matches, users, blocks, auditLogs, feedback, analytics] = await Promise.all([
        apiGet<{ reports: AdminReportView[] }>(`/api/admin/reports${suffix}`),
        apiGet<{ matches: AdminMatchView[] }>(`/api/admin/matches${suffix}`),
        apiGet<{ users: AdminUserView[] }>(`/api/admin/users${suffix}`),
        apiGet<{ blocks: AdminBlockView[] }>(`/api/admin/blocks${suffix}`),
        apiGet<{ auditLogs: AuditEventView[] }>(`/api/admin/audit-logs${suffix}`),
        apiGet<{ feedback: FeedbackView[] }>(`/api/admin/feedback${suffix}`),
        apiGet<{ analytics: AnalyticsSummaryView[] }>(`/api/admin/analytics${suffix}`),
      ]);

      setData({
        reports: reports.reports,
        matches: matches.matches,
        users: users.users,
        blocks: blocks.blocks,
        auditLogs: auditLogs.auditLogs,
        feedback: feedback.feedback,
        analytics: analytics.analytics,
      });
      setSessionExpired(false);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Something went wrong on our end.");
      setSessionExpired(isAdminSessionExpiredError(caughtError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAdminDashboard();
  }, []);

  const activeMatches = useMemo(
    () => data.matches.filter((match) => match.status === "matched"),
    [data.matches],
  );
  const endedMatches = useMemo(
    () => data.matches.filter((match) => match.status === "ended").slice(0, 12),
    [data.matches],
  );
  const allSectionsEmpty =
    !loading &&
    data.reports.length === 0 &&
    data.matches.length === 0 &&
    data.users.length === 0 &&
    data.blocks.length === 0 &&
    data.feedback.length === 0 &&
    data.analytics.length === 0 &&
    data.auditLogs.length === 0;

  return (
    <div className="space-y-6">
      <Card className="space-y-6 p-6 sm:p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <SectionHeading
            eyebrow="Admin dashboard"
            title="Echotalk.live moderation"
            description="This internal dashboard gives the founder a readable view of live matches, reports, blocks, feedback, analytics, and audit history without changing the core user flow for beta testers."
          />
          <div className="flex flex-wrap gap-2">
            <StatusBadge tone="success">Protected admin session</StatusBadge>
            <StatusBadge tone="warning">No RBAC yet</StatusBadge>
          </div>
        </div>

        <Notice title="MVP guardrails" tone="info">
          This is intentionally a lightweight founder control panel. It supports live intervention and linked review data, but it is not yet a full moderation workspace.
        </Notice>

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button variant="secondary" onClick={() => void loadAdminDashboard()} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh dashboard"}
          </Button>
          <Button
            variant="secondary"
            disabled={loggingOut}
            onClick={async () => {
              setLoggingOut(true);
              try {
                await apiDelete<{ authenticated: boolean }>("/api/admin/session");
                window.location.reload();
              } catch (caughtError) {
                setError(
                  caughtError instanceof Error ? caughtError.message : "Unable to sign out of admin.",
                );
              } finally {
                setLoggingOut(false);
              }
            }}
          >
            {loggingOut ? "Signing out..." : "Sign out"}
          </Button>
        </div>
      </Card>

      <Card className="space-y-4 p-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Filters</p>
        <div className="grid gap-3 md:grid-cols-5">
          <Input
            value={userId}
            onChange={(event) => setUserId(event.target.value)}
            placeholder="Filter by user ID"
          />
          <Input
            value={eventType}
            onChange={(event) => setEventType(event.target.value)}
            placeholder="Audit event type"
          />
          <Input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <Input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
          <Button variant="secondary" onClick={() => void loadAdminDashboard()} disabled={loading}>
            Apply filters
          </Button>
        </div>
        {error && !sessionExpired ? (
          <Notice title="Something went wrong on our end." tone="warning">
            {error}
            <div className="mt-3">
              <Button variant="secondary" onClick={() => void loadAdminDashboard()} disabled={loading}>
                Retry refresh
              </Button>
            </div>
          </Notice>
        ) : null}
      </Card>

      {loading ? (
        <Notice title="Just a second..." tone="info">
          We are fetching live matches, recent reports, blocks, users, and audit events now.
        </Notice>
      ) : null}

      {sessionExpired ? (
        <Notice title="Admin session expired" tone="warning">
          Your admin session expired while the dashboard was open. Reload /admin and sign in again to keep working.
          <div className="mt-3">
            <Button variant="secondary" onClick={() => window.location.reload()}>
              Reload admin sign-in
            </Button>
          </div>
        </Notice>
      ) : null}

      {allSectionsEmpty ? (
        <Notice title="Nothing here yet." tone="info">
          The dashboard is working, but there is no beta activity for the current filter yet. Run through onboarding, queue, voice, and report flows to populate it.
        </Notice>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 p-6">
          <Notice title="Live-session moderation visibility" tone="info">
            Reports and blocks submitted during a live call should also show a linked ended match reason here, so you can confirm the session was cut off immediately.
          </Notice>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Active matches</p>
            <StatusBadge tone={activeMatches.length > 0 ? "warning" : "neutral"}>
              {activeMatches.length} live
            </StatusBadge>
          </div>
          <div className="space-y-4 text-sm">
            {activeMatches.length === 0 ? (
              <p className="text-ink/60">Nothing here yet.</p>
            ) : (
              activeMatches.map((match) => {
                const isExpanded = expandedMatchId === match.matchId;
                return (
                  <div key={match.matchId} className="rounded-3xl bg-sand/45 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div className="space-y-2">
                        <p className="font-medium">
                          {match.userA.handle} ↔ {match.userB.handle}
                        </p>
                        <p className="font-mono text-xs text-ink/60">{match.matchId}</p>
                        <p className="text-ink/72">Room {match.sessionId}</p>
                        <p className="text-ink/60">Started {formatDate(match.matchedAt)}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="secondary"
                          onClick={() => setExpandedMatchId(isExpanded ? null : match.matchId)}
                        >
                          {isExpanded ? "Hide users" : "View users"}
                        </Button>
                        <Button
                          variant="danger"
                          disabled={endingMatchId === match.matchId || sessionExpired}
                          onClick={async () => {
                            setEndingMatchId(match.matchId);
                            setError(null);
                            try {
                              await apiPost<{ match: AdminMatchView }>(
                                `/api/admin/matches/${match.matchId}/end`,
                                { reason: "admin_end" },
                              );
                              await loadAdminDashboard();
                            } catch (caughtError) {
                              setError(
                                caughtError instanceof Error
                                  ? caughtError.message
                                  : "Unable to end the active match.",
                              );
                              setSessionExpired(isAdminSessionExpiredError(caughtError));
                            } finally {
                              setEndingMatchId(null);
                            }
                          }}
                        >
                          {endingMatchId === match.matchId ? "Ending..." : "End active match"}
                        </Button>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <UserSummary user={match.userA} />
                        <UserSummary user={match.userB} />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Recent ended matches</p>
            <StatusBadge tone="neutral">{endedMatches.length} shown</StatusBadge>
          </div>
          <div className="space-y-4 text-sm">
            {endedMatches.length === 0 ? (
              <p className="text-ink/60">Nothing here yet.</p>
            ) : (
              endedMatches.map((match) => {
                const isExpanded = expandedMatchId === match.matchId;
                return (
                  <div key={match.matchId} className="rounded-3xl bg-sand/45 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium">
                          {match.userA.handle} ↔ {match.userB.handle}
                        </p>
                        <p className="mt-1 font-mono text-xs text-ink/60">{match.matchId}</p>
                        <p className="mt-2 text-ink/72">
                          Ended {formatDate(match.endedAt)} · reason {match.endReason ?? "not recorded"}
                        </p>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => setExpandedMatchId(isExpanded ? null : match.matchId)}
                      >
                        {isExpanded ? "Hide users" : "View users"}
                      </Button>
                    </div>
                    {isExpanded ? (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <UserSummary user={match.userA} />
                        <UserSummary user={match.userB} />
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Beta feedback</p>
            <StatusBadge tone={data.feedback.length > 0 ? "warning" : "neutral"}>
              {data.feedback.length} items
            </StatusBadge>
          </div>
          <div className="space-y-4 text-sm">
            {data.feedback.length === 0 ? (
              <p className="text-ink/60">Nothing here yet.</p>
            ) : (
              data.feedback.map((feedback) => (
                <div key={feedback.feedbackId} className="rounded-3xl bg-sand/45 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{feedback.feedbackType}</p>
                    {feedback.matchId ? <StatusBadge tone="neutral">match linked</StatusBadge> : null}
                  </div>
                  <p className="mt-2 text-ink/78">{feedback.feedbackText}</p>
                  <p className="mt-3 font-mono text-xs text-ink/60">{feedback.feedbackId}</p>
                  <p className="mt-2 text-ink/60">
                    User {feedback.userId ?? "unknown"} · Match {feedback.matchId ?? "none"} ·{" "}
                    {formatDate(feedback.createdAt)}
                  </p>
                  {feedback.userAgent ? (
                    <p className="mt-2 break-words text-xs text-ink/50">{feedback.userAgent}</p>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Beta analytics</p>
            <StatusBadge tone="neutral">{data.analytics.length} events</StatusBadge>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2">
            {data.analytics.length === 0 ? (
              <p className="text-ink/60">Nothing here yet.</p>
            ) : (
              data.analytics.map((event) => (
                <div key={event.eventName} className="rounded-2xl border border-line/70 bg-white/80 p-4">
                  <p className="font-mono text-xs text-ink/56">{event.eventName}</p>
                  <p className="mt-2 font-heading text-3xl font-semibold text-ink">{event.count}</p>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Reports</p>
            <StatusBadge tone={data.reports.length > 0 ? "warning" : "neutral"}>
              {data.reports.length} reports
            </StatusBadge>
          </div>
          <div className="space-y-4 text-sm">
            {data.reports.length === 0 ? (
              <p className="text-ink/60">Nothing here yet.</p>
            ) : (
              data.reports.map((report) => {
                const isExpanded = expandedReportId === report.reportId;
                return (
                  <div key={report.reportId} className="rounded-3xl bg-sand/45 p-4">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-medium">{report.reason}</p>
                          {report.linkedMatchStatus ? (
                            <StatusBadge tone={getLinkedMatchTone(report.linkedMatchStatus)}>
                              {report.linkedMatchStatus === "ended"
                                ? `Session ended: ${report.linkedMatchEndReason ?? "ended"}`
                                : "Session still marked live"}
                            </StatusBadge>
                          ) : null}
                        </div>
                        <p className="mt-1 font-mono text-xs text-ink/60">{report.reportId}</p>
                        <p className="mt-2 text-ink/72">
                          {report.reporter.handle} reported {report.reported.handle}
                        </p>
                        <p className="text-ink/60">Submitted {formatDate(report.createdAt)}</p>
                      </div>
                      <Button
                        variant="secondary"
                        onClick={() => setExpandedReportId(isExpanded ? null : report.reportId)}
                      >
                        {isExpanded ? "Hide details" : "View details"}
                      </Button>
                    </div>
                    {isExpanded ? (
                      <div className="mt-4 space-y-4">
                        <div className="grid gap-3 sm:grid-cols-2">
                          <UserSummary user={report.reporter} />
                          <UserSummary user={report.reported} />
                        </div>
                        <div className="rounded-2xl border border-line/70 bg-white/80 p-3">
                          <p className="font-medium text-ink">Report details</p>
                          <p className="mt-2 text-ink/72">{report.details || "No extra details were provided."}</p>
                          <p className="mt-3 font-mono text-xs text-ink/60">
                            Match {report.matchId ?? "none"} · Session {report.sessionId ?? "none"}
                          </p>
                          {report.linkedMatchStatus ? (
                            <p className="mt-2 text-xs text-ink/60">
                              Linked match state: {report.linkedMatchStatus}
                              {report.linkedMatchEndReason ? ` · end reason ${report.linkedMatchEndReason}` : ""}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Blocks</p>
            <StatusBadge tone={data.blocks.length > 0 ? "warning" : "neutral"}>
              {data.blocks.length} blocks
            </StatusBadge>
          </div>
          <div className="space-y-4 text-sm">
            {data.blocks.length === 0 ? (
              <p className="text-ink/60">Nothing here yet.</p>
            ) : (
              data.blocks.map((block) => (
                <div key={block.blockId} className="rounded-3xl bg-sand/45 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">
                      {block.blocker.handle} blocked {block.blocked.handle}
                    </p>
                    {block.linkedMatchStatus ? (
                      <StatusBadge tone={getLinkedMatchTone(block.linkedMatchStatus)}>
                        {block.linkedMatchStatus === "ended"
                          ? `Session ended: ${block.linkedMatchEndReason ?? "ended"}`
                          : "Session still marked live"}
                      </StatusBadge>
                    ) : null}
                  </div>
                  <p className="mt-1 font-mono text-xs text-ink/60">{block.blockId}</p>
                  <p className="mt-2 text-ink/72">
                    Match {block.matchId ?? "none recorded"} · Created {formatDate(block.createdAt)}
                  </p>
                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <UserSummary user={block.blocker} />
                    <UserSummary user={block.blocked} />
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Filtered users</p>
            <StatusBadge tone="neutral">{data.users.length} users</StatusBadge>
          </div>
          <div className="space-y-3 text-sm">
            {data.users.length === 0 ? (
              <p className="text-ink/60">Nothing here yet.</p>
            ) : (
              data.users.map((user) => <UserSummary key={user.userId} user={user} />)
            )}
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember">Audit events</p>
            <StatusBadge tone="neutral">{data.auditLogs.length} events</StatusBadge>
          </div>
          <div className="space-y-4 text-sm">
            {data.auditLogs.length === 0 ? (
              <p className="text-ink/60">Nothing here yet.</p>
            ) : (
              data.auditLogs.map((event) => (
                <div key={event.id} className="rounded-3xl bg-sand/45 p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{event.eventName}</p>
                    {event.matchId ? <StatusBadge tone="neutral">match linked</StatusBadge> : null}
                  </div>
                  <p className="mt-2 font-mono text-xs text-ink/60">{event.id}</p>
                  <p className="mt-2 text-ink/72">
                    actor {event.actorUserId ?? "system/admin"}
                    {event.targetUserId ? ` → target ${event.targetUserId}` : ""}
                  </p>
                  <p className="text-ink/60">{formatDate(event.createdAt)}</p>
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-white/80 p-3 font-mono text-[11px] text-ink/70">
                    {JSON.stringify(event.metadata, null, 2)}
                  </pre>
                </div>
              ))
            )}
          </div>
        </Card>
      </section>
    </div>
  );
}
