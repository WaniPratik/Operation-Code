import type { AUDIT_EVENT_NAMES, FEEDBACK_TYPES, REPORT_REASONS } from "@/lib/constants";

export type ReportReason = (typeof REPORT_REASONS)[number];
export type FeedbackType = (typeof FEEDBACK_TYPES)[number];
export type AuditEventName = (typeof AUDIT_EVENT_NAMES)[number];

export interface GuestSessionView {
  userId: string;
  handle: string;
  ageConfirmed: boolean;
  onboardingCompleted: boolean;
  countryCode: string | null;
  fingerprintHash: string | null;
  createdAt: string;
  lastSeenAt: string;
}

export interface QueueFilters {
  preferredCountries: string[];
  excludedCountries: string[];
}

export interface QueueStatusView {
  status: "idle" | "queued" | "matched";
  queueEntryId: string | null;
  enteredAt: string | null;
  filters: QueueFilters;
  activeMatch: MatchView | null;
  recentMatch: MatchView | null;
}

export interface MatchView {
  matchId: string;
  sessionId: string;
  status: "matched" | "ended";
  matchedAt: string;
  endedAt: string | null;
  counterpart: {
    userId: string;
    handle: string;
    countryCode: string | null;
  };
  preConnectionSeconds: number;
}

export interface ReportView {
  reportId: string;
  matchId: string | null;
  reporterUserId: string;
  reportedUserId: string;
  reason: ReportReason;
  details: string;
  status: string;
  createdAt: string;
}

export interface AuditEventView {
  id: string;
  eventName: AuditEventName | string;
  actorUserId: string | null;
  targetUserId: string | null;
  matchId: string | null;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface FeedbackView {
  feedbackId: string;
  feedbackType: FeedbackType;
  feedbackText: string;
  userId: string | null;
  matchId: string | null;
  userAgent: string | null;
  createdAt: string;
}

export interface AnalyticsSummaryView {
  eventName: string;
  count: number;
}

export interface AdminUserView {
  userId: string;
  handle: string;
  countryCode: string | null;
  ageConfirmed: boolean;
  onboardingCompleted: boolean;
  onboardingCompletedAt: string | null;
  createdAt: string;
  reportsReceived?: number;
  blocksReceived?: number;
  activeCooldownReason?: string | null;
  activeCooldownExpiresAt?: string | null;
}

export interface AdminMatchView {
  matchId: string;
  sessionId: string;
  status: "matched" | "ended";
  matchedAt: string;
  endedAt: string | null;
  endReason: string | null;
  userA: AdminUserView;
  userB: AdminUserView;
}

export interface AdminReportView {
  reportId: string;
  matchId: string | null;
  sessionId: string | null;
  reporter: AdminUserView;
  reported: AdminUserView;
  reason: ReportReason;
  details: string;
  status: string;
  createdAt: string;
  linkedMatchStatus: "matched" | "ended" | null;
  linkedMatchEndReason: string | null;
}

export interface AdminBlockView {
  blockId: string;
  matchId: string | null;
  blocker: AdminUserView;
  blocked: AdminUserView;
  createdAt: string;
  linkedMatchStatus: "matched" | "ended" | null;
  linkedMatchEndReason: string | null;
}

export interface AdminQuery {
  dateFrom?: string | null;
  dateTo?: string | null;
  userId?: string | null;
  type?: string | null;
}
