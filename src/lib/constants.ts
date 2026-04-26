export const MINIMUM_AGE = 18;

export const REPORT_REASONS = [
  "harassment",
  "sexual content",
  "hate or abuse",
  "spam or scam",
  "underage concern",
  "other",
] as const;

export const COUNTRY_OPTIONS = [
  { code: "US", name: "United States" },
  { code: "CA", name: "Canada" },
  { code: "GB", name: "United Kingdom" },
  { code: "AU", name: "Australia" },
  { code: "IN", name: "India" },
  { code: "DE", name: "Germany" },
  { code: "FR", name: "France" },
  { code: "JP", name: "Japan" },
  { code: "BR", name: "Brazil" },
  { code: "MX", name: "Mexico" },
  { code: "ZA", name: "South Africa" },
  { code: "SG", name: "Singapore" },
] as const;

export const MVP_COUNTRY_FILTER_LIMIT = 2;

export const MODERATION_METADATA_FIELDS = [
  "user id",
  "anonymous handle",
  "session id",
  "match id",
  "report id",
  "block records",
  "timestamps",
  "anonymized device/session fingerprint",
  "audit events",
] as const;

export const AUDIT_EVENT_NAMES = [
  "queue_join",
  "queue_leave",
  "match_created",
  "match_ended",
  "report_submitted",
  "user_blocked",
] as const;
