import { AccessToken, RoomServiceClient } from "livekit-server-sdk";
import { env } from "@/server/env";
import { PlatformRepository } from "@/server/repositories/platform-repository";

interface CreateVoiceAccessTokenInput {
  roomName: string;
  participantIdentity: string;
  participantName: string;
  metadata: Record<string, string>;
}

interface VoiceServiceDeps {
  createAccessToken: (input: CreateVoiceAccessTokenInput) => Promise<string>;
  deleteRoom: (roomName: string) => Promise<void>;
}

function createStatusError(message: string, statusCode: number) {
  return Object.assign(new Error(message), { statusCode });
}

function hasLiveKitServerConfig() {
  return Boolean(
    process.env.NEXT_PUBLIC_LIVEKIT_URL && process.env.LIVEKIT_API_KEY && process.env.LIVEKIT_API_SECRET,
  );
}

function createLiveKitRoomServiceClient() {
  return new RoomServiceClient(env.livekitServerUrl, env.livekitApiKey, env.livekitApiSecret);
}

async function createLiveKitAccessToken(input: CreateVoiceAccessTokenInput) {
  const accessToken = new AccessToken(env.livekitApiKey, env.livekitApiSecret, {
    identity: input.participantIdentity,
    name: input.participantName,
    ttl: "15m",
    metadata: JSON.stringify(input.metadata),
  });

  accessToken.addGrant({
    roomJoin: true,
    room: input.roomName,
    canPublish: true,
    canSubscribe: true,
  });

  return accessToken.toJwt();
}

function isRoomMissingError(error: unknown) {
  return Boolean(
    error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "not_found",
  );
}

const defaultVoiceServiceDeps: VoiceServiceDeps = {
  createAccessToken: createLiveKitAccessToken,
  async deleteRoom(roomName) {
    const roomServiceClient = createLiveKitRoomServiceClient();
    await roomServiceClient.deleteRoom(roomName);
  },
};

export interface VoiceRoomAccessView {
  serverUrl: string;
  roomName: string;
  token: string;
  participantIdentity: string;
  participantName: string;
  matchId: string;
}

export class VoiceService {
  constructor(
    private readonly repository = new PlatformRepository(),
    private readonly deps: VoiceServiceDeps = defaultVoiceServiceDeps,
  ) {}

  async issueActiveMatchAccess(userId: string): Promise<VoiceRoomAccessView> {
    const queue = await this.repository.getQueueSnapshot(userId);

    if (!queue.activeMatch || queue.activeMatch.status !== "matched") {
      throw new Error("Voice room is only available for an active match.");
    }

    const [liveMatch, profile] = await Promise.all([
      this.repository.getMatchById(queue.activeMatch.matchId),
      this.repository.getProfile(userId),
    ]);

    const isParticipant =
      liveMatch && (liveMatch.user_a_id === userId || liveMatch.user_b_id === userId);
    const isExpectedRoom = liveMatch?.session_id === queue.activeMatch.sessionId;

    if (!liveMatch || liveMatch.status !== "matched" || !isParticipant || !isExpectedRoom) {
      throw createStatusError(
        "This live session is no longer available for your guest session. Return to the queue and try again.",
        403,
      );
    }

    const participantIdentity = `user:${userId}`;
    const roomName = queue.activeMatch.sessionId;
    const participantName = profile.anonymous_handle;
    const token = await this.deps.createAccessToken({
      roomName,
      participantIdentity,
      participantName,
      metadata: {
        userId,
        matchId: queue.activeMatch.matchId,
        sessionId: queue.activeMatch.sessionId,
      },
    });

    return {
      serverUrl: env.livekitUrl,
      roomName,
      token,
      participantIdentity,
      participantName,
      matchId: queue.activeMatch.matchId,
    };
  }

  async cleanupRoom(sessionId: string) {
    if (!hasLiveKitServerConfig()) {
      return;
    }

    try {
      await this.deps.deleteRoom(sessionId);
    } catch (error) {
      if (isRoomMissingError(error)) {
        return;
      }

      throw error;
    }
  }
}
