export type BetaSupportSurface = "queue" | "match" | "voice" | "post_session";

export interface BetaRecoveryGuidance {
  title: string;
  intro: string;
  steps: string[];
}

export const TESTER_BUG_REPORT_FIELDS = [
  "anonymous handle",
  "approximate time",
  "screen where it happened",
  "what you expected",
  "what actually happened",
  "whether refreshing once fixed it",
] as const;

const GUIDANCE_BY_SURFACE: Record<BetaSupportSurface, BetaRecoveryGuidance> = {
  queue: {
    title: "If queueing looks stuck",
    intro: "For this small beta, ask testers to try one simple recovery path before reporting an issue.",
    steps: [
      "Refresh the page once.",
      "If you are still stuck, leave and rejoin the queue once.",
      "If it still fails, send the founder your anonymous handle, approximate time, and what the queue showed.",
    ],
  },
  match: {
    title: "If the live session disappears",
    intro: "A lightweight recovery path keeps testers moving without guessing what to do next.",
    steps: [
      "Refresh the match page once.",
      "If there is still no live session, return to the queue and rejoin once.",
      "If the same thing happens again, tell the founder your handle, approximate time, and whether the other person was still connected.",
    ],
  },
  voice: {
    title: "If voice stops working",
    intro: "Voice issues in a small beta should have one retry path and one clear escalation path.",
    steps: [
      "Use Retry voice once.",
      "If you still cannot hear or speak, end the session and return to the queue.",
      "Send the founder your handle, approximate time, and whether microphone permission was allowed.",
    ],
  },
  post_session: {
    title: "If moderation tools look wrong",
    intro: "Reports and blocks should stay simple during beta, even when a session just ended.",
    steps: [
      "Refresh the page once.",
      "If the recent session is still missing, return to the queue and avoid reusing the broken tab.",
      "Tell the founder your handle, approximate time, and whether you were trying to report or block.",
    ],
  },
};

export function getBetaRecoveryGuidance(surface: BetaSupportSurface): BetaRecoveryGuidance {
  return GUIDANCE_BY_SURFACE[surface];
}
