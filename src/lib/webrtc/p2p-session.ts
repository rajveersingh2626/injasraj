import {
  IMediaSession,
  ConnectionQuality,
} from '../../types/media';
import { parseRTCStats, StatsSnapshot } from './stats-parser';

export interface ISignalingAdapter {
  connect(roomId: string, userId: string): Promise<void>;
  disconnect(): void;
  sendOffer(sdp: RTCSessionDescriptionInit): Promise<void>;
  sendAnswer(sdp: RTCSessionDescriptionInit): Promise<void>;
  sendCandidate(candidate: RTCIceCandidateInit): Promise<void>;
  onOffer(callback: (sdp: RTCSessionDescriptionInit, senderId: string) => void): void;
  onAnswer(callback: (sdp: RTCSessionDescriptionInit, senderId: string) => void): void;
  onCandidate(callback: (candidate: RTCIceCandidateInit, senderId: string) => void): void;
  onPeerJoined(callback: (peerId: string) => void): void;
  onPeerLeft(callback: (peerId: string) => void): void;
}

export const BASE_STUN_SERVERS: RTCIceServer[] = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  { urls: 'stun:stun.cloudflare.com:3478' },
];

export const DEFAULT_FALLBACK_TURN_SERVERS: RTCIceServer[] = [
  // Multi-transport fallback TURN covering UDP, TCP port 80/443, and TURNS over TLS port 443/5349
  {
    urls: [
      'turn:openrelay.metered.ca:80',
      'turn:openrelay.metered.ca:443',
      'turn:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:443?transport=tcp',
      'turns:openrelay.metered.ca:5349?transport=tcp',
    ],
    username: 'openrelay',
    credential: 'openrelay',
  },
];

/**
 * Expands a TURN server definition with TCP and TLS variants if not already specified,
 * ensuring seamless traversal across restrictive corporate firewalls that block outbound UDP.
 */
export function expandTurnTransports(server: RTCIceServer): RTCIceServer {
  const currentUrls = Array.isArray(server.urls) ? server.urls : [server.urls];
  const expandedUrls: string[] = [];

  for (const url of currentUrls) {
    if (!url) continue;
    if (!expandedUrls.includes(url)) {
      expandedUrls.push(url);
    }
    // If it's a standard TURN URL without explicit transport, generate UDP and TCP variants
    if (url.startsWith('turn:') && !url.includes('?transport=')) {
      const udp = `${url}?transport=udp`;
      const tcp = `${url}?transport=tcp`;
      if (!expandedUrls.includes(udp)) expandedUrls.push(udp);
      if (!expandedUrls.includes(tcp)) expandedUrls.push(tcp);
    } else if (url.startsWith('turns:') && !url.includes('?transport=')) {
      const tcp = `${url}?transport=tcp`;
      if (!expandedUrls.includes(tcp)) expandedUrls.push(tcp);
    }
  }

  return {
    ...server,
    urls: expandedUrls.length === 1 ? expandedUrls[0] : expandedUrls,
  };
}

export function parseTurnServers(envVar?: string): RTCIceServer[] {
  const raw =
    envVar !== undefined
      ? envVar
      : typeof process !== 'undefined' && process.env
        ? process.env.NEXT_PUBLIC_TURN_SERVERS || process.env.NEXT_PUBLIC_ICE_SERVERS
        : undefined;

  if (!raw) {
    if (
      typeof process !== 'undefined' &&
      process.env &&
      process.env.NEXT_PUBLIC_TURN_URL
    ) {
      const urls = process.env.NEXT_PUBLIC_TURN_URL.split(',').map((u) => u.trim()).filter(Boolean);
      return [
        {
          urls: urls.length === 1 ? urls[0] : urls,
          username: process.env.NEXT_PUBLIC_TURN_USERNAME || '',
          credential: process.env.NEXT_PUBLIC_TURN_CREDENTIAL || '',
        },
      ];
    }
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : [parsed];
    return list
      .map((item: any) => {
        if (!item || typeof item !== 'object') return null;
        // Normalize RFC 5766 'url' or WebRTC standard 'urls'
        const rawUrls = item.urls !== undefined ? item.urls : item.url;
        if (!rawUrls) return null;
        const server: RTCIceServer = {
          urls: rawUrls,
        };
        if (item.username !== undefined) server.username = item.username;
        if (item.credential !== undefined) server.credential = item.credential;
        return server;
      })
      .filter((s): s is RTCIceServer => s !== null);
  } catch {
    const urls = raw.split(',').map((u) => u.trim()).filter(Boolean);
    if (urls.length > 0) {
      return [{ urls: urls.length === 1 ? urls[0] : urls }];
    }
  }
  return [];
}

