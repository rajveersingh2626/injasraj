import {
  IMediaSession,
  ConnectionQuality,
  createDefaultQuality,
} from '../../types/media';

export class LiveKitMediaSession implements IMediaSession {
  private url: string;
  private room: any = null;
  private micEnabled = true;
  private cameraEnabled = true;
  private screenShareEnabled = false;
  private remoteTrackCallbacks: ((track: MediaStreamTrack, stream: MediaStream) => void)[] = [];
  private qualityCallbacks: ((metrics: ConnectionQuality) => void)[] = [];
  private currentQuality: ConnectionQuality = createDefaultQuality();

  constructor(serverUrl?: string) {
    this.url =
      serverUrl ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_LIVEKIT_URL) ||
      'wss://injasraj-aosxldu2.livekit.cloud';
  }

  public isMicEnabled(): boolean {
    return this.micEnabled;
  }

  public isCameraEnabled(): boolean {
    return this.cameraEnabled;
  }

  public isScreenSharing(): boolean {
    return this.screenShareEnabled;
  }

  async connect(roomId: string, token: string): Promise<void> {
    try {
      // Lazy load livekit-client dynamically so non-browser environments do not crash
      const { Room, RoomEvent, ConnectionQuality: LKQuality, Track } = await import(
        'livekit-client'
      );
      this.room = new Room({
        adaptiveStream: true,
        dynacast: true,
      });

      this.room.on(RoomEvent.TrackSubscribed, (track: any, publication: any, participant: any) => {
        if (track.mediaStreamTrack) {
          const mediaStream = new MediaStream([track.mediaStreamTrack]);
          this.emitRemoteTrack(track.mediaStreamTrack, mediaStream);
        }
      });

      this.room.on(
        RoomEvent.ConnectionQualityChanged,
        (quality: any, participant: any) => {
          if (participant === this.room?.localParticipant) {
            let status: ConnectionQuality['status'] = 'good';
            if (quality === LKQuality.Poor) status = 'poor';
            else if (quality === LKQuality.Lost) status = 'failed';

            const metrics: ConnectionQuality = {
              status,
              rttMs: 50,
              packetLossPercent: quality === LKQuality.Poor ? 5 : 0,
              connectionType: 'direct',
              isAudioPrioritized: quality === LKQuality.Poor,
            };
            this.emitQuality(metrics);
          }
        }
      );

      await this.room.connect(this.url, token);
      await this.room.localParticipant.enableCameraAndMicrophone();
    } catch (err) {
      console.warn('LiveKit connect notice:', err);
    }
  }

  disconnect(): void {
    if (this.room) {
      try {
        this.room.disconnect();
      } catch (e) {
        // Safe disconnect
      }
      this.room = null;
    }
  }

  async publishLocalMedia(audioTrack: MediaStreamTrack, videoTrack: MediaStreamTrack): Promise<void> {
    if (!this.room) return;
    try {
      if (this.room.localParticipant) {
        if (audioTrack) {
          await this.room.localParticipant.publishTrack(audioTrack);
        }
        if (videoTrack) {
          await this.room.localParticipant.publishTrack(videoTrack);
        }
      }
    } catch (err) {
      console.warn('Failed to publish local media via LiveKit:', err);
    }
  }

  async publishScreenShare(screenTrack: MediaStreamTrack): Promise<void> {
    this.screenShareEnabled = true;
    if (this.room?.localParticipant) {
      try {
        await this.room.localParticipant.setScreenShareEnabled(true);
      } catch (err) {
        console.warn('Screen share publish notice:', err);
      }
    }
  }

  async stopScreenShare(): Promise<void> {
    this.screenShareEnabled = false;
    if (this.room?.localParticipant) {
      try {
        await this.room.localParticipant.setScreenShareEnabled(false);
      } catch (err) {
        console.warn('Screen share stop notice:', err);
      }
    }
  }

  toggleMic(enabled?: boolean): boolean {
    const next = enabled !== undefined ? enabled : !this.micEnabled;
    this.micEnabled = next;
    if (this.room?.localParticipant) {
      this.room.localParticipant.setMicrophoneEnabled(next).catch(() => {});
    }
    return this.micEnabled;
  }

  toggleCamera(enabled?: boolean): boolean {
    const next = enabled !== undefined ? enabled : !this.cameraEnabled;
    this.cameraEnabled = next;
    if (this.room?.localParticipant) {
      this.room.localParticipant.setCameraEnabled(next).catch(() => {});
    }
    return this.cameraEnabled;
  }

  onRemoteTrack(callback: (track: MediaStreamTrack, stream: MediaStream) => void): void {
    this.remoteTrackCallbacks.push(callback);
  }

  onQualityMetrics(callback: (metrics: ConnectionQuality) => void): void {
    this.qualityCallbacks.push(callback);
    callback(this.currentQuality);
  }

  async switchDevice(kind: 'audioinput' | 'videoinput', deviceId: string): Promise<void> {
    if (!this.room) return;
    try {
      if (kind === 'audioinput') {
        await this.room.switchActiveDevice('audioinput', deviceId);
      } else {
        await this.room.switchActiveDevice('videoinput', deviceId);
      }
    } catch (err) {
      console.warn(`Failed to switch LiveKit ${kind} device:`, err);
    }
  }

  // Exposed for tests or synthetic dispatches
  emitRemoteTrack(track: MediaStreamTrack, stream: MediaStream): void {
    for (const cb of this.remoteTrackCallbacks) {
      try {
        cb(track, stream);
      } catch (e) {
        console.error(e);
      }
    }
  }

  emitQuality(metrics: ConnectionQuality): void {
    this.currentQuality = metrics;
    for (const cb of this.qualityCallbacks) {
      try {
        cb(metrics);
      } catch (e) {
        console.error(e);
      }
    }
  }
}
