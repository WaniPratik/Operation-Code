import { ModerationService } from "@/server/services/moderation-service";
import { SessionService } from "@/server/services/session-service";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";
import { REPORT_REASONS } from "@/lib/constants";

const sessionService = new SessionService();
const moderationService = new ModerationService();

export async function POST(request: Request) {
  try {
    const session = await sessionService.requireGuestSession();
    const body = (await request.json()) as {
      matchId?: string;
      reason?: "harassment" | "sexual content" | "hate or abuse" | "spam or scam" | "underage concern" | "other";
      details?: string;
    };

    if (!body.matchId || !body.reason) {
      return jsonError("matchId and reason are required.", 400);
    }

    if (!REPORT_REASONS.includes(body.reason)) {
      return jsonError("Invalid report reason.", 400);
    }

    if ((body.details ?? "").trim().length > 400) {
      return jsonError("Report details must be 400 characters or fewer.", 400);
    }

    const report = await moderationService.submitReport(session.userId, {
      matchId: body.matchId,
      reason: body.reason,
      details: body.details ?? "",
    });

    return jsonOk({ report });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to submit report."), 400);
  }
}