export interface ResolveIceServersOptions {
  includeFallbackTurn?: boolean;
  expandTransports?: boolean;
}

export function resolveIceServers(
  customServers?: RTCIceServer[],
  options?: ResolveIceServersOptions
): RTCIceServer[] {
  if (customServers && customServers.length > 0) {
    return options?.expandTransports
      ? customServers.map(expandTurnTransports)
      : customServers;
  }

  const servers: RTCIceServer[] = [...BASE_STUN_SERVERS];
  const turnEnv =
    typeof process !== 'undefined' && process.env
      ? process.env.NEXT_PUBLIC_TURN_SERVERS
      : undefined;

  let turnServers = parseTurnServers(turnEnv);

  if (turnServers.length === 0) {
    const enableFallback =
      options?.includeFallbackTurn ||
      (typeof process !== 'undefined' &&
        process.env?.NEXT_PUBLIC_ENABLE_FALLBACK_TURN === 'true');
    if (enableFallback) {
      turnServers = [...DEFAULT_FALLBACK_TURN_SERVERS];
    }
  }

  if (options?.expandTransports && turnServers.length > 0) {
    turnServers = turnServers.map(expandTurnTransports);
  }

  return [...servers, ...turnServers];
}

export const DEFAULT_ICE_SERVERS: RTCIceServer[] = resolveIceServers();

export const DEFAULT_VIDEO_CONSTRAINTS: MediaTrackConstraints = {
  width: { ideal: 1280, max: 1280 },
  height: { ideal: 720, max: 720 },
  frameRate: { ideal: 30, max: 30 },
};

export const DEFAULT_AUDIO_CONSTRAINTS: MediaTrackConstraints & { latency?: number } = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  sampleRate: 48000,
  channelCount: 1,
  latency: 0,
};

export async function acquireOptimizedUserMedia(
  constraints?: MediaStreamConstraints
): Promise<MediaStream> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.mediaDevices ||
    typeof navigator.mediaDevices.getUserMedia !== 'function'
  ) {
    throw new Error('navigator.mediaDevices.getUserMedia is not available');
  }

  const finalConstraints: MediaStreamConstraints = {
    video:
      constraints?.video === false
        ? false
        : {
            ...DEFAULT_VIDEO_CONSTRAINTS,
            ...(typeof constraints?.video === 'object' ? constraints.video : {}),
          },
    audio:
      constraints?.audio === false
        ? false
        : {
            ...DEFAULT_AUDIO_CONSTRAINTS,
            ...(typeof constraints?.audio === 'object' ? constraints.audio : {}),
          },
  };

  return navigator.mediaDevices.getUserMedia(finalConstraints);
}

export interface P2PSessionOptions {
  iceServers?: RTCIceServer[];
  iceTransportPolicy?: RTCIceTransportPolicy;
  polite?: boolean;
  peerConnection?: RTCPeerConnection;
  includeFallbackTurn?: boolean;
  expandTransports?: boolean;
}

export class P2PWebRTCMediaSession implements IMediaSession {
  private peerConnection: RTCPeerConnection | null = null;
  private signaling: ISignalingAdapter;
  private options: P2PSessionOptions;
  public iceServers: RTCIceServer[];
  public iceTransportPolicy: RTCIceTransportPolicy;
  private isRestartingIce: boolean = false;

