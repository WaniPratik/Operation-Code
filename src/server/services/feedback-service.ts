import { FEEDBACK_TYPES } from "@/lib/constants";
import { PlatformRepository } from "@/server/repositories/platform-repository";
import type { FeedbackType } from "@/types/domain";

function createStatusError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

export class FeedbackService {
  constructor(private readonly repository = new PlatformRepository()) {}

  async submitFeedback(input: {
    feedbackType: FeedbackType;
    feedbackText: string;
    userId: string | null;
    matchId: string | null;
    userAgent: string | null;
    fingerprintHash: string | null;
  }) {
    if (!FEEDBACK_TYPES.includes(input.feedbackType)) {
      throw createStatusError("Invalid feedback type.", 400);
    }

    const feedbackText = input.feedbackText.trim();

    if (!feedbackText) {
      throw createStatusError("Feedback text is required.", 400);
    }

    if (feedbackText.length > 1000) {
      throw createStatusError("Feedback must be 1000 characters or fewer.", 400);
    }

    const rateKey = input.userId ?? input.fingerprintHash;

    if (rateKey) {
      const count = await this.repository.incrementRateLimit({
        action: "feedback_submission",
        rateKey,
        windowMs: 10 * 60 * 1000,
      });

      if (count > 5) {
        throw createStatusError("Too much feedback was sent from this session. Please wait a few minutes.", 429);
      }
    }

    const feedback = await this.repository.createFeedback({
      ...input,
      feedbackText,
    });

    if (input.userId) {
      await this.repository.writeAuditEvent({
        actorUserId: input.userId,
        matchId: input.matchId,
        eventName: "feedback_submitted",
        metadata: {
          feedbackId: feedback.feedbackId,
          feedbackType: input.feedbackType,
        },
      });
    }

    return feedback;
  }
}
