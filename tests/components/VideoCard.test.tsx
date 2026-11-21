import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VideoCard } from '../../src/components/classroom/VideoCard';

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

describe('VideoCard Component', () => {
  beforeEach(() => {
    if (typeof global.MediaStream === 'undefined') {
      vi.stubGlobal('MediaStream', MockMediaStream);
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  function createMockTrack(kind: 'audio' | 'video' = 'video', enabled: boolean = true) {
    return {
      id: `${kind}-track-1`,
      kind,
      enabled,
      stop: vi.fn(),
    } as unknown as MediaStreamTrack;
  }

  describe('Video Stream & Track Attachment', () => {
    it('attaches MediaStream to HTML5 video element srcObject', () => {
      const mockTrack = createMockTrack('video', true);
      const mockStream = new MockMediaStream([mockTrack]) as unknown as MediaStream;

      render(
        <VideoCard
          participantName="Alice Walker"
          stream={mockStream}
          isCameraOff={false}
        />
      );

      const video = screen.getByTestId('video-element') as HTMLVideoElement;
      expect(video).toBeInTheDocument();
      expect(video.srcObject).toBe(mockStream);
    });

    it('wraps and attaches standalone MediaStreamTrack into srcObject', () => {
      const mockTrack = createMockTrack('video', true);

      render(
        <VideoCard
          participantName="Bob Vance"
          track={mockTrack}
          isCameraOff={false}
        />
      );

      const video = screen.getByTestId('video-element') as HTMLVideoElement;
      expect(video).toBeInTheDocument();
      expect(video.srcObject).toBeDefined();
    });
  });

  describe('Local Muting & Audio Activity Indicators', () => {
    it('sets video muted={true} for local participant and muted={false} for remote', () => {
      const { rerender } = render(
        <VideoCard participantName="Local You" isLocal={true} isCameraOff={false} />
      );

      const localVideo = screen.getByTestId('video-element') as HTMLVideoElement;
      expect(localVideo.muted).toBe(true);

      rerender(
        <VideoCard participantName="Remote Student" isLocal={false} isCameraOff={false} />
      );

      const remoteVideo = screen.getByTestId('video-element') as HTMLVideoElement;
      expect(remoteVideo.muted).toBe(false);
    });

    it('renders muted indicator badge when audio is muted', () => {
      render(
        <VideoCard
          participantName="Sarah Connor"
          isAudioMuted={true}
          isAudioActive={false}
        />
      );

      expect(screen.getByTestId('audio-muted-badge')).toBeInTheDocument();
      expect(screen.queryByTestId('audio-activity-indicator')).toBeNull();
    });

    it('renders pulsating audio activity indicator when speaking and not muted', () => {
      render(
        <VideoCard
          participantName="Sarah Connor"
          isAudioMuted={false}
          isAudioActive={true}
        />
      );

      expect(screen.getByTestId('audio-activity-indicator')).toBeInTheDocument();
      expect(screen.queryByTestId('audio-muted-badge')).toBeNull();

      const card = screen.getByTestId('video-card');
      expect(card).toHaveClass('ring-2 ring-emerald-500/50');
    });
  });

  describe('Camera-Off Avatar Fallback', () => {
    it('displays fallback avatar with participant initials when camera is off', () => {
      render(
        <VideoCard
          participantName="David Miller"
          isCameraOff={true}
        />
      );

      const avatar = screen.getByTestId('avatar-fallback');
      expect(avatar).toBeInTheDocument();
      expect(screen.getByTestId('avatar-initials').textContent).toBe('DM');
      expect(screen.getByTestId('avatar-participant-name').textContent).toBe('David Miller');
      expect(screen.getByTestId('avatar-camera-off-icon')).toBeInTheDocument();
      expect(screen.getByText(/Camera is turned off/i)).toBeInTheDocument();
    });

    it('displays custom avatar image when avatarUrl is provided', () => {
      render(
        <VideoCard
          participantName="Elena Rostova"
          avatarUrl="https://example.com/avatar.jpg"
          isCameraOff={true}
        />
      );

      const img = screen.getByAltText('Elena Rostova') as HTMLImageElement;
      expect(img).toBeInTheDocument();
      expect(img.src).toBe('https://example.com/avatar.jpg');
    });

    it('hides fallback avatar when camera is enabled with active video track', () => {
      const mockTrack = createMockTrack('video', true);
      const mockStream = new MockMediaStream([mockTrack]) as unknown as MediaStream;

      render(
        <VideoCard
          participantName="Frank Castle"
          stream={mockStream}
          isCameraOff={false}
        />
      );

      expect(screen.queryByTestId('avatar-fallback')).toBeNull();
      const video = screen.getByTestId('video-element');
      expect(video).toHaveClass('opacity-100');
    });
  });

  describe('Screen Sharing & Badges', () => {
    it('displays screen sharing badge and object-contain mode when screen sharing', () => {
      render(
        <VideoCard
          participantName="Teacher Mike"
          isScreenSharing={true}
          isCameraOff={false}
        />
      );

      expect(screen.getByTestId('screen-share-badge')).toBeInTheDocument();
      expect(screen.getByText(/Screen Sharing/i)).toBeInTheDocument();

      const video = screen.getByTestId('video-element');
      expect(video).toHaveClass('object-contain');
    });

    it('displays participant role badge when provided', () => {
      render(
        <VideoCard
          participantName="Dr. House"
          roleBadge="Teacher"
        />
      );

      const badge = screen.getByTestId('participant-role-badge');
      expect(badge).toBeInTheDocument();
      expect(badge.textContent).toBe('Teacher');
    });

    it('mirrors local video with scaleX(-1) when not screen sharing', () => {
      render(
        <VideoCard
          participantName="You"
          isLocal={true}
          isScreenSharing={false}
        />
      );

      const video = screen.getByTestId('video-element');
      expect(video.style.transform).toBe('scaleX(-1)');
    });
  });
});
