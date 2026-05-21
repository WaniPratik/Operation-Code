"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FeedbackPrompt } from "@/components/ui/feedback-prompt";
import { Notice } from "@/components/ui/notice";
import { StatusBadge } from "@/components/ui/status-badge";
import {
  applyAudioOutputMode,
  type AudioOutputMode,
} from "@/features/match/audio-output-routing";
import { apiPost, isSessionExpiredError } from "@/lib/client/api";
import type { MatchView } from "@/types/domain";

interface VoiceRoomAccessPayload {
  voice: {
    serverUrl: string;
    roomName: string;
    token: string;
    participantIdentity: string;
    participantName: string;
    matchId: string;
  };
}

export type VoiceUiState = "preparing" | "connecting" | "connected" | "reconnecting" | "error";

interface LiveVoiceRoomProps {
  match: MatchView;
  preConnectionSecondsRemaining: number;
  onVoiceStateChange?: (state: VoiceUiState) => void;
}

function getVoiceStatusTone(status: VoiceUiState) {
  if (status === "connected") {
    return "success" as const;
  }

  if (status === "error") {
    return "danger" as const;
  }

  return "warning" as const;
}

export function LiveVoiceRoom({
  match,
  preConnectionSecondsRemaining,
  onVoiceStateChange,
}: LiveVoiceRoomProps) {
  const [voiceState, setVoiceState] = useState<VoiceUiState>(
    preConnectionSecondsRemaining > 0 ? "preparing" : "connecting",
  );
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [remoteParticipantCount, setRemoteParticipantCount] = useState(0);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [audioOutputMode, setAudioOutputMode] = useState<AudioOutputMode>("default");
  const [audioOutputMessage, setAudioOutputMessage] = useState<string | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const [connectionLost, setConnectionLost] = useState(false);
  const roomRef = useRef<Room | null>(null);
  const audioContainerRef = useRef<HTMLDivElement | null>(null);
  const audioElementsRef = useRef(new Set<HTMLMediaElement>());
  const audioOutputModeRef = useRef<AudioOutputMode>("default");
  const voiceConnectedRecordedRef = useRef<string | null>(null);

  function recordVoiceEvent(eventName: "voice_connected" | "voice_failed", metadata?: Record<string, unknown>) {
    void apiPost("/api/analytics", {
      eventName,
      matchId: match.matchId,
      metadata,
    }).catch(() => {
      // Analytics should never interrupt the live call or recovery path.
    });
  }

  const statusLabel = useMemo(() => {
    if (preConnectionSecondsRemaining > 0) {
      return "Bridging...";
    }

    switch (voiceState) {
      case "connected":
        return "Connected";
      case "reconnecting":
        return "Reconnecting...";
      case "error":
        return connectionLost ? "Connection dropped." : "Voice unavailable";
      default:
        return "Establishing connection...";
    }
  }, [connectionLost, preConnectionSecondsRemaining, voiceState]);

  useEffect(() => {
    setVoiceState(preConnectionSecondsRemaining > 0 ? "preparing" : "connecting");
  }, [preConnectionSecondsRemaining, match.matchId]);

  useEffect(() => {
    onVoiceStateChange?.(voiceState);
  }, [onVoiceStateChange, voiceState]);

  useEffect(() => {
    audioOutputModeRef.current = audioOutputMode;
  }, [audioOutputMode]);

  useEffect(() => {
    if (preConnectionSecondsRemaining > 0) {
      return;
    }

    let cancelled = false;
    let connectedOnce = false;
    const attachedAudioElements = new Set<HTMLMediaElement>();
    const room = new Room({
      adaptiveStream: false,
      dynacast: false,
    });

    roomRef.current = room;
    setVoiceError(null);
    setAudioBlocked(false);
    setConnectionLost(false);
    setVoiceState("connecting");

    const syncParticipantCount = () => {
      setRemoteParticipantCount(room.remoteParticipants.size);
    };

    const recordVoiceConnectedOnce = () => {
      if (voiceConnectedRecordedRef.current === match.matchId) {
        return;
      }

      voiceConnectedRecordedRef.current = match.matchId;
      recordVoiceEvent("voice_connected", {
        roomConnected: true,
      });
    };

    const handleTrackSubscribed = (track: Track) => {
      if (track.kind !== Track.Kind.Audio) {
        return;
      }

      const element = track.attach();
      element.autoplay = true;
      element.dataset.livekitRoom = match.matchId;
      audioContainerRef.current?.appendChild(element);
      audioElementsRef.current.add(element);
      attachedAudioElements.add(element);
      void applyAudioOutputMode([element], audioOutputModeRef.current).then((result) => {
        if (!cancelled) {
          setAudioOutputMessage(result.message);
        }
      });
    };

    const handleTrackUnsubscribed = (track: Track) => {
      if (track.kind !== Track.Kind.Audio) {
        return;
      }

      for (const element of track.detach()) {
        attachedAudioElements.delete(element);
        audioElementsRef.current.delete(element);
        element.remove();
      }
    };

    room
      .on(RoomEvent.Connected, () => {
        connectedOnce = true;
        recordVoiceConnectedOnce();
        if (!cancelled) {
          setConnectionLost(false);
          setVoiceError(null);
          setVoiceState("connected");
        }
      })
      .on(RoomEvent.TrackSubscribed, handleTrackSubscribed)
      .on(RoomEvent.TrackUnsubscribed, handleTrackUnsubscribed)
      .on(RoomEvent.ParticipantConnected, syncParticipantCount)
      .on(RoomEvent.ParticipantDisconnected, syncParticipantCount)
      .on(RoomEvent.Reconnecting, () => {
        if (!cancelled) {
          setConnectionLost(true);
          setVoiceState("reconnecting");
        }
      })
      .on(RoomEvent.Reconnected, () => {
        connectedOnce = true;
        recordVoiceConnectedOnce();
        if (!cancelled) {
          setConnectionLost(false);
          setVoiceError(null);
          setVoiceState("connected");
        }
      })
      .on(RoomEvent.Disconnected, () => {
        if (!cancelled) {
          setRemoteParticipantCount(0);
          if (connectedOnce) {
            setConnectionLost(true);
            setVoiceError("Signal lost. Jump back in.");
            setVoiceState("error");
          } else {
            setVoiceState("connecting");
          }
        }
      })
      .on(RoomEvent.AudioPlaybackStatusChanged, () => {
        if (!cancelled) {
          setAudioBlocked(!room.canPlaybackAudio);
        }
      })
      .on(RoomEvent.MediaDevicesError, () => {
        if (!cancelled) {
          recordVoiceEvent("voice_failed", {
            reason: "media_devices_error",
          });
          setVoiceError(
            "Mic access required. Please enable microphone permissions in your browser settings to join.",
          );
          setVoiceState("error");
        }
      });

    const connectRoom = async () => {
      try {
        const payload = await apiPost<VoiceRoomAccessPayload>("/api/voice/token");

        if (cancelled) {
          return;
        }

        await room.connect(payload.voice.serverUrl, payload.voice.token);
        await room.localParticipant.setMicrophoneEnabled(true);

        if (cancelled) {
          await room.disconnect();
          return;
        }

        setMicrophoneEnabled(true);
        setAudioBlocked(!room.canPlaybackAudio);
        syncParticipantCount();
        recordVoiceConnectedOnce();
        setVoiceState("connected");
      } catch (error) {
        if (cancelled) {
          return;
        }

        recordVoiceEvent("voice_failed", {
          reason: error instanceof Error ? error.message : "unknown",
        });
        setVoiceError(
          isSessionExpiredError(error)
            ? "Your guest session expired while voice was opening. Start a fresh session from onboarding to continue."
            : error instanceof Error
              ? error.message
              : "Unable to connect to the voice room.",
        );
        setVoiceState("error");
      }
    };

    void connectRoom();

    return () => {
      cancelled = true;
      roomRef.current = null;

      for (const element of attachedAudioElements) {
        audioElementsRef.current.delete(element);
        element.remove();
      }

      attachedAudioElements.clear();
      room.removeAllListeners();
      void room.disconnect();
    };
  }, [match.matchId, preConnectionSecondsRemaining, retryKey]);

  async function toggleMicrophone() {
    const room = roomRef.current;

    if (!room) {
      return;
    }

    const nextEnabled = !microphoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(nextEnabled);
    setMicrophoneEnabled(nextEnabled);
  }

  async function enableAudioPlayback() {
    const room = roomRef.current;

    if (!room) {
      return;
    }

    try {
      await room.startAudio();
      setAudioBlocked(false);
    } catch (error) {
      setVoiceError(
        error instanceof Error ? error.message : "Browser audio playback is still blocked.",
      );
    }
  }

  async function chooseAudioOutput(nextMode: AudioOutputMode) {
    setAudioOutputMode(nextMode);
    audioOutputModeRef.current = nextMode;

    try {
      const result = await applyAudioOutputMode(audioElementsRef.current, nextMode);
      setAudioOutputMessage(result.message);
    } catch (error) {
      setAudioOutputMessage(
        error instanceof Error ? error.message : "Use your device audio controls.",
      );
    }
  }

  const canControlAudio = voiceState === "connected" || voiceState === "reconnecting";

  return (
    <Card className="border-dashed p-5 sm:p-6">
      <div className="flex items-center justify-center">
        <StatusBadge tone={getVoiceStatusTone(voiceState)}>{statusLabel}</StatusBadge>
      </div>

      {preConnectionSecondsRemaining > 0 ? (
        <div className="mt-6 space-y-3 text-center">
          <p className="text-sm text-ink/64">Almost there.</p>
          <p className="font-heading text-5xl font-semibold text-ink">{preConnectionSecondsRemaining}</p>
        </div>
      ) : (
        <div className="mt-6 space-y-4 text-center">
          <p className="text-base leading-7 text-ink/78">
            {voiceState === "connected"
              ? remoteParticipantCount > 0
                ? "You’re live. Say hello!"
                : `Waiting for ${match.counterpart.handle}.`
              : voiceState === "reconnecting"
                ? "Reconnecting..."
                : connectionLost
                  ? "Signal lost. Jump back in."
                  : voiceState === "error"
                    ? "Voice setup did not finish cleanly."
                    : "Almost there."}
          </p>

          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
            {canControlAudio ? (
              <Button variant="secondary" className="w-full sm:w-auto" onClick={() => void toggleMicrophone()}>
                {microphoneEnabled ? "Mute mic" : "Unmute mic"}
              </Button>
            ) : null}
            {canControlAudio ? (
              <div className="flex w-full flex-col gap-2 rounded-2xl border border-line/80 bg-white/60 p-2 text-left sm:w-auto">
                <p className="px-2 font-mono text-[10px] uppercase tracking-[0.18em] text-ink/72">
                  Audio output
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={audioOutputMode === "default" ? "primary" : "ghost"}
                    className="px-3 py-2"
                    onClick={() => void chooseAudioOutput("default")}
                  >
                    Default audio
                  </Button>
                  <Button
                    variant={audioOutputMode === "speaker" ? "primary" : "ghost"}
                    className="px-3 py-2"
                    onClick={() => void chooseAudioOutput("speaker")}
                  >
                    Speaker
                  </Button>
                </div>
                {audioOutputMessage ? (
                  <p className="px-2 text-xs leading-5 text-ink/60">{audioOutputMessage}</p>
                ) : null}
              </div>
            ) : null}
            {audioBlocked ? (
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => void enableAudioPlayback()}>
                Enable audio
              </Button>
            ) : null}
            {voiceState === "error" ? (
              <Button variant="ghost" className="w-full sm:w-auto" onClick={() => setRetryKey((value) => value + 1)}>
                Try Again
              </Button>
            ) : null}
          </div>

          {voiceState === "reconnecting" ? (
            <Notice title="Connection dropped." tone="warning">
              We’re reconnecting now.
            </Notice>
          ) : null}
          {voiceError ? (
            <div className="space-y-4 text-left">
              <Notice
                title={voiceError.startsWith("Mic access required.") ? "Mic access required." : "Voice setup issue"}
                tone="warning"
              >
                {voiceError}
              </Notice>
              <FeedbackPrompt matchId={match.matchId} defaultType="audio issue" label="Tell us what happened" />
            </div>
          ) : null}
          {audioBlocked ? (
            <Notice title="Audio is paused" tone="info">
              Some browsers need one extra tap before remote audio can play.
            </Notice>
          ) : null}
        </div>
      )}

      <div ref={audioContainerRef} className="hidden" aria-hidden="true" />
    </Card>
  );
}
