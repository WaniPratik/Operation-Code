import { describe, expect, it, vi } from "vitest";
import { FeedbackService } from "@/server/services/feedback-service";

describe("FeedbackService", () => {
  it("stores beta feedback, rate limits by user, and writes an audit event", async () => {
    const repository = {
      incrementRateLimit: vi.fn().mockResolvedValue(1),
      createFeedback: vi.fn().mockResolvedValue({
        feedbackId: "feedback_1",
        feedbackType: "audio issue",
        feedbackText: "Audio dropped once.",
        userId: "user_1",
        matchId: "match_1",
        userAgent: "Vitest",
        createdAt: "2026-05-21T00:00:00.000Z",
      }),
      writeAuditEvent: vi.fn().mockResolvedValue(undefined),
    };
    const service = new FeedbackService(repository as never);

    const feedback = await service.submitFeedback({
      feedbackType: "audio issue",
      feedbackText: "  Audio dropped once.  ",
      userId: "user_1",
      matchId: "match_1",
      userAgent: "Vitest",
      fingerprintHash: "fingerprint_1",
    });

    expect(feedback.feedbackId).toBe("feedback_1");
    expect(repository.incrementRateLimit).toHaveBeenCalledWith({
      action: "feedback_submission",
      rateKey: "user_1",
      windowMs: 10 * 60 * 1000,
    });
    expect(repository.createFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        feedbackText: "Audio dropped once.",
      }),
    );
    expect(repository.writeAuditEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user_1",
        matchId: "match_1",
        eventName: "feedback_submitted",
      }),
    );
  });

  it("rejects invalid feedback type and spam bursts", async () => {
    const repository = {
      incrementRateLimit: vi.fn().mockResolvedValue(6),
      createFeedback: vi.fn(),
      writeAuditEvent: vi.fn(),
    };
    const service = new FeedbackService(repository as never);

    await expect(
      service.submitFeedback({
        feedbackType: "not-real" as never,
        feedbackText: "Hello",
        userId: "user_1",
        matchId: null,
        userAgent: null,
        fingerprintHash: "fingerprint_1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });

    await expect(
      service.submitFeedback({
        feedbackType: "bug",
        feedbackText: "Too many",
        userId: null,
        matchId: null,
        userAgent: null,
        fingerprintHash: "fingerprint_1",
      }),
    ).rejects.toMatchObject({ statusCode: 429 });
    expect(repository.createFeedback).not.toHaveBeenCalled();
  });
});
