import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';
import { WhiteboardStage } from '../../src/components/whiteboard/WhiteboardStage';

describe('Requirement 10: Working Screen Share Rendered Directly on Whiteboard', () => {
  let mockGetDisplayMedia: any;
  let mockScreenTrack: any;
  let mockScreenStream: any;
  let mockMediaSession: any;
  let mockWhiteboardAdapter: any;

  beforeEach(() => {
    mockScreenTrack = {
      kind: 'video',
      id: 'screen-track-1',
      stop: vi.fn(),
      onended: null,
      enabled: true,
    };

    mockScreenStream = {
      id: 'screen-stream-1',
      getTracks: vi.fn(() => [mockScreenTrack]),
      getVideoTracks: vi.fn(() => [mockScreenTrack]),
      getAudioTracks: vi.fn(() => []),
    };

    mockGetDisplayMedia = vi.fn().mockResolvedValue(mockScreenStream);

    if (typeof navigator !== 'undefined') {
      if (!navigator.mediaDevices) {
        (navigator as any).mediaDevices = {};
      }
      navigator.mediaDevices.getDisplayMedia = mockGetDisplayMedia;
    }

    mockMediaSession = {
      connect: vi.fn(),
      disconnect: vi.fn(),
      publishLocalMedia: vi.fn(),
      publishScreenShare: vi.fn().mockResolvedValue(undefined),
      stopScreenShare: vi.fn().mockResolvedValue(undefined),
      toggleMic: vi.fn(),
      toggleCamera: vi.fn(),
      onRemoteTrack: vi.fn(),
      onRemoteScreenTrack: vi.fn(),
      onQualityMetrics: vi.fn(),
      switchDevice: vi.fn(),
    };

    mockWhiteboardAdapter = {
      broadcastCustomEvent: vi.fn().mockResolvedValue(undefined),
      onCustomEvent: vi.fn(() => vi.fn()),
      onDelta: vi.fn(() => vi.fn()),
      onLaserMove: vi.fn(() => vi.fn()),
      broadcastPageSwitch: vi.fn().mockResolvedValue(undefined),
      broadcastPageAdd: vi.fn().mockResolvedValue(undefined),
      broadcastPageDelete: vi.fn().mockResolvedValue(undefined),
      broadcastDrawingDelta: vi.fn().mockResolvedValue(undefined),
      broadcastLaserMove: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn(),
      disconnect: vi.fn(),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('mounts screen share video directly inside WhiteboardStage when screenStream is provided', () => {
    render(
      <WhiteboardStage
        currentPage={1}
        totalPages={1}
        screenStream={mockScreenStream as any}
        isScreenSharingActive={true}
        screenSharerName="Inderjit Kaur"
        onStopScreenShare={vi.fn()}
      />
    );

    // Video container and video element must be rendered directly inside whiteboard
    const container = screen.getByTestId('whiteboard-screenshare-container');
    expect(container).toBeDefined();

    const video = screen.getByTestId('whiteboard-screenshare-video');
    expect(video).toBeDefined();

    // Canvas must have bg-transparent so annotations overlay the screen share
    const canvas = screen.getByTestId('whiteboard-canvas');
    expect(canvas.className).toContain('bg-transparent');

    // Status pill must display who is sharing
    const pill = screen.getByTestId('screenshare-status-pill');
    expect(pill.textContent).toContain("Inderjit Kaur's screen");
  });

  it('triggers getDisplayMedia when user clicks screen share button in ClassroomWorkspace', async () => {
    render(
      <ClassroomWorkspace
        roomId="room-screen-test"
        role="teacher"
        userName="Inderjit Kaur"
        mediaSession={mockMediaSession}
        whiteboardAdapter={mockWhiteboardAdapter}
      />
    );

    const shareBtn = screen.getByTestId('toggle-screenshare-btn');
    expect(shareBtn).toBeDefined();

    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // Native getDisplayMedia must have been called
    expect(mockGetDisplayMedia).toHaveBeenCalledWith(
      expect.objectContaining({
        audio: true,
        video: expect.anything(),
      })
    );

    // LiveKit/WebRTC publishScreenShare must be invoked with screen track
    expect(mockMediaSession.publishScreenShare).toHaveBeenCalledWith(mockScreenTrack);

    // Signaling broadcast must notify room participants
    expect(mockWhiteboardAdapter.broadcastCustomEvent).toHaveBeenCalledWith(
      'screen-share-state',
      expect.objectContaining({
        isSharing: true,
        sharerName: 'Inderjit Kaur',
      })
    );

    // Whiteboard now displays the screen share stream
    await waitFor(() => {
      expect(screen.getByTestId('whiteboard-screenshare-video')).toBeDefined();
    });
  });

  it('stops screen share cleanly when user clicks Stop Sharing button on whiteboard HUD', async () => {
    render(
      <ClassroomWorkspace
        roomId="room-screen-test-2"
        role="teacher"
        userName="Inderjit Kaur"
        mediaSession={mockMediaSession}
        whiteboardAdapter={mockWhiteboardAdapter}
      />
    );

    // Start sharing
    const shareBtn = screen.getByTestId('toggle-screenshare-btn');
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('whiteboard-stop-screenshare-btn')).toBeDefined();
    });

    // Click stop sharing on the whiteboard HUD
    const stopBtn = screen.getByTestId('whiteboard-stop-screenshare-btn');
    await act(async () => {
      fireEvent.click(stopBtn);
    });

    // Tracks must be stopped
    expect(mockScreenTrack.stop).toHaveBeenCalled();
    expect(mockMediaSession.stopScreenShare).toHaveBeenCalled();

    // Broadcast must notify room of stop
    expect(mockWhiteboardAdapter.broadcastCustomEvent).toHaveBeenCalledWith(
      'screen-share-state',
      expect.objectContaining({
        isSharing: false,
      })
    );

    // Video element must be removed and canvas restored to bg-white
    await waitFor(() => {
      expect(screen.queryByTestId('whiteboard-screenshare-container')).toBeNull();
      const canvas = screen.getByTestId('whiteboard-canvas');
      expect(canvas.className).toContain('bg-white');
    });
  });

  it('auto-reverts cleanly when native browser stop-sharing bar triggers track onended', async () => {
    render(
      <ClassroomWorkspace
        roomId="room-screen-test-3"
        role="teacher"
        userName="Inderjit Kaur"
        mediaSession={mockMediaSession}
        whiteboardAdapter={mockWhiteboardAdapter}
      />
    );

    const shareBtn = screen.getByTestId('toggle-screenshare-btn');
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    await waitFor(() => {
      expect(mockScreenTrack.onended).toBeDefined();
    });

    // Simulate browser native bar "Stop sharing" event
    await act(async () => {
      mockScreenTrack.onended();
    });

    // Tracks must be stopped and whiteboard restored
    expect(mockMediaSession.stopScreenShare).toHaveBeenCalled();
    await waitFor(() => {
      expect(screen.queryByTestId('whiteboard-screenshare-container')).toBeNull();
    });
  });

  it('handles user cancellation of getDisplayMedia dialog without breaking state', async () => {
    mockGetDisplayMedia.mockRejectedValueOnce(
      Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' })
    );

    render(
      <ClassroomWorkspace
        roomId="room-screen-test-4"
        role="teacher"
        userName="Inderjit Kaur"
        mediaSession={mockMediaSession}
        whiteboardAdapter={mockWhiteboardAdapter}
      />
    );

    const shareBtn = screen.getByTestId('toggle-screenshare-btn');
    await act(async () => {
      fireEvent.click(shareBtn);
    });

    // Must not publish track or mount screen share
    expect(mockMediaSession.publishScreenShare).not.toHaveBeenCalled();
    expect(screen.queryByTestId('whiteboard-screenshare-container')).toBeNull();
  });
});
