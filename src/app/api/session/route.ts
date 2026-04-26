import { applyGuestSessionCookie } from "@/server/auth/session-cookie";
import { SessionService } from "@/server/services/session-service";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";

const sessionService = new SessionService();

export async function GET() {
  try {
    const session = await sessionService.requireGuestSession();
    return jsonOk({ session });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to fetch session."), 401);
  }
}

export async function POST() {
  try {
    const result = await sessionService.ensureGuestSession();
    const response = jsonOk({ session: result.session });

    if (result.cookieToken) {
      applyGuestSessionCookie(response, result.cookieToken);
    }

    return response;
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to create guest session."), 500);
  }
}
