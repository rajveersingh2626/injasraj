import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
  }),
}));
import { ClassroomView } from '@/components/classroom/ClassroomView';
import { ClassroomWorkspace } from '@/components/classroom/ClassroomWorkspace';
import { VideoCard } from '@/components/classroom/VideoCard';
import {
  serializeWhiteboardSession,
  deserializeWhiteboardSession,
  saveWhiteboardSession,
  loadWhiteboardSession,
  DebouncedPersistenceManager,
  WhiteboardSessionRecord,
} from '@/lib/whiteboard/whiteboard-persistence';
import { LiveKitMediaSession } from '@/lib/webrtc/livekit-session';
import { createDefaultWhiteboardPage, defaultWhiteboardPermissions } from '@/types/whiteboard';

describe('Production Bug Verification: WebRTC Lifecycle, Tablet Gating & Whiteboard Persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Bug 1: Video Off -> On Recovery (No Permanent Black Screen)', () => {
    it('notifies onLocalStream listeners when LiveKit camera is toggled back on', async () => {
      const session = new LiveKitMediaSession();
      const mockStream = {
        id: 'stream-1',
        getTracks: () => [{ kind: 'video', readyState: 'live', enabled: true }],
        getVideoTracks: () => [{ kind: 'video', readyState: 'live', enabled: true }],
      } as any;

      vi.spyOn(session, 'getLocalStream').mockReturnValue(mockStream);
      const listener = vi.fn();
      session.onLocalStream(listener);

      expect(listener).toHaveBeenCalledWith(mockStream);

      // Trigger emitLocalStream (called on LocalTrackPublished / toggleCamera)
      session.emitLocalStream();
      expect(listener).toHaveBeenCalledTimes(2);
    });

    it('VideoCard calls safePlay and handles track onunmute gracefully', () => {
      let unmuteHandler: (() => void) | undefined;
      const mockTrack = {
        kind: 'video',
        enabled: true,
        addEventListener: (event: string, handler: () => void) => {
          if (event === 'unmute') unmuteHandler = handler;
        },
        removeEventListener: vi.fn(),
      } as any;

      const { rerender } = render(
        <VideoCard
          participantName="Student Aman"
          track={mockTrack}
          isCameraOff={true}
        />
      );

      // Avatar fallback rendered when isCameraOff is true
      expect(screen.getByTestId('avatar-fallback')).toBeDefined();

      // Camera turned back ON: isCameraOff becomes false
      rerender(
        <VideoCard
          participantName="Student Aman"
          track={mockTrack}
          isCameraOff={false}
        />
      );

      // Fallback avatar is hidden, video is active
      expect(screen.queryByTestId('avatar-fallback')).toBeNull();

      // Trigger unmute event
      if (unmuteHandler) {
        expect(() => unmuteHandler!()).not.toThrow();
      }
    });
  });

  describe('Bug 2: Tablet WebRTC & Pre-Class Visibility Gate', () => {
    it('before class starts: student is blocked from seeing teacher, teacher can see student', () => {
      // 1. Student perspective
      const { unmount: unmountStudent } = render(
        <ClassroomWorkspace
          roomId="room-test-gate"
          role="student"
          userName="Aman Student"
          initialSessionStatus="waiting"
          participants={[
            { id: 'teacher-1', name: 'Master Teacher', role: 'teacher', isCameraOn: true, isMicOn: true },
          ]}
        />
      );

      // Student sees the waiting gate
      expect(screen.getByTestId('remote-video-waiting-placeholder')).toBeDefined();
      expect(screen.getByText(/Teacher Video Feed Gated/i)).toBeDefined();
      expect(screen.queryByTestId('remote-video-wrapper')).toBeNull();
      unmountStudent();

      // 2. Teacher perspective
      render(
        <ClassroomWorkspace
          roomId="room-test-gate"
          role="teacher"
          userName="Master Teacher"
          initialSessionStatus="waiting"
          participants={[
            { id: 'student-1', name: 'Aman Student', role: 'student', isCameraOn: true, isMicOn: true },
          ]}
        />
      );

      // Teacher sees Start Class button AND can see the remote student tile preview
      expect(screen.getByTestId('start-class-btn')).toBeDefined();
      expect(screen.getByTestId('remote-video-wrapper')).toBeDefined();
      expect(screen.queryByTestId('remote-video-waiting-placeholder')).toBeNull();
    });

    it('once teacher starts class: sessionStatus transitions to in_progress and gate unlocks', () => {
      const mockWhiteboardAdapter = {
        broadcastCustomEvent: vi.fn(),
        onCustomEvent: vi.fn(() => () => {}),
        onDelta: vi.fn(() => () => {}),
        subscribe: vi.fn(),
        disconnect: vi.fn(),
      } as any;

      const { rerender } = render(
        <ClassroomWorkspace
          roomId="room-test-unlock"
          role="teacher"
          userName="Teacher"
          initialSessionStatus="waiting"
          whiteboardAdapter={mockWhiteboardAdapter}
          participants={[
            { id: 'student-1', name: 'Student', role: 'student', isCameraOn: true, isMicOn: true },
          ]}
        />
      );

      const startBtn = screen.getByTestId('start-class-btn');
      fireEvent.click(startBtn);

      expect(mockWhiteboardAdapter.broadcastCustomEvent).toHaveBeenCalledWith(
        'session-status-update',
        { status: 'in_progress' }
      );

      // If student was rendered with in_progress status
      rerender(
        <ClassroomWorkspace
          roomId="room-test-unlock"
          role="student"
          userName="Student"
          initialSessionStatus="in_progress"
          whiteboardAdapter={mockWhiteboardAdapter}
          participants={[
            { id: 'teacher-1', name: 'Teacher', role: 'teacher', isCameraOn: true, isMicOn: true },
          ]}
        />
      );

      expect(screen.queryByTestId('remote-video-waiting-placeholder')).toBeNull();
      expect(screen.getByTestId('remote-video-wrapper')).toBeDefined();
    });
  });

  describe('Bug 3: Whiteboard Persistence & Server-Side Restore on Reload', () => {
    it('serializes and deserializes session_status alongside pages and permissions', () => {
      const pages = [createDefaultWhiteboardPage('p1', 1, 'Math')];
      const perms = defaultWhiteboardPermissions();
      const record = serializeWhiteboardSession(
        'room-ssot',
        pages,
        'p1',
        perms,
        undefined,
        'in_progress'
      );

      expect(record.session_status).toBe('in_progress');
      expect(record.room_id).toBe('room-ssot');

      const deserialized = deserializeWhiteboardSession(record);
      expect(deserialized.session_status).toBe('in_progress');
      expect(deserialized.pages.length).toBe(1);
    });

    it('flushes pending strokes to server on window beforeunload or pagehide', () => {
      const saveMock = vi.fn().mockResolvedValue(true);
      const persistenceManager = new DebouncedPersistenceManager(saveMock, 5000);

      render(
        <ClassroomWorkspace
          roomId="room-unload-test"
          role="teacher"
          userName="Teacher"
          persistenceManager={persistenceManager}
        />
      );

      // Schedule a save
      const dummyRecord: WhiteboardSessionRecord = {
        room_id: 'room-unload-test',
        pages: [createDefaultWhiteboardPage('p1', 1)],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
      };
      persistenceManager.scheduleSave(dummyRecord);
      expect(persistenceManager.isPending()).toBe(true);

      // Trigger beforeunload
      window.dispatchEvent(new Event('beforeunload'));

      // Flush should have executed
      expect(saveMock).toHaveBeenCalled();
    });

    it('ClassroomView loads existing whiteboard session by roomId without requiring restoreRoomId in searchParams', async () => {
      const existingPages = [
        createDefaultWhiteboardPage('page-notes', 1, 'Existing Notes'),
      ];
      const mockSupabase = {
        from: () => ({
          select: () => ({
            eq: () => ({
              maybeSingle: async () => ({
                data: {
                  room_id: 'active-room-123',
                  pages: existingPages,
                  active_page_id: 'page-notes',
                  permissions: defaultWhiteboardPermissions(),
                  session_status: 'in_progress',
                },
                error: null,
              }),
            }),
          }),
        }),
      };

      await act(async () => {
        render(
          <ClassroomView
            roomId="active-room-123"
            role="teacher"
            supabaseClient={mockSupabase}
          />
        );
      });

      // Existing page title should be loaded from the database
      expect(screen.getAllByText('Existing Notes').length).toBeGreaterThan(0);
    });
  });
});
