import { MatchService } from "@/server/services/match-service";
import { QueueService } from "@/server/services/queue-service";
import { SessionService } from "@/server/services/session-service";
import { AuditService } from "@/server/services/audit-service";
import { getErrorMessage, getErrorStatus, jsonError, jsonOk } from "@/server/http";

const sessionService = new SessionService();
const matchService = new MatchService();
const queueService = new QueueService();
const auditService = new AuditService();

export async function POST(request: Request) {
  try {
    const session = await sessionService.requireGuestSession();
    const body = (await request.json().catch(() => ({}))) as {
      matchId?: string;
      reason?: string;
      findNext?: boolean;
      preferredCountries?: string[];
      excludedCountries?: string[];
    };

    if (!body.matchId) {
      return jsonError("matchId is required.", 400);
    }

    const queue = await matchService.endMatch(session.userId, body.matchId, body.reason ?? "user_end");

    if (!body.findNext) {
      return jsonOk({ queue });
    }

    try {
      const nextQueue = await queueService.joinQueue(session.userId, {
        preferredCountries: body.preferredCountries ?? queue.filters.preferredCountries,
        excludedCountries: body.excludedCountries ?? queue.filters.excludedCountries,
      });
      await auditService.write({
        actorUserId: session.userId,
        matchId: body.matchId,
        eventName: "end_find_next",
        metadata: {
          reason: body.reason ?? "user_end",
          nextQueueEntryId: nextQueue.queueEntryId,
        },
      });

      return jsonOk({ queue: nextQueue });
    } catch (nextQueueError) {
      return jsonOk({
        queue,
        nextQueueError: getErrorMessage(nextQueueError, "Unable to start finding the next match."),
        nextQueueErrorStatus: getErrorStatus(nextQueueError, 400),
      });
    }
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to end match."), getErrorStatus(error, 400));
  }
}
