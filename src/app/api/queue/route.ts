import { QueueService } from "@/server/services/queue-service";
import { SessionService } from "@/server/services/session-service";
import { getErrorMessage, getErrorStatus, jsonError, jsonOk } from "@/server/http";

const sessionService = new SessionService();
const queueService = new QueueService();

export async function GET() {
  try {
    const session = await sessionService.requireGuestSession();
    const queue = await queueService.getStatus(session.userId);
    return jsonOk({ queue });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to fetch queue status."), 400);
  }
}

export async function POST(request: Request) {
  try {
    const session = await sessionService.requireGuestSession();
    const body = (await request.json()) as {
      preferredCountries?: string[];
      excludedCountries?: string[];
    };

    const queue = await queueService.joinQueue(session.userId, {
      preferredCountries: body.preferredCountries ?? [],
      excludedCountries: body.excludedCountries ?? [],
    });

    return jsonOk({ queue });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to join queue."), getErrorStatus(error, 400));
  }
}

export async function DELETE() {
  try {
    const session = await sessionService.requireGuestSession();
    const queue = await queueService.leaveQueue(session.userId);
    return jsonOk({ queue });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to leave queue."), 400);
  }
}