  // Perfect Negotiation state
  public polite: boolean;
  public makingOffer: boolean = false;
  public ignoreOffer: boolean = false;
  public isSettingRemoteAnswerPending: boolean = false;

  // Media tracks & streams
  private localAudioTrack?: MediaStreamTrack;
  private localVideoTrack?: MediaStreamTrack;
  private originalCameraTrack?: MediaStreamTrack;
  private currentScreenTrack?: MediaStreamTrack;
  private localStream?: MediaStream;

  // Senders
  private audioSender?: RTCRtpSender;
  private videoSender?: RTCRtpSender;

  // State flags
  private isScreenSharing: boolean = false;

  // Telemetry & Stats
  private statsInterval: any = null;
  private prevSnapshot?: StatsSnapshot;

  // Callback registries
  private remoteTrackCallbacks: Array<(track: MediaStreamTrack, stream: MediaStream) => void> = [];
  private remoteScreenTrackCallbacks: Array<(track: MediaStreamTrack | null, stream: MediaStream | null) => void> = [];
  private qualityCallbacks: Array<(metrics: ConnectionQuality) => void> = [];

  constructor(signaling: ISignalingAdapter, options: P2PSessionOptions = {}) {
    this.signaling = signaling;
    this.options = options;
    this.polite = options.polite ?? true;
    this.iceTransportPolicy =
      options.iceTransportPolicy ||
      (typeof process !== 'undefined' &&
        (process.env?.NEXT_PUBLIC_ICE_TRANSPORT_POLICY as RTCIceTransportPolicy)) ||
      'all';
    this.iceServers = resolveIceServers(options.iceServers, {
      includeFallbackTurn: options.includeFallbackTurn,
      expandTransports: options.expandTransports,
    });
    if (options.peerConnection) {
      this.peerConnection = options.peerConnection;
    }
  }

  public getPeerConnection(): RTCPeerConnection | null {
    return this.peerConnection;
  }

  public getIsScreenSharing(): boolean {
    return this.isScreenSharing;
  }

  async connect(roomId: string, token: string): Promise<void> {
    // 1. Connect signaling adapter
    await this.signaling.connect(roomId, token);

    // 2. Initialize RTCPeerConnection if not provided
    if (!this.peerConnection) {
      if (typeof RTCPeerConnection !== 'undefined') {
        this.peerConnection = new RTCPeerConnection({
          iceServers: this.iceServers,
          iceCandidatePoolSize: 2,
          iceTransportPolicy: this.iceTransportPolicy,
        });
      } else {
        throw new Error('RTCPeerConnection is not supported in this runtime environment');
      }
    }

    // 3. Register PeerConnection events
    this.setupPeerConnectionEvents();

    // 4. Register Signaling events for Perfect Negotiation
    this.setupSignalingEvents();

    // 5. If local media was already published, add tracks
    if (this.peerConnection) {
      if (this.localAudioTrack && !this.audioSender && typeof this.peerConnection.addTrack === 'function') {
        this.audioSender = this.peerConnection.addTrack(
          this.localAudioTrack,
          ...(this.localStream ? [this.localStream] : [])
        );
      }
      if (this.localVideoTrack && !this.videoSender && typeof this.peerConnection.addTrack === 'function') {
        this.videoSender = this.peerConnection.addTrack(
          this.localVideoTrack,
          ...(this.localStream ? [this.localStream] : [])
        );
        this.applyVideoEncodingParameters(this.videoSender).catch(() => {});
      }
    }

    // 6. Start 2-second stats polling loop
    this.startStatsPolling();
  }

  private setupPeerConnectionEvents(): void {
    if (!this.peerConnection) return;

    // ICE Candidate discovery
    this.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
      if (event && event.candidate) {
        const candidateInit =
          typeof (event.candidate as any).toJSON === 'function'
            ? (event.candidate as any).toJSON()
            : event.candidate;
        this.signaling.sendCandidate(candidateInit).catch((err) => {
          console.error('Failed to send ICE candidate:', err);
        });
      }
    };

