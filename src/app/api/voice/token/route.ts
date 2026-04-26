import { SessionService } from "@/server/services/session-service";
import { VoiceService } from "@/server/services/voice-service";
import { getErrorMessage, getErrorStatus, jsonError, jsonOk } from "@/server/http";

function isServerConfigurationError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "message" in error &&
      typeof (error as { message?: string }).message === "string" &&
      (error as { message: string }).message.startsWith("Missing required environment variable:"),
  );
}

export async function POST() {
  try {
    const sessionService = new SessionService();
    const voiceService = new VoiceService();
    const session = await sessionService.requireGuestSession();
    const voice = await voiceService.issueActiveMatchAccess(session.userId);

    return jsonOk({ voice });
  } catch (error) {
    const message = getErrorMessage(error, "Unable to prepare voice room access.");
    const status = isServerConfigurationError(error) ? 500 : getErrorStatus(error, 400);
    return jsonError(message, status);
  }
}
