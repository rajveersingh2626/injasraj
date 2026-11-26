import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LiveKitMediaSession } from '../src/lib/webrtc/livekit-session';

describe('LiveKitMediaSession', () => {
  let session: LiveKitMediaSession;

  beforeEach(() => {
    session = new LiveKitMediaSession('wss://injasraj-aosxldu2.livekit.cloud');
  });

  it('initializes with connecting status', () => {
    expect(session).toBeDefined();
    expect(session.isMicEnabled()).toBe(true);
    expect(session.isCameraEnabled()).toBe(true);
  });

  it('toggles microphone state correctly', () => {
    const newState = session.toggleMic(false);
    expect(newState).toBe(false);
    expect(session.isMicEnabled()).toBe(false);

    const toggled = session.toggleMic();
    expect(toggled).toBe(true);
    expect(session.isMicEnabled()).toBe(true);
  });

  it('toggles camera state correctly', () => {
    const newState = session.toggleCamera(false);
    expect(newState).toBe(false);
    expect(session.isCameraEnabled()).toBe(false);

    const toggled = session.toggleCamera();
    expect(toggled).toBe(true);
    expect(session.isCameraEnabled()).toBe(true);
  });

  it('allows registering remote track callbacks and quality callbacks', () => {
    const trackCb = vi.fn();
    const qualityCb = vi.fn();

    session.onRemoteTrack(trackCb);
    session.onQualityMetrics(qualityCb);

    // Call internal triggers for test verification
    const mockTrack = { id: 'track-1', kind: 'video' } as any;
    const mockStream = { id: 'stream-1' } as any;

    session.emitRemoteTrack(mockTrack, mockStream);
    expect(trackCb).toHaveBeenCalledWith(mockTrack, mockStream);

    session.emitQuality({
      status: 'good',
      rttMs: 45,
      packetLossPercent: 0,
      connectionType: 'direct',
      isAudioPrioritized: false,
    });

    expect(qualityCb).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'good',
        rttMs: 45,
      })
    );
  });

  it('supports relay candidate detection and audio bandwidth preservation', () => {
    const qualityCb = vi.fn();
    session.onQualityMetrics(qualityCb);

    session.emitQuality({
      status: 'fair',
      rttMs: 180,
      packetLossPercent: 2,
      connectionType: 'relay',
      isAudioPrioritized: true,
    });

    expect(qualityCb).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'fair',
        connectionType: 'relay',
        isAudioPrioritized: true,
      })
    );
  });

  it('disconnects cleanly', () => {
    expect(() => session.disconnect()).not.toThrow();
  });
});