    // Remote Track received
    this.peerConnection.ontrack = (event: RTCTrackEvent) => {
      const track = event.track;
      let stream: MediaStream;
      if (event.streams && event.streams[0]) {
        stream = event.streams[0];
      } else if (typeof MediaStream !== 'undefined') {
        stream = new MediaStream([track]);
      } else {
        stream = { id: 'remote-stream', getTracks: () => [track] } as any;
      }

      for (const cb of this.remoteTrackCallbacks) {
        try {
          cb(track, stream);
        } catch (err) {
          console.error('Error in onRemoteTrack callback:', err);
        }
      }
    };

    // ICE connection state changes: restart ICE on disconnection or failure (e.g. restrictive firewall blocking direct path)
    this.peerConnection.oniceconnectionstatechange = () => {
      if (!this.peerConnection) return;
      const state = this.peerConnection.iceConnectionState;
      if (state === 'disconnected' || state === 'failed') {
        this.restartIce();
      }
    };

    // Connection state changes: restart ICE if overall peer connection fails
    this.peerConnection.onconnectionstatechange = () => {
      if (!this.peerConnection) return;
      if (this.peerConnection.connectionState === 'failed') {
        this.restartIce();
      }
    };

    // Perfect Negotiation: negotiationneeded
    this.peerConnection.onnegotiationneeded = async () => {
      try {
        this.makingOffer = true;
        let offer: RTCSessionDescriptionInit;
        if (typeof this.peerConnection!.createOffer === 'function') {
          offer = await this.peerConnection!.createOffer();
          await this.peerConnection!.setLocalDescription(offer);
        } else {
          await this.peerConnection!.setLocalDescription();
          offer = this.peerConnection!.localDescription!;
        }
        await this.signaling.sendOffer(this.peerConnection!.localDescription || offer);
      } catch (err) {
        console.error('Error during negotiationneeded offer generation:', err);
      } finally {
        this.makingOffer = false;
      }
    };
  }

  private setupSignalingEvents(): void {
    // Remote Offer (Perfect Negotiation)
    this.signaling.onOffer(async (offer: RTCSessionDescriptionInit, senderId: string) => {
      if (!this.peerConnection) return;
      try {
        const readyForOffer =
          !this.makingOffer &&
          (this.peerConnection.signalingState === 'stable' || this.isSettingRemoteAnswerPending);
        const offerCollision = !readyForOffer;

        this.ignoreOffer = !this.polite && offerCollision;
        if (this.ignoreOffer) {
          return;
        }

        if (offerCollision && this.polite) {
          if (this.peerConnection.signalingState !== 'stable') {
            try {
              await this.peerConnection.setLocalDescription({ type: 'rollback' });
            } catch {
              // Rollback fallback for mock environments
            }
          }
        }

        await this.peerConnection.setRemoteDescription(offer);
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        await this.signaling.sendAnswer(this.peerConnection.localDescription || answer);
      } catch (err) {
        console.error('Error processing remote SDP offer:', err);
      }
    });

    // Remote Answer (Perfect Negotiation)
    this.signaling.onAnswer(async (answer: RTCSessionDescriptionInit, senderId: string) => {
      if (!this.peerConnection) return;
      try {
        this.isSettingRemoteAnswerPending = true;
        await this.peerConnection.setRemoteDescription(answer);
      } catch (err) {
        console.error('Error processing remote SDP answer:', err);
      } finally {
        this.isSettingRemoteAnswerPending = false;
      }
    });

    // Remote ICE Candidate
    this.signaling.onCandidate(async (candidate: RTCIceCandidateInit, senderId: string) => {
      if (!this.peerConnection) return;
      try {
        if (!candidate) return;
        try {
          await this.peerConnection.addIceCandidate(candidate);
        } catch (err) {
          if (!this.ignoreOffer) {
            throw err;
          }
        }
      } catch (err) {
        console.error('Error adding remote ICE candidate:', err);
      }
    });

    // Peer Joined
    this.signaling.onPeerJoined((peerId: string) => {
      if (!this.polite && this.peerConnection && this.peerConnection.signalingState === 'stable') {
        const senders =
          typeof this.peerConnection.getSenders === 'function'
            ? this.peerConnection.getSenders()
            : [];
        if (senders.length > 0) {
          this.initiateOffer().catch((err) => {
            console.warn('Initiate offer on peer join failed:', err);
          });
        }
      }
    });

    // Peer Left
    this.signaling.onPeerLeft((peerId: string) => {
      // Remote peer disconnected
    });
  }

  public async initiateOffer(options?: RTCOfferOptions): Promise<void> {
    if (!this.peerConnection) return;
    try {
      this.makingOffer = true;
      let offer: RTCSessionDescriptionInit;
      if (typeof this.peerConnection.createOffer === 'function') {
        offer = await this.peerConnection.createOffer(options);
        await this.peerConnection.setLocalDescription(offer);
      } else {
        await this.peerConnection.setLocalDescription();
        offer = this.peerConnection.localDescription!;
      }
      await this.signaling.sendOffer(this.peerConnection.localDescription || offer);
    } catch (err) {
      console.error('Error initiating offer:', err);
    } finally {
      this.makingOffer = false;
    }
  }

  public restartIce(): void {
    if (!this.peerConnection || this.isRestartingIce) return;
    this.isRestartingIce = true;
    try {
      if (typeof this.peerConnection.restartIce === 'function') {
        this.peerConnection.restartIce();
      }
      // Also trigger offer with iceRestart flag if signaling state is stable
      if (this.peerConnection.signalingState === 'stable') {
        this.initiateOffer({ iceRestart: true }).catch((err) => {
          console.warn('ICE restart offer initiation failed:', err);
        });
      }
    } finally {
      setTimeout(() => {
        this.isRestartingIce = false;
      }, 1000);
    }
  }

  async publishLocalMedia(
    audioTrack?: MediaStreamTrack | null,
    videoTrack?: MediaStreamTrack | null
  ): Promise<void> {
    if (audioTrack) {
      this.localAudioTrack = audioTrack;
    }
    if (videoTrack) {
      this.localVideoTrack = videoTrack;
      this.originalCameraTrack = videoTrack;
    }

    const tracks = [audioTrack, videoTrack].filter(Boolean) as MediaStreamTrack[];
    if (typeof MediaStream !== 'undefined' && tracks.length > 0) {
      this.localStream = new MediaStream(tracks);
    }

    if (this.peerConnection) {
      if (audioTrack && typeof this.peerConnection.addTrack === 'function') {
        this.audioSender = this.peerConnection.addTrack(
          audioTrack,
          ...(this.localStream ? [this.localStream] : [])
        );
      }
      if (videoTrack && typeof this.peerConnection.addTrack === 'function') {
        this.videoSender = this.peerConnection.addTrack(
          videoTrack,
          ...(this.localStream ? [this.localStream] : [])
        );
        this.applyVideoEncodingParameters(this.videoSender).catch(() => {});
      }
    }
  }

  public async applyVideoEncodingParameters(sender?: RTCRtpSender): Promise<void> {
    const videoSender = sender || this.getVideoSender();
    if (
      !videoSender ||
      typeof videoSender.getParameters !== 'function' ||
      typeof videoSender.setParameters !== 'function'
    ) {
      return;
    }
    try {
      const params = videoSender.getParameters() || {};
      if (!params.encodings || params.encodings.length === 0) {
        params.encodings = [{}];
      }
      params.encodings[0] = {
        ...params.encodings[0],
        maxBitrate: 800000,
        maxFramerate: 30,
        priority: 'high',
        networkPriority: 'high',
      };
      await videoSender.setParameters(params);
    } catch (err) {
      console.warn('Could not apply video sender encoding parameters:', err);
    }
  }

  private getVideoSender(): RTCRtpSender | undefined {
    if (this.peerConnection && typeof this.peerConnection.getSenders === 'function') {
      const senders = this.peerConnection.getSenders();
      const found = senders.find(
        (s) => s.track?.kind === 'video' || (s as any).kind === 'video'
      );
      if (found) return found;
    }
    return this.videoSender;
  }

  private getAudioSender(): RTCRtpSender | undefined {
    if (this.peerConnection && typeof this.peerConnection.getSenders === 'function') {
      const senders = this.peerConnection.getSenders();
      const found = senders.find(
        (s) => s.track?.kind === 'audio' || (s as any).kind === 'audio'
      );
      if (found) return found;
    }
    return this.audioSender;
  }

  async publishScreenShare(screenTrack: MediaStreamTrack): Promise<void> {
    const sender = this.getVideoSender();
    if (!sender) {
      throw new Error('No video sender found to publish screen share');
    }

    // Preserve existing camera track
    if (!this.originalCameraTrack) {
      this.originalCameraTrack = sender.track || this.localVideoTrack;
    }

    // Hot-swap video track without renegotiation
    if (typeof sender.replaceTrack === 'function') {
      await sender.replaceTrack(screenTrack);
    }

    this.currentScreenTrack = screenTrack;
    this.isScreenSharing = true;

    // Auto-revert when user clicks browser's native "Stop Sharing" button
    screenTrack.onended = () => {
      this.stopScreenShare().catch((err) => {
        console.warn('Auto-reverting screen share onended failed:', err);
      });
    };
  }

  async stopScreenShare(): Promise<void> {
    if (!this.isScreenSharing && !this.currentScreenTrack) {
      return;
    }

    const sender = this.getVideoSender();
    const cameraTrack = this.originalCameraTrack || this.localVideoTrack;

    if (sender && cameraTrack && typeof sender.replaceTrack === 'function') {
      await sender.replaceTrack(cameraTrack);
    }

    if (this.currentScreenTrack) {
      this.currentScreenTrack.onended = null;
      if (typeof this.currentScreenTrack.stop === 'function') {
        this.currentScreenTrack.stop();
      }
      this.currentScreenTrack = undefined;
    }

    this.isScreenSharing = false;
  }

  toggleMic(enabled?: boolean): boolean {
    if (!this.localAudioTrack) return false;
    this.localAudioTrack.enabled =
      enabled !== undefined ? enabled : !this.localAudioTrack.enabled;
    return this.localAudioTrack.enabled;
  }

  toggleCamera(enabled?: boolean): boolean {
    const target = this.originalCameraTrack || this.localVideoTrack;
    if (!target) return false;
    target.enabled = enabled !== undefined ? enabled : !target.enabled;
    if (this.localVideoTrack && this.localVideoTrack !== target) {
      this.localVideoTrack.enabled = target.enabled;
    }
    return target.enabled;
  }

  async switchDevice(
    kind: 'audioinput' | 'videoinput',
    deviceId: string
  ): Promise<void> {
    if (
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices ||
      typeof navigator.mediaDevices.getUserMedia !== 'function'
    ) {
      throw new Error('navigator.mediaDevices.getUserMedia is not available');
    }

    const constraints: MediaStreamConstraints =
      kind === 'audioinput'
        ? { audio: { deviceId: { exact: deviceId } }, video: false }
        : { video: { deviceId: { exact: deviceId } }, audio: false };

    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    const newTrack =
      kind === 'audioinput'
        ? stream.getAudioTracks()[0]
        : stream.getVideoTracks()[0];

    if (!newTrack) {
      throw new Error(`No ${kind} track obtained from device ${deviceId}`);
    }

    if (kind === 'audioinput') {
      const sender = this.getAudioSender();
      if (sender && typeof sender.replaceTrack === 'function') {
        await sender.replaceTrack(newTrack);
      }
      if (this.localAudioTrack && typeof this.localAudioTrack.stop === 'function') {
        this.localAudioTrack.stop();
      }
      this.localAudioTrack = newTrack;
    } else {
      const sender = this.getVideoSender();
      if (!this.isScreenSharing && sender && typeof sender.replaceTrack === 'function') {
        await sender.replaceTrack(newTrack);
      }
      if (
        this.originalCameraTrack &&
        typeof this.originalCameraTrack.stop === 'function'
      ) {
        this.originalCameraTrack.stop();
      }
      this.originalCameraTrack = newTrack;
      this.localVideoTrack = newTrack;
    }
  }

  onRemoteTrack(
    callback: (track: MediaStreamTrack, stream: MediaStream) => void
  ): void {
    this.remoteTrackCallbacks.push(callback);
  }

  onRemoteScreenTrack(
    callback: (track: MediaStreamTrack | null, stream: MediaStream | null) => void
  ): void {
    this.remoteScreenTrackCallbacks.push(callback);
  }

  emitRemoteScreenTrack(
    track: MediaStreamTrack | null,
    stream: MediaStream | null
  ): void {
    for (const cb of this.remoteScreenTrackCallbacks) {
      try {
        cb(track, stream);
      } catch (err) {
        console.error('Error in onRemoteScreenTrack callback:', err);
      }
    }
  }

  onQualityMetrics(callback: (metrics: ConnectionQuality) => void): void {
    this.qualityCallbacks.push(callback);
  }

  public async pollStats(): Promise<ConnectionQuality | null> {
    if (!this.peerConnection || typeof this.peerConnection.getStats !== 'function') {
      return null;
    }

    try {
      const statsReport = await this.peerConnection.getStats();
      const { quality, nextSnapshot } = parseRTCStats(
        statsReport,
        this.prevSnapshot
      );
      this.prevSnapshot = nextSnapshot;

      for (const cb of this.qualityCallbacks) {
        try {
          cb(quality);
        } catch (err) {
          console.error('Error in onQualityMetrics callback:', err);
        }
      }
      return quality;
    } catch (err) {
      console.warn('Error fetching WebRTC stats:', err);
      return null;
    }
  }

  private startStatsPolling(): void {
    this.stopStatsPolling();
    this.statsInterval = setInterval(async () => {
      await this.pollStats();
    }, 2000);
  }

  private stopStatsPolling(): void {
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
      this.statsInterval = null;
    }
  }

  disconnect(): void {
    this.stopStatsPolling();

    if (this.currentScreenTrack) {
      this.currentScreenTrack.onended = null;
      if (typeof this.currentScreenTrack.stop === 'function') {
        this.currentScreenTrack.stop();
      }
      this.currentScreenTrack = undefined;
    }

    if (this.localAudioTrack && typeof this.localAudioTrack.stop === 'function') {
      this.localAudioTrack.stop();
      this.localAudioTrack = undefined;
    }

    if (this.localVideoTrack && typeof this.localVideoTrack.stop === 'function') {
      this.localVideoTrack.stop();
      this.localVideoTrack = undefined;
    }

    if (
      this.originalCameraTrack &&
      typeof this.originalCameraTrack.stop === 'function'
    ) {
      this.originalCameraTrack.stop();
      this.originalCameraTrack = undefined;
    }

    if (this.peerConnection) {
      this.peerConnection.onicecandidate = null;
      this.peerConnection.ontrack = null;
      this.peerConnection.onnegotiationneeded = null;
      this.peerConnection.oniceconnectionstatechange = null;
      if (typeof this.peerConnection.close === 'function') {
        this.peerConnection.close();
      }
      this.peerConnection = null;
    }

    if (this.signaling && typeof this.signaling.disconnect === 'function') {
      this.signaling.disconnect();
    }

    this.remoteTrackCallbacks = [];
    this.qualityCallbacks = [];
    this.isScreenSharing = false;
    this.makingOffer = false;
    this.ignoreOffer = false;
    this.isSettingRemoteAnswerPending = false;
  }
}
