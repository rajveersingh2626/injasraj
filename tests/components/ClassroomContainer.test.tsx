import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClassroomContainer } from '../../src/components/classroom/ClassroomContainer';
import { IMediaSession, ConnectionQuality, createDefaultQuality } from '../../src/types/media';

// Extend expect for matchers in environments where jest-dom is not preloaded
expect.extend({
  toBeInTheDocument(received) {
    const pass =
      received !== null &&
      received !== undefined &&
      (received.ownerDocument?.body.contains(received) ?? false);
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be in document`,
    };
  },
  toHaveClass(received, className) {
    const pass = Boolean(
      received?.classList?.contains(className) ||
        (received?.className && received.className.includes(className))
    );
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}have class ${className}`,
    };
  },
});

class MockMediaStream {
  tracks: any[];
  constructor(tracks: any[] = []) {
    this.tracks = tracks;
  }
  getTracks() {
    return this.tracks;
  }
  getVideoTracks() {
    return this.tracks.filter((t) => t.kind === 'video');
  }
  getAudioTracks() {
    return this.tracks.filter((t) => t.kind === 'audio');
  }
}

describe('ClassroomContainer Component (Mobile & Tablet Hardened Live Stage)', () => {
  let mockMediaSession: IMediaSession;
  let sessionCallbacks: {
    remoteTrack?: (track: MediaStreamTrack, stream: MediaStream) => void;
    qualityMetrics?: (metrics: ConnectionQuality) => void;
  };

  const mockAudioDevices: MediaDeviceInfo[] = [
    {
      deviceId: 'mic-1',
      kind: 'audioinput',
      label: 'Default Mic',
      groupId: 'g1',
      toJSON: () => ({}),
    },
    {
      deviceId: 'mic-2',
      kind: 'audioinput',
      label: 'Studio USB Mic',
      groupId: 'g2',
      toJSON: () => ({}),
    },
  ];

  const mockVideoDevices: MediaDeviceInfo[] = [
    {
      deviceId: 'cam-1',
      kind: 'videoinput',
      label: 'Integrated HD Cam',
      groupId: 'g1',
      toJSON: () => ({}),
    },
    {
      deviceId: 'cam-2',
      kind: 'videoinput',
      label: 'External Wide Cam',
      groupId: 'g3',
      toJSON: () => ({}),
    },
  ];

  function createMockTrack(kind: 'audio' | 'video' = 'video', enabled: boolean = true) {
    return {
      id: `${kind}-track-1`,
      kind,
      enabled,
      stop: vi.fn(),
      onended: null,
    } as unknown as MediaStreamTrack;
  }

  beforeEach(() => {
    sessionCallbacks = {};

    mockMediaSession = {
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn(),
      publishLocalMedia: vi.fn().mockResolvedValue(undefined),
      publishScreenShare: vi.fn().mockResolvedValue(undefined),
      stopScreenShare: vi.fn().mockResolvedValue(undefined),
      toggleMic: vi.fn().mockReturnValue(false),
      toggleCamera: vi.fn().mockReturnValue(false),
      switchDevice: vi.fn().mockResolvedValue(undefined),
      onRemoteTrack: vi.fn((cb) => {
        sessionCallbacks.remoteTrack = cb;
      }),
      onQualityMetrics: vi.fn((cb) => {
        sessionCallbacks.qualityMetrics = cb;
      }),
    };

    if (typeof global.MediaStream === 'undefined') {
      vi.stubGlobal('MediaStream', MockMediaStream);
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  describe('Viewport and Mobile/Tablet Hardened Layout', () => {
    it('sets 100dvh viewport and overscroll-behavior: none', () => {
      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
          localParticipantName="Teacher John"
          remoteParticipantName="Student Jane"
        />
      );

      const container = screen.getByTestId('classroom-container');
      expect(container.style.height).toBe('100dvh');
      expect(container.style.overscrollBehavior).toBe('none');
    });

    it('renders mobile portrait PiP and tablet/desktop side-by-side grid classes', () => {
      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
          localParticipantName="Teacher John"
          remoteParticipantName="Student Jane"
        />
      );

      // Video stage grid
      const stage = screen.getByTestId('video-stage');
      expect(stage).toHaveClass('sm:grid sm:grid-cols-2');

      // Remote video takes full stage on mobile (<640px)
      const remoteContainer = screen.getByTestId('remote-video-container');
      expect(remoteContainer).toHaveClass('absolute inset-0 w-full h-full sm:relative sm:inset-auto');

      // Local video is floating PiP on mobile (<640px)
      const localContainer = screen.getByTestId('local-video-container');
      expect(localContainer).toHaveClass('absolute top-4 right-4 z-20 w-28 h-40');
      expect(localContainer).toHaveClass('sm:relative sm:top-auto sm:right-auto sm:z-auto sm:w-full sm:h-full');
    });

    it('mounts NetworkQualityHUD anchored with safe-area-inset-top', () => {
      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
          localParticipantName="Teacher John"
          remoteParticipantName="Student Jane"
        />
      );

      const hudAnchor = screen.getByTestId('network-hud-anchor');
      expect(hudAnchor).toBeInTheDocument();
      expect(hudAnchor.style.top).toContain('safe-area-inset-top');
    });
  });

  describe('Local and Remote Participant Stream Rendering', () => {
    it('renders both local and remote participant names and roles', () => {
      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
          localParticipantName="Teacher John"
          remoteParticipantName="Student Jane"
          localRoleBadge="Teacher"
          remoteRoleBadge="Student"
        />
      );

      const localNames = screen.getAllByText(/Teacher John \(You\)/i);
      expect(localNames.length).toBeGreaterThan(0);
      expect(localNames[0]).toBeInTheDocument();

      const remoteNames = screen.getAllByText(/Student Jane/i);
      expect(remoteNames.length).toBeGreaterThan(0);
      expect(remoteNames[0]).toBeInTheDocument();

      expect(screen.getByText('Teacher')).toBeInTheDocument();
      expect(screen.getByText('Student')).toBeInTheDocument();
    });

    it('attaches incoming remote stream via mediaSession.onRemoteTrack callback', () => {
      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
          localParticipantName="Teacher John"
          remoteParticipantName="Student Jane"
        />
      );

      expect(sessionCallbacks.remoteTrack).toBeDefined();

      const mockTrack = createMockTrack('video', true);
      const mockStream = new MockMediaStream([mockTrack]) as unknown as MediaStream;

      act(() => {
        sessionCallbacks.remoteTrack!(mockTrack, mockStream);
      });

      const videos = screen.getAllByTestId('video-element') as HTMLVideoElement[];
      const remoteVideo = videos[0];
      expect(remoteVideo.srcObject).toBe(mockStream);
    });
  });

  describe('Degraded Network & Audio-Priority Top Notification Banner', () => {
    it('does not display banner when network is healthy and audio is not prioritized', () => {
      const goodQuality: ConnectionQuality = {
        status: 'good',
        rttMs: 45,
        packetLossPercent: 0,
        connectionType: 'direct',
        isAudioPrioritized: false,
      };

      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
          initialQuality={goodQuality}
        />
      );

      expect(screen.queryByTestId('audio-priority-banner')).toBeNull();
    });

    it('displays audio-priority top notification banner when quality.isAudioPrioritized is true', () => {
      const degradedQuality: ConnectionQuality = {
        status: 'fair',
        rttMs: 280,
        packetLossPercent: 4.5,
        connectionType: 'relay',
        isAudioPrioritized: true,
      };

      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
          initialQuality={degradedQuality}
        />
      );

      const banner = screen.getByTestId('audio-priority-banner');
      expect(banner).toBeInTheDocument();
      expect(screen.getByText(/Audio Prioritized/i)).toBeInTheDocument();
      expect(screen.getByText(/Video bandwidth reduced/i)).toBeInTheDocument();
    });

    it('updates dynamically when quality metrics arrive from mediaSession', () => {
      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
        />
      );

      expect(screen.queryByTestId('audio-priority-banner')).toBeNull();

      act(() => {
        sessionCallbacks.qualityMetrics!({
          status: 'poor',
          rttMs: 420,
          packetLossPercent: 8.0,
          connectionType: 'relay',
          isAudioPrioritized: true,
        });
      });

      expect(screen.getByTestId('audio-priority-banner')).toBeInTheDocument();
    });
  });

  describe('IMediaSession Controls Wiring', () => {
    it('triggers mediaSession.toggleMic when mic button is clicked', () => {
      render(<ClassroomContainer mediaSession={mockMediaSession} />);

      const micBtn = screen.getByTestId('toggle-mic-btn');
      fireEvent.click(micBtn);

      expect(mockMediaSession.toggleMic).toHaveBeenCalledTimes(1);
    });

    it('triggers mediaSession.toggleCamera when camera button is clicked', () => {
      render(<ClassroomContainer mediaSession={mockMediaSession} />);

      const camBtn = screen.getByTestId('toggle-camera-btn');
      fireEvent.click(camBtn);

      expect(mockMediaSession.toggleCamera).toHaveBeenCalledTimes(1);
    });

    it('triggers mediaSession.publishScreenShare and stopScreenShare on toggle', async () => {
      render(<ClassroomContainer mediaSession={mockMediaSession} />);

      const screenBtn = screen.getByTestId('toggle-screenshare-btn');
      await act(async () => {
        fireEvent.click(screenBtn);
      });

      expect(mockMediaSession.publishScreenShare).toHaveBeenCalledTimes(1);

      await act(async () => {
        fireEvent.click(screenBtn);
      });

      expect(mockMediaSession.stopScreenShare).toHaveBeenCalledTimes(1);
    });

    it('triggers mediaSession.switchDevice when device is selected in ControlBar', async () => {
      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
          audioDevices={mockAudioDevices}
          videoDevices={mockVideoDevices}
        />
      );

      fireEvent.click(screen.getByTestId('device-settings-btn'));

      // Switch audio input
      const audioSelect = screen.getByTestId('audio-device-select');
      await act(async () => {
        fireEvent.change(audioSelect, { target: { value: 'mic-2' } });
      });

      expect(mockMediaSession.switchDevice).toHaveBeenCalledWith('audioinput', 'mic-2');

      // Switch video input
      const videoSelect = screen.getByTestId('video-device-select');
      await act(async () => {
        fireEvent.change(videoSelect, { target: { value: 'cam-2' } });
      });

      expect(mockMediaSession.switchDevice).toHaveBeenCalledWith('videoinput', 'cam-2');
    });

    it('calls mediaSession.disconnect and invokes onLeave callback when leaving', () => {
      const handleLeave = vi.fn();
      render(
        <ClassroomContainer
          mediaSession={mockMediaSession}
          onLeave={handleLeave}
        />
      );

      fireEvent.click(screen.getByTestId('leave-class-btn'));

      expect(mockMediaSession.disconnect).toHaveBeenCalledTimes(1);
      expect(handleLeave).toHaveBeenCalledTimes(1);
    });
  });
});
