import { MatchService } from "@/server/services/match-service";
import { SessionService } from "@/server/services/session-service";
import { getErrorMessage, getErrorStatus, jsonError, jsonOk } from "@/server/http";

const sessionService = new SessionService();
const matchService = new MatchService();

export async function POST(request: Request) {
  try {
    const session = await sessionService.requireGuestSession();
    const body = (await request.json().catch(() => ({}))) as { matchId?: string; reason?: string };

    if (!body.matchId) {
      return jsonError("matchId is required.", 400);
    }

    const queue = await matchService.endMatch(session.userId, body.matchId, body.reason ?? "user_end");
    return jsonOk({ queue });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to end match."), getErrorStatus(error, 400));
  }
}
