export type CandidateType = 'host' | 'srflx' | 'prflx' | 'relay' | 'unknown' | 'direct' | 'failed';

export type ClassSessionStatus = 'waiting' | 'in_progress' | 'completed';

export interface ConnectionQuality {
  status: 'connecting' | 'good' | 'fair' | 'poor' | 'failed';
  rttMs: number;
  packetLossPercent: number;
  connectionType: CandidateType;
  isAudioPrioritized: boolean;
  videoResolution?: { width: number; height: number };
  fps?: number;
}

export function isRelayedConnection(type: CandidateType): boolean {
  return type === 'relay';
}

export function createDefaultQuality(): ConnectionQuality {
  return {
    status: 'connecting',
    rttMs: 0,
    packetLossPercent: 0,
    connectionType: 'unknown',
    isAudioPrioritized: false,
  };
}

export interface TimerState {
  mode: 'countdown' | 'stopwatch';
  remainingSeconds: number;
  initialSeconds: number;
  isRunning: boolean;
  isAlarm: boolean;
}

export interface SignalingMessage {
  type: 'peer-joined' | 'peer-left' | 'sdp-offer' | 'sdp-answer' | 'ice-candidate';
  senderId: string;
  payload: any;
}

export interface IMediaSession {
  connect(roomId: string, token: string): Promise<void>;
  disconnect(): void;
  publishLocalMedia(audioTrack: MediaStreamTrack, videoTrack: MediaStreamTrack): Promise<void>;
  publishScreenShare(screenTrack: MediaStreamTrack): Promise<void>;
  stopScreenShare(): Promise<void>;
  toggleMic(enabled?: boolean): boolean;
  toggleCamera(enabled?: boolean): boolean;
  getLocalStream?(): MediaStream | null;
  onLocalStream?(callback: (stream: MediaStream | null) => void): void;
  onRemoteTrack(callback: (track: MediaStreamTrack, stream: MediaStream) => void): void;
  onRemoteScreenTrack?(callback: (track: MediaStreamTrack | null, stream: MediaStream | null) => void): void;
  onQualityMetrics(callback: (metrics: ConnectionQuality) => void): void;
  switchDevice(kind: 'audioinput' | 'videoinput', deviceId: string): Promise<void>;
}
