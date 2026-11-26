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
  private publishedScreenTrack: MediaStreamTrack | null = null;
  private remoteTrackCallbacks: ((track: MediaStreamTrack, stream: MediaStream) => void)[] = [];
  private remoteScreenTrackCallbacks: ((track: MediaStreamTrack | null, stream: MediaStream | null) => void)[] = [];
  private qualityCallbacks: ((metrics: ConnectionQuality) => void)[] = [];
  private participantCallbacks: ((participants: any[]) => void)[] = [];
  private currentQuality: ConnectionQuality = createDefaultQuality();

  constructor(serverUrl?: string) {
    this.url =
      serverUrl ||
      (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_LIVEKIT_URL) ||
      '';
    if (!this.url && typeof window !== 'undefined') {
      console.warn('LiveKitMediaSession: NEXT_PUBLIC_LIVEKIT_URL is not configured.');
    }
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

  async connect(roomId: string, token: string, serverUrl?: string): Promise<void> {
    if (serverUrl) {
      this.url = serverUrl;
    }
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
        const isScreenShare =
          track.source === Track.Source.ScreenShare ||
          publication?.source === Track.Source.ScreenShare ||
          publication?.source === 'screen_share' ||
          publication?.trackName?.includes('screen');

        if (track.kind === 'audio' && typeof document !== 'undefined') {
          try {
            const audioElement = track.attach();
            audioElement.style.display = 'none';
            document.body.appendChild(audioElement);
          } catch (err) {
            console.warn('Audio track auto-attach notice:', err);
          }
        } else if (isScreenShare && track.mediaStreamTrack) {
          const mediaStream = new MediaStream([track.mediaStreamTrack]);
          this.emitRemoteScreenTrack(track.mediaStreamTrack, mediaStream);
        } else if (track.mediaStreamTrack) {
          const mediaStream = new MediaStream([track.mediaStreamTrack]);
          this.emitRemoteTrack(track.mediaStreamTrack, mediaStream);
        }
        this.emitParticipants();
      });

      this.room.on(RoomEvent.TrackUnsubscribed, (track: any, publication: any) => {
        const isScreenShare =
          track?.source === Track.Source.ScreenShare ||
          publication?.source === Track.Source.ScreenShare ||
          publication?.source === 'screen_share' ||
          publication?.trackName?.includes('screen');

        if (isScreenShare) {
          this.emitRemoteScreenTrack(null, null);
        }

        if (track && typeof track.detach === 'function') {
          try {
            const elements = track.detach();
            elements.forEach((el: any) => el?.remove?.());
          } catch {}
        }
        this.emitParticipants();
      });

      this.room.on(RoomEvent.ParticipantConnected, () => {
        this.emitParticipants();
      });

      this.room.on(RoomEvent.ParticipantDisconnected, () => {
        this.emitParticipants();
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
      this.emitParticipants();

      try {
        await this.room.localParticipant.enableCameraAndMicrophone();
      } catch (mediaErr) {
        console.warn('LiveKit local device auto-enable skipped:', mediaErr);
      }
    } catch (err) {
      console.warn('LiveKit connect notice:', err);
    }
  }

  public getLocalStream(): MediaStream | null {
    if (!this.room?.localParticipant) return null;
    const tracks: MediaStreamTrack[] = [];
    try {
      this.room.localParticipant.trackPublications?.forEach?.((pub: any) => {
        if (pub.track?.mediaStreamTrack) {
          tracks.push(pub.track.mediaStreamTrack);
        }
      });
    } catch {}
    return tracks.length > 0 ? new MediaStream(tracks) : null;
  }

  public getParticipants(): any[] {
    if (!this.room) return [];
    const result: any[] = [];
    try {
      if (this.room.remoteParticipants) {
        this.room.remoteParticipants.forEach((p: any) => {
          result.push({
            id: p.identity || p.sid,
            name: p.name || p.identity,
            role: p.metadata ? JSON.parse(p.metadata)?.role : 'student',
            isMicOn: p.isMicrophoneEnabled ?? true,
            isCameraOn: p.isCameraEnabled ?? true,
          });
        });
      }
    } catch {}
    return result;
  }

  public onParticipantsChange(callback: (participants: any[]) => void): void {
    this.participantCallbacks.push(callback);
    callback(this.getParticipants());
  }

  public emitParticipants(customParticipants?: any[]): void {
    const list = customParticipants || this.getParticipants();
    for (const cb of this.participantCallbacks) {
      try {
        cb(list);
      } catch (e) {
        console.error(e);
      }
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
    this.publishedScreenTrack = screenTrack || null;
    if (this.room?.localParticipant) {
      try {
        if (screenTrack) {
          await this.room.localParticipant.publishTrack(screenTrack, {
            name: 'screen_share',
            source: 'screen_share',
          });
        } else {
          await this.room.localParticipant.setScreenShareEnabled(true);
        }
      } catch (err) {
        console.warn('Screen share publish notice:', err);
      }
    }
  }

  async stopScreenShare(): Promise<void> {
    this.screenShareEnabled = false;
    if (this.room?.localParticipant) {
      try {
        if (this.publishedScreenTrack && typeof this.room.localParticipant.unpublishTrack === 'function') {
          await this.room.localParticipant.unpublishTrack(this.publishedScreenTrack);
          this.publishedScreenTrack = null;
        } else {
          const screenPub = this.room.localParticipant.getTrackPublication?.('screen_share');
          if (screenPub && typeof this.room.localParticipant.unpublishTrack === 'function') {
            await this.room.localParticipant.unpublishTrack(screenPub.track);
          }
        }
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

  onRemoteScreenTrack(callback: (track: MediaStreamTrack | null, stream: MediaStream | null) => void): void {
    this.remoteScreenTrackCallbacks.push(callback);
  }

  emitRemoteScreenTrack(track: MediaStreamTrack | null, stream: MediaStream | null): void {
    for (const cb of this.remoteScreenTrackCallbacks) {
      try {
        cb(track, stream);
      } catch (e) {
        console.error(e);
      }
    }
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
