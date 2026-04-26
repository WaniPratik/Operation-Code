import { MatchService } from "@/server/services/match-service";
import { SessionService } from "@/server/services/session-service";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";

const sessionService = new SessionService();
const matchService = new MatchService();

export async function GET() {
  try {
    const session = await sessionService.requireGuestSession();
    const queue = await matchService.getMatchState(session.userId);
    return jsonOk({ queue });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to fetch match state."), 400);
  }
}
