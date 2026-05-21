import { MatchService } from "@/server/services/match-service";
import { QueueService } from "@/server/services/queue-service";
import { SessionService } from "@/server/services/session-service";
import { getErrorMessage, getErrorStatus, jsonError, jsonOk } from "@/server/http";

const sessionService = new SessionService();
const matchService = new MatchService();
const queueService = new QueueService();

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
