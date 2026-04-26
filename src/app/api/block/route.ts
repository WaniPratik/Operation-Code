import { ModerationService } from "@/server/services/moderation-service";
import { SessionService } from "@/server/services/session-service";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";

const sessionService = new SessionService();
const moderationService = new ModerationService();

export async function POST(request: Request) {
  try {
    const session = await sessionService.requireGuestSession();
    const body = (await request.json()) as { matchId?: string };

    if (!body.matchId) {
      return jsonError("matchId is required.", 400);
    }

    await moderationService.blockUser(session.userId, {
      matchId: body.matchId,
    });

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to block user."), 400);
  }
}
