import { getErrorMessage, getErrorStatus, jsonError, jsonOk } from "@/server/http";
import { AuditService } from "@/server/services/audit-service";
import { SessionService } from "@/server/services/session-service";
import type { AuditEventName } from "@/types/domain";

const allowedEvents = new Set<AuditEventName>(["voice_connected", "voice_failed"]);
const sessionService = new SessionService();
const auditService = new AuditService();

export async function POST(request: Request) {
  try {
    const session = await sessionService.requireGuestSession();
    const body = (await request.json().catch(() => ({}))) as {
      eventName?: AuditEventName;
      matchId?: string | null;
      metadata?: Record<string, unknown>;
    };

    if (!body.eventName || !allowedEvents.has(body.eventName)) {
      return jsonError("Invalid analytics event.", 400);
    }

    await auditService.write({
      actorUserId: session.userId,
      matchId: body.matchId ?? null,
      eventName: body.eventName,
      metadata: body.metadata ?? {},
    });

    return jsonOk({ success: true });
  } catch (error) {
    return jsonError(getErrorMessage(error, "Unable to record analytics event."), getErrorStatus(error, 400));
  }
}
