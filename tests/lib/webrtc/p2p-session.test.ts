import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  P2PWebRTCMediaSession,
  ISignalingAdapter,
  DEFAULT_ICE_SERVERS,
  BASE_STUN_SERVERS,
  resolveIceServers,
  parseTurnServers,
} from '../../../src/lib/webrtc/p2p-session';
import { ConnectionQuality } from '../../../src/types/media';

describe('P2P WebRTC Session Engine & Screen Sharing', () => {
  let mockSignaling: ISignalingAdapter;
  let signalingCallbacks: {
    offer?: (sdp: RTCSessionDescriptionInit, senderId: string) => void;
    answer?: (sdp: RTCSessionDescriptionInit, senderId: string) => void;
    candidate?: (candidate: RTCIceCandidateInit, senderId: string) => void;
    peerJoined?: (peerId: string) => void;
    peerLeft?: (peerId: string) => void;
  };

  let mockPeerConnection: any;
  let mockAudioTrack: any;
  let mockVideoTrack: any;
  let mockScreenTrack: any;
  let originalEnv: string | undefined;

  function createMockTrack(kind: 'audio' | 'video', id: string = `${kind}-track-1`) {
    return {
      id,
      kind,
      enabled: true,
      stop: vi.fn(),
      onended: null as any,
    };
  }

  beforeEach(() => {
    originalEnv = process.env.NEXT_PUBLIC_TURN_SERVERS;
    delete process.env.NEXT_PUBLIC_TURN_SERVERS;

    signalingCallbacks = {};
    mockSignaling = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      sendOffer: vi.fn().mockResolvedValue(undefined),
      sendAnswer: vi.fn().mockResolvedValue(undefined),
      sendCandidate: vi.fn().mockResolvedValue(undefined),
      onOffer: vi.fn((cb) => {
        signalingCallbacks.offer = cb;
      }),
      onAnswer: vi.fn((cb) => {
        signalingCallbacks.answer = cb;
      }),
      onCandidate: vi.fn((cb) => {
        signalingCallbacks.candidate = cb;
      }),
      onPeerJoined: vi.fn((cb) => {
        signalingCallbacks.peerJoined = cb;
      }),
      onPeerLeft: vi.fn((cb) => {
        signalingCallbacks.peerLeft = cb;
      }),
    };

    mockAudioTrack = createMockTrack('audio', 'audio-1');
    mockVideoTrack = createMockTrack('video', 'video-cam-1');
    mockScreenTrack = createMockTrack('video', 'video-screen-1');

    const senders: any[] = [];
    mockPeerConnection = {
      signalingState: 'stable',
      iceConnectionState: 'new',
      localDescription: null as RTCSessionDescriptionInit | null,
      remoteDescription: null as RTCSessionDescriptionInit | null,
      onicecandidate: null as any,
      ontrack: null as any,
      oniceconnectionstatechange: null as any,
      onnegotiationneeded: null as any,
      addTrack: vi.fn((track: any) => {
        const sender = {
          track,
          kind: track.kind,
          replaceTrack: vi.fn(async (newTrack: any) => {
            sender.track = newTrack;
          }),
        };
        senders.push(sender);
        return sender;
      }),
      getSenders: vi.fn(() => senders),
      createOffer: vi.fn(async () => ({
        type: 'offer' as RTCSdpType,
        sdp: 'mock-local-offer-sdp',
      })),
      createAnswer: vi.fn(async () => ({
        type: 'answer' as RTCSdpType,
        sdp: 'mock-local-answer-sdp',
      })),
      setLocalDescription: vi.fn(async (desc?: RTCSessionDescriptionInit) => {
        mockPeerConnection.localDescription =
          desc || { type: 'offer' as RTCSdpType, sdp: 'mock-local-offer-sdp' };
      }),
      setRemoteDescription: vi.fn(async (desc: RTCSessionDescriptionInit) => {
        mockPeerConnection.remoteDescription = desc;
      }),
      addIceCandidate: vi.fn(async () => {}),
      restartIce: vi.fn(),
      getStats: vi.fn(async () => {
        const stats = new Map<string, any>();
        stats.set('pair-1', {
          id: 'pair-1',
          type: 'candidate-pair',
          state: 'succeeded',
          nominated: true,
          currentRoundTripTime: 0.05,
          localCandidateId: 'c1',
          remoteCandidateId: 'c2',
        });
        stats.set('c1', { id: 'c1', type: 'local-candidate', candidateType: 'host' });
        stats.set('c2', { id: 'c2', type: 'remote-candidate', candidateType: 'host' });
        stats.set('video-rtp', {
          id: 'video-rtp',
          type: 'inbound-rtp',
          kind: 'video',
          packetsLost: 1,
          packetsReceived: 99,
          bytesReceived: 10000,
          frameWidth: 1280,
          frameHeight: 720,
          framesPerSecond: 30,
        });
        return stats;
      }),
      close: vi.fn(),
    };

    // Global navigator.mediaDevices mock
    const mockGetUserMedia = vi.fn(async (constraints: MediaStreamConstraints) => {
      const isAudio = Boolean(constraints.audio);
      const track = createMockTrack(isAudio ? 'audio' : 'video', isAudio ? 'new-mic' : 'new-cam');
      return {
        getTracks: () => [track],
        getAudioTracks: () => (isAudio ? [track] : []),
        getVideoTracks: () => (!isAudio ? [track] : []),
      };
    });

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
      },
    });

    vi.stubGlobal('RTCPeerConnection', vi.fn().mockImplementation(() => mockPeerConnection));
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_TURN_SERVERS = originalEnv;
    } else {
      delete process.env.NEXT_PUBLIC_TURN_SERVERS;
    }
  });

  describe('ICE Server Discovery & Configuration', () => {
    it('provides Google and Cloudflare STUN servers by default', () => {
      expect(BASE_STUN_SERVERS).toEqual([
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.cloudflare.com:3478' },
      ]);

      const urls = DEFAULT_ICE_SERVERS.map((s) => s.urls);
      expect(urls).toContain('stun:stun.l.google.com:19302');
      expect(urls).toContain('stun:stun1.l.google.com:19302');
      expect(urls).toContain('stun:stun.cloudflare.com:3478');
    });

    it('parses NEXT_PUBLIC_TURN_SERVERS JSON array correctly', () => {
      const turnJson = JSON.stringify([
        {
          urls: 'turn:turn.myclassroom.org:3478',
          username: 'student1',
          credential: 'secret-password',
        },
      ]);
      const result = parseTurnServers(turnJson);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        urls: 'turn:turn.myclassroom.org:3478',
        username: 'student1',
        credential: 'secret-password',
      });
    });

    it('parses NEXT_PUBLIC_TURN_SERVERS comma-separated strings', () => {
      const turnStr = 'turn:coturn1.example.com:3478, turn:coturn2.example.com:3478';
      const result = parseTurnServers(turnStr);

      expect(result).toEqual([
        { urls: ['turn:coturn1.example.com:3478', 'turn:coturn2.example.com:3478'] },
      ]);
    });

    it('appends parsed TURN servers to STUN servers in resolveIceServers', () => {
      process.env.NEXT_PUBLIC_TURN_SERVERS = JSON.stringify([
        { urls: 'turn:coturn.cloud:3478', username: 'u', credential: 'p' },
      ]);

      const servers = resolveIceServers();
      expect(servers).toHaveLength(4);
      expect(servers[3].urls).toBe('turn:coturn.cloud:3478');
    });

    it('initializes RTCPeerConnection with discovered ICE servers', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling);
      await session.connect('room-101', 'token-abc');

      expect(RTCPeerConnection).toHaveBeenCalledWith({
        iceServers: expect.arrayContaining([
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun.cloudflare.com:3478' },
        ]),
      });
    });
  });

  describe('Session Connection & Lifecycle', () => {
    it('connects signaling adapter and registers listeners', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-alpha', 'user-jwt-123');

      expect(mockSignaling.connect).toHaveBeenCalledWith('room-alpha', 'user-jwt-123');
      expect(mockSignaling.onOffer).toHaveBeenCalled();
      expect(mockSignaling.onAnswer).toHaveBeenCalled();
      expect(mockSignaling.onCandidate).toHaveBeenCalled();
      expect(mockSignaling.onPeerJoined).toHaveBeenCalled();
      expect(mockSignaling.onPeerLeft).toHaveBeenCalled();
    });

    it('sets up peer connection events on connect', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      expect(mockPeerConnection.onicecandidate).toBeDefined();
      expect(mockPeerConnection.ontrack).toBeDefined();
      expect(mockPeerConnection.oniceconnectionstatechange).toBeDefined();
      expect(mockPeerConnection.onnegotiationneeded).toBeDefined();
    });

    it('cleans up all resources on disconnect', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);
      await session.publishScreenShare(mockScreenTrack);

      session.disconnect();

      expect(mockAudioTrack.stop).toHaveBeenCalled();
      expect(mockVideoTrack.stop).toHaveBeenCalled();
      expect(mockScreenTrack.stop).toHaveBeenCalled();
      expect(mockPeerConnection.close).toHaveBeenCalled();
      expect(mockSignaling.disconnect).toHaveBeenCalled();
      expect(session.getPeerConnection()).toBeNull();
      expect(session.getIsScreenSharing()).toBe(false);
    });

    it('handles idempotent disconnect calls gracefully', () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      expect(() => {
        session.disconnect();
        session.disconnect();
      }).not.toThrow();
    });
  });

  describe('Media Publishing & Track Management', () => {
    it('publishes local audio and video tracks to RTCPeerConnection', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);

      expect(mockPeerConnection.addTrack).toHaveBeenCalledTimes(2);
      expect(mockPeerConnection.getSenders()).toHaveLength(2);
    });

    it('allows publishing local media before calling connect', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);
      await session.connect('room-1', 'token-1');

      expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(mockAudioTrack);
      expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(mockVideoTrack);
    });

    it('toggles microphone track enabled state and returns boolean', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);

      expect(mockAudioTrack.enabled).toBe(true);

      // Toggle off
      const state1 = session.toggleMic();
      expect(state1).toBe(false);
      expect(mockAudioTrack.enabled).toBe(false);

      // Toggle on
      const state2 = session.toggleMic();
      expect(state2).toBe(true);
      expect(mockAudioTrack.enabled).toBe(true);

      // Explicit set to false
      const state3 = session.toggleMic(false);
      expect(state3).toBe(false);
      expect(mockAudioTrack.enabled).toBe(false);
    });

    it('toggles camera track enabled state and returns boolean', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);

      expect(mockVideoTrack.enabled).toBe(true);

      const state1 = session.toggleCamera();
      expect(state1).toBe(false);
      expect(mockVideoTrack.enabled).toBe(false);

      const state2 = session.toggleCamera(true);
      expect(state2).toBe(true);
      expect(mockVideoTrack.enabled).toBe(true);
    });

    it('returns false when toggling mic/camera without tracks set', () => {
      const session = new P2PWebRTCMediaSession(mockSignaling);
      expect(session.toggleMic()).toBe(false);
      expect(session.toggleCamera()).toBe(false);
    });
  });

  describe('Screen Sharing & Track Hot-Swapping', () => {
    it('hot-swaps video track with screen share track using replaceTrack without renegotiation', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);

      const senders = mockPeerConnection.getSenders();
      const videoSender = senders.find((s: any) => s.kind === 'video');

      expect(videoSender.track).toBe(mockVideoTrack);

      await session.publishScreenShare(mockScreenTrack);

      expect(videoSender.replaceTrack).toHaveBeenCalledWith(mockScreenTrack);
      expect(videoSender.track).toBe(mockScreenTrack);
      expect(session.getIsScreenSharing()).toBe(true);
      // No new offers sent for screen sharing track replacement
      expect(mockSignaling.sendOffer).not.toHaveBeenCalled();
    });

    it('reverts back to original camera track on stopScreenShare', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);

      await session.publishScreenShare(mockScreenTrack);
      const senders = mockPeerConnection.getSenders();
      const videoSender = senders.find((s: any) => s.kind === 'video');

      await session.stopScreenShare();

      expect(videoSender.replaceTrack).toHaveBeenCalledWith(mockVideoTrack);
      expect(videoSender.track).toBe(mockVideoTrack);
      expect(mockScreenTrack.stop).toHaveBeenCalled();
      expect(session.getIsScreenSharing()).toBe(false);
    });

    it('automatically reverts to camera track when user stops screen share natively (screenTrack.onended)', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);

      await session.publishScreenShare(mockScreenTrack);
      expect(mockScreenTrack.onended).toBeDefined();

      const senders = mockPeerConnection.getSenders();
      const videoSender = senders.find((s: any) => s.kind === 'video');

      // Trigger native onended
      mockScreenTrack.onended();

      // Give async microtasks a cycle to resolve
      await new Promise((r) => setTimeout(r, 10));

      expect(videoSender.replaceTrack).toHaveBeenCalledWith(mockVideoTrack);
      expect(session.getIsScreenSharing()).toBe(false);
    });

    it('throws error when publishScreenShare is called without active video sender', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      await expect(session.publishScreenShare(mockScreenTrack)).rejects.toThrow(
        /No video sender found/
      );
    });
  });

  describe('Device Switching (getUserMedia & replaceTrack)', () => {
    it('switches audio input device and replaces track on sender', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);

      const senders = mockPeerConnection.getSenders();
      const audioSender = senders.find((s: any) => s.kind === 'audio');

      await session.switchDevice('audioinput', 'mic-device-xyz');

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        audio: { deviceId: { exact: 'mic-device-xyz' } },
        video: false,
      });
      expect(audioSender.replaceTrack).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'audio', id: 'new-mic' })
      );
      expect(mockAudioTrack.stop).toHaveBeenCalled();
    });

    it('switches video input device and replaces track on sender', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);

      const senders = mockPeerConnection.getSenders();
      const videoSender = senders.find((s: any) => s.kind === 'video');

      await session.switchDevice('videoinput', 'cam-device-789');

      expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
        video: { deviceId: { exact: 'cam-device-789' } },
        audio: false,
      });
      expect(videoSender.replaceTrack).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'video', id: 'new-cam' })
      );
      expect(mockVideoTrack.stop).toHaveBeenCalled();
    });

    it('preserves active screen share when switching camera in background', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');
      await session.publishLocalMedia(mockAudioTrack, mockVideoTrack);
      await session.publishScreenShare(mockScreenTrack);

      const senders = mockPeerConnection.getSenders();
      const videoSender = senders.find((s: any) => s.kind === 'video');

      // Video sender currently holds mockScreenTrack
      expect(videoSender.track).toBe(mockScreenTrack);

      await session.switchDevice('videoinput', 'cam-device-new');

      // Should NOT replace active screen track on sender while sharing screen
      expect(videoSender.track).toBe(mockScreenTrack);
      expect(mockVideoTrack.stop).toHaveBeenCalled();

      // Now stop screen share - should restore the NEW camera track!
      await session.stopScreenShare();
      expect(videoSender.replaceTrack).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'video', id: 'new-cam' })
      );
    });
  });

  describe('Perfect Negotiation & Glare Resolution', () => {
    it('initiates offer on negotiationneeded event', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      await mockPeerConnection.onnegotiationneeded();

      expect(mockPeerConnection.createOffer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalled();
      expect(mockSignaling.sendOffer).toHaveBeenCalledWith({
        type: 'offer',
        sdp: 'mock-local-offer-sdp',
      });
      expect(session.makingOffer).toBe(false);
    });

    it('handles remote offer and sends answer when in stable state', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      const remoteOffer = { type: 'offer' as RTCSdpType, sdp: 'remote-offer-sdp' };
      await signalingCallbacks.offer!(remoteOffer, 'peer-bob');

      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledWith(remoteOffer);
      expect(mockPeerConnection.createAnswer).toHaveBeenCalled();
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith({
        type: 'answer',
        sdp: 'mock-local-answer-sdp',
      });
      expect(mockSignaling.sendAnswer).toHaveBeenCalledWith({
        type: 'answer',
        sdp: 'mock-local-answer-sdp',
      });
    });

    it('polite peer concedes on offer collision (glare), rolls back and accepts offer', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
        polite: true,
      });
      await session.connect('room-1', 'token-1');

      // Simulate local offer collision state
      mockPeerConnection.signalingState = 'have-local-offer';

      const remoteOffer = { type: 'offer' as RTCSdpType, sdp: 'remote-offer-sdp' };
      await signalingCallbacks.offer!(remoteOffer, 'peer-bob');

      // Polite peer rolled back
      expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith({
        type: 'rollback',
      });
      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledWith(remoteOffer);
      expect(mockSignaling.sendAnswer).toHaveBeenCalled();
      expect(session.ignoreOffer).toBe(false);
    });

    it('impolite peer ignores incoming offer on collision (glare)', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
        polite: false,
      });
      await session.connect('room-1', 'token-1');

      mockPeerConnection.signalingState = 'have-local-offer';

      const remoteOffer = { type: 'offer' as RTCSdpType, sdp: 'remote-offer-sdp' };
      await signalingCallbacks.offer!(remoteOffer, 'peer-bob');

      expect(session.ignoreOffer).toBe(true);
      expect(mockPeerConnection.setRemoteDescription).not.toHaveBeenCalled();
      expect(mockSignaling.sendAnswer).not.toHaveBeenCalled();
    });

    it('handles remote answer and tracks isSettingRemoteAnswerPending', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      let pendingDuringExecution = false;
      mockPeerConnection.setRemoteDescription.mockImplementation(async () => {
        pendingDuringExecution = session.isSettingRemoteAnswerPending;
      });

      const remoteAnswer = { type: 'answer' as RTCSdpType, sdp: 'remote-answer-sdp' };
      await signalingCallbacks.answer!(remoteAnswer, 'peer-bob');

      expect(pendingDuringExecution).toBe(true);
      expect(session.isSettingRemoteAnswerPending).toBe(false);
      expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledWith(remoteAnswer);
    });

    it('routes remote ICE candidate to peer connection', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      const candidate = { candidate: 'candidate:1 1 UDP 12345 1.2.3.4 5678 typ host', sdpMid: '0' };
      await signalingCallbacks.candidate!(candidate, 'peer-bob');

      expect(mockPeerConnection.addIceCandidate).toHaveBeenCalledWith(candidate);
    });

    it('sends local ICE candidate via signaling', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      const cand = {
        candidate: 'candidate:local',
        sdpMid: '0',
        toJSON: () => ({ candidate: 'candidate:local', sdpMid: '0' }),
      };

      mockPeerConnection.onicecandidate({ candidate: cand });

      expect(mockSignaling.sendCandidate).toHaveBeenCalledWith({
        candidate: 'candidate:local',
        sdpMid: '0',
      });
    });

    it('initiates ICE restart when iceConnectionState transitions to disconnected', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      mockPeerConnection.iceConnectionState = 'disconnected';
      mockPeerConnection.oniceconnectionstatechange();

      expect(mockPeerConnection.restartIce).toHaveBeenCalled();
    });
  });

  describe('Telemetry & Stats Polling', () => {
    it('polls getStats and delivers parsed ConnectionQuality to listeners', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      const qualityCallback = vi.fn();
      session.onQualityMetrics(qualityCallback);

      const quality = await session.pollStats();

      expect(mockPeerConnection.getStats).toHaveBeenCalled();
      expect(qualityCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'good',
          connectionType: 'direct',
          rttMs: 50,
          packetLossPercent: 1,
          videoResolution: { width: 1280, height: 720 },
          fps: 30,
        })
      );
      expect(quality?.status).toBe('good');
    });

    it('runs stats polling loop every 2 seconds with fake timers', async () => {
      vi.useFakeTimers();
      try {
        const session = new P2PWebRTCMediaSession(mockSignaling, {
          peerConnection: mockPeerConnection,
        });
        const qualityCallback = vi.fn();
        session.onQualityMetrics(qualityCallback);

        await session.connect('room-1', 'token-1');

        expect(qualityCallback).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(2000);
        expect(qualityCallback).toHaveBeenCalledTimes(1);

        await vi.advanceTimersByTimeAsync(2000);
        expect(qualityCallback).toHaveBeenCalledTimes(2);

        session.disconnect();
        await vi.advanceTimersByTimeAsync(2000);
        expect(qualityCallback).toHaveBeenCalledTimes(2);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe('Remote Track Handling', () => {
    it('triggers onRemoteTrack callback when ontrack fires', async () => {
      const session = new P2PWebRTCMediaSession(mockSignaling, {
        peerConnection: mockPeerConnection,
      });
      await session.connect('room-1', 'token-1');

      const remoteTrackCallback = vi.fn();
      session.onRemoteTrack(remoteTrackCallback);

      const incomingTrack = createMockTrack('video', 'remote-video-1');
      const incomingStream = { id: 'stream-1', getTracks: () => [incomingTrack] };

      mockPeerConnection.ontrack({
        track: incomingTrack,
        streams: [incomingStream],
      });

      expect(remoteTrackCallback).toHaveBeenCalledWith(incomingTrack, incomingStream);
    });
  });
});
