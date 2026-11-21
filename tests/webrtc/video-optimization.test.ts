import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  DEFAULT_VIDEO_CONSTRAINTS,
  DEFAULT_AUDIO_CONSTRAINTS,
  acquireOptimizedUserMedia,
  P2PWebRTCMediaSession,
  ISignalingAdapter,
} from '../../src/lib/webrtc/p2p-session';

describe('WebRTC Video Calling Lag Elimination & Audio Tuning', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports bounded 720p video constraints and low-latency audio constraints', () => {
    expect(DEFAULT_VIDEO_CONSTRAINTS).toEqual({
      width: { ideal: 1280, max: 1280 },
      height: { ideal: 720, max: 720 },
      frameRate: { ideal: 30, max: 30 },
    });

    expect(DEFAULT_AUDIO_CONSTRAINTS).toEqual({
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
      sampleRate: 48000,
      channelCount: 1,
      latency: 0,
    });
  });

  it('acquires user media with optimized default constraints', async () => {
    const mockGetUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [],
      getVideoTracks: () => [],
      getAudioTracks: () => [],
    });

    vi.stubGlobal('navigator', {
      mediaDevices: {
        getUserMedia: mockGetUserMedia,
      },
    });

    await acquireOptimizedUserMedia();

    expect(mockGetUserMedia).toHaveBeenCalledWith({
      video: DEFAULT_VIDEO_CONSTRAINTS,
      audio: DEFAULT_AUDIO_CONSTRAINTS,
    });
  });

  it('applies 800 kbps bitrate ceiling and 30fps max on video sender parameters', async () => {
    const mockSetParameters = vi.fn().mockResolvedValue(undefined);
    const mockGetParameters = vi.fn().mockReturnValue({
      encodings: [{}],
    });

    const mockSender: any = {
      track: { kind: 'video' },
      getParameters: mockGetParameters,
      setParameters: mockSetParameters,
    };

    const mockPeerConnection: any = {
      getSenders: vi.fn().mockReturnValue([mockSender]),
      addTrack: vi.fn().mockReturnValue(mockSender),
    };

    const mockSignaling: ISignalingAdapter = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      sendOffer: vi.fn().mockResolvedValue(undefined),
      sendAnswer: vi.fn().mockResolvedValue(undefined),
      sendCandidate: vi.fn().mockResolvedValue(undefined),
      onOffer: vi.fn(),
      onAnswer: vi.fn(),
      onCandidate: vi.fn(),
      onPeerJoined: vi.fn(),
      onPeerLeft: vi.fn(),
    };

    const session = new P2PWebRTCMediaSession(mockSignaling, {
      peerConnection: mockPeerConnection,
    });

    await session.applyVideoEncodingParameters(mockSender);

    expect(mockSetParameters).toHaveBeenCalledWith(
      expect.objectContaining({
        encodings: [
          expect.objectContaining({
            maxBitrate: 800000,
            maxFramerate: 30,
          }),
        ],
      })
    );
  });
});
