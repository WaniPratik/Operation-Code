import { FEEDBACK_TYPES } from "@/lib/constants";
import { createRequestFingerprintHash } from "@/server/auth/request-fingerprint";
import { getErrorMessage, getErrorStatus, jsonError, jsonOk } from "@/server/http";
import { FeedbackService } from "@/server/services/feedback-service";
import { SessionService } from "@/server/services/session-service";
import type { FeedbackType } from "@/types/domain";

const sessionService = new SessionService();
const feedbackService = new FeedbackService();

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as {
      feedbackType?: FeedbackType;
      feedbackText?: string;
      matchId?: string | null;
    };

    if (!body.feedbackType || !FEEDBACK_TYPES.includes(body.feedbackType)) {
      return jsonError("Invalid feedback type.", 400);
    }

    let userId: string | null = null;

    try {
      const session = await sessionService.requireGuestSession();
      userId = session.userId;
    } catch {
      userId = null;
    }

    const feedback = await feedbackService.submitFeedback({
      feedbackType: body.feedbackType,
      feedbackText: body.feedbackText ?? "",
      userId,
      matchId: body.matchId ?? null,
      userAgent: request.headers.get("user-agent"),
      fingerprintHash: await createRequestFingerprintHash(),
    });

    return jsonOk({ feedback });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to submit feedback."), getErrorStatus(error, 400));
  }
}
