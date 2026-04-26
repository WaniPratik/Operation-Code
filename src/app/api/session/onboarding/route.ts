import { SessionService } from "@/server/services/session-service";
import { getErrorMessage, jsonError, jsonOk } from "@/server/http";

export async function POST(request: Request) {
  try {
    const sessionService = new SessionService();
    const session = await sessionService.requireGuestSession();

    let body: { ageConfirmed?: boolean };

    try {
      body = (await request.json()) as { ageConfirmed?: boolean };
    } catch {
      return jsonError("Invalid JSON request body.", 400);
    }

    if (!body.ageConfirmed) {
      return jsonError("Age confirmation is required.", 400);
    }

    const updated = await sessionService.completeOnboarding(session.userId);

    return jsonOk({ session: updated });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to complete onboarding."), 400);
  }
}
