import type { AuditEventName } from "@/types/domain";
import { PlatformRepository } from "@/server/repositories/platform-repository";

export class AuditService {
  constructor(private readonly repository = new PlatformRepository()) {}

  async write(input: {
    actorUserId: string;
    targetUserId?: string | null;
    matchId?: string | null;
    eventName: AuditEventName;
    metadata?: Record<string, unknown>;
  }) {
    await this.repository.writeAuditEvent({
      actorUserId: input.actorUserId,
      targetUserId: input.targetUserId,
      matchId: input.matchId,
      eventName: input.eventName,
      metadata: input.metadata,
    });
  }
}
