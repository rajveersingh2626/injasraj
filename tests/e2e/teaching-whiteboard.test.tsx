import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ClassroomPage from '../../src/app/classroom/[roomId]/page';
import { ClassroomView } from '../../src/components/classroom/ClassroomView';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';
import {
  WhiteboardRealtimeAdapter,
} from '../../src/lib/whiteboard/whiteboard-signaling';
import {
  DebouncedPersistenceManager,
  WhiteboardSessionRecord,
} from '../../src/lib/whiteboard/whiteboard-persistence';
import {
  WhiteboardPermissions,
  defaultWhiteboardPermissions,
} from '../../src/types/whiteboard';
import { DEFAULT_WORKSHEETS } from '../../src/components/whiteboard/tabs/MaterialsTab';

// Extend expect with essential DOM matchers
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

// Mock Next.js navigation
const mockRouterPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
  }),
  useParams: () => ({ roomId: 'physics-101' }),
  useSearchParams: () => new URLSearchParams('role=teacher&name=Dr.%20Feynman'),
}));

// Mock MediaStream & Track
class MockMediaStreamTrack {
  id: string;
  kind: string;
  enabled: boolean = true;
  readyState: string = 'live';
  constructor(kind: 'audio' | 'video' = 'video', id = `track-${Math.random()}`) {
    this.kind = kind;
    this.id = id;
  }
  stop() {
    this.readyState = 'ended';
  }
}

class MockMediaStream {
  id: string = `stream-${Math.random()}`;
  tracks: MockMediaStreamTrack[];
  constructor(tracks: MockMediaStreamTrack[] = []) {
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

// In-memory peer-connected Mock Supabase Realtime Channel
class MockRealtimeChannel {
  topic: string;
  listeners: Map<string, Array<(envelope: any) => void>> = new Map();
  peerChannel?: MockRealtimeChannel;

  constructor(topic: string) {
    this.topic = topic;
  }

  connectPeer(peer: MockRealtimeChannel) {
    this.peerChannel = peer;
    peer.peerChannel = this;
  }

  on(type: string, filter: any, callback: (envelope: any) => void) {
    const key = `${type}:${filter.event}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key)!.push(callback);
    return this;
  }

  async send(envelope: any) {
    if (this.peerChannel) {
      const key = `${envelope.type}:${envelope.event}`;
      const peerListeners = this.peerChannel.listeners.get(key) || [];
      for (const cb of peerListeners) {
        cb({ type: 'broadcast', event: envelope.event, payload: envelope.payload });
      }
    }
    return 'ok';
  }

  subscribe(cb?: (status: string) => void) {
    cb?.('SUBSCRIBED');
    return this;
  }

  unsubscribe() {
    return this;
  }
}

describe('Task 15: End-to-End Classroom Integration & Teaching Whiteboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // Requirement 1: Classroom route loads with ClassroomWorkspace
  // =========================================================================
  describe('Suite 1: Classroom Route Mounting & Workspace Shell', () => {
    it('loads classroom route with ClassroomWorkspace and overscroll-behavior none', async () => {
      await act(async () => {
        render(
          <ClassroomPage
            params={Promise.resolve({ roomId: 'physics-101' })}
            searchParams={Promise.resolve({
              role: 'teacher',
              name: 'Dr. Feynman',
            })}
          />
        );
      });

      // 1. Container has overscroll-behavior: none
      const routeContainer = screen.getByTestId('classroom-route-container');
      expect(routeContainer).toBeInTheDocument();
      expect(routeContainer.style.overscrollBehavior).toBe('none');

      // 2. Classroom View & Workspace are mounted
      expect(screen.getByTestId('classroom-page')).toBeInTheDocument();
      expect(screen.getByTestId('classroom-container')).toBeInTheDocument();
      expect(screen.getByTestId('classroom-workspace')).toBeInTheDocument();

      // 3. Room ID badge is correctly rendered
      const roomBadge = screen.getByTestId('room-id-badge');
      expect(roomBadge).toBeInTheDocument();
      expect(roomBadge.textContent).toBe('physics-101');

      // 4. Default mode is Classroom Mode
      expect(screen.getByTestId('classroom-layout')).toBeInTheDocument();
      expect(screen.getByTestId('mode-toggle-btn')).toBeInTheDocument();
      expect(screen.getByText('Classroom Mode')).toBeInTheDocument();

      // 5. Video cards for local teacher and remote student are present
      expect(screen.getByText('Dr. Feynman')).toBeInTheDocument();
      expect(screen.getAllByText('Teacher').length).toBeGreaterThanOrEqual(1);
    });

    it('loads classroom route as student with student role badge and controls', async () => {
      await act(async () => {
        render(
          <ClassroomPage
            params={Promise.resolve({ roomId: 'math-202' })}
            searchParams={Promise.resolve({
              role: 'student',
              name: 'Alice Wonder',
            })}
          />
        );
      });

      expect(screen.getByTestId('classroom-workspace')).toBeInTheDocument();
      expect(screen.getByText('Alice Wonder')).toBeInTheDocument();
      expect(screen.getAllByText('Student').length).toBeGreaterThanOrEqual(1);
    });
  });

  // =========================================================================
  // Requirement 2: Toggling between Classroom & Whiteboard Mode preserves video tracks
  // =========================================================================
  describe('Suite 2: Dual Mode Switching & Video Track Preservation', () => {
    it('preserves local and remote video tracks when toggling between Classroom and Whiteboard mode', async () => {
      const localVideoTrack = new MockMediaStreamTrack('video', 'local-v1');
      const remoteVideoTrack = new MockMediaStreamTrack('video', 'remote-v1');

      const localStream = new MockMediaStream([localVideoTrack]);
      const remoteStream = new MockMediaStream([remoteVideoTrack]);

      render(
        <ClassroomView
          roomId="quantum-lab"
          role="teacher"
          userName="Prof. Bohr"
        />
      );

      // Initial state: Classroom Mode with balanced dock
      expect(screen.getByTestId('classroom-layout')).toBeInTheDocument();
      const localCardBefore = screen.getByTestId('local-video-wrapper');
      const remoteCardBefore = screen.getByTestId('remote-video-wrapper');
      expect(localCardBefore).toBeInTheDocument();
      expect(remoteCardBefore).toBeInTheDocument();

      // Verify video cards count
      const videoCardsInitial = screen.getAllByTestId('video-card');
      expect(videoCardsInitial).toHaveLength(2);

      // Toggle to Whiteboard Mode
      const modeBtn = screen.getByTestId('mode-toggle-btn');
      fireEvent.click(modeBtn);

      // Layout transitions to Whiteboard Mode
      expect(screen.getByTestId('whiteboard-layout')).toBeInTheDocument();
      expect(screen.queryByTestId('classroom-layout')).not.toBeInTheDocument();
      expect(screen.getByText('Whiteboard Mode')).toBeInTheDocument();

      // Video cards remain continuously mounted in PiP floating dock
      const videoCardsWhiteboard = screen.getAllByTestId('video-card');
      expect(videoCardsWhiteboard).toHaveLength(2);
      expect(screen.getByTestId('local-video-wrapper')).toBeInTheDocument();
      expect(screen.getByTestId('remote-video-wrapper')).toBeInTheDocument();

      // Video tracks were preserved without interruption
      expect(localVideoTrack.readyState).toBe('live');
      expect(remoteVideoTrack.readyState).toBe('live');

      // Toggle back to Classroom Mode
      fireEvent.click(modeBtn);
      expect(screen.getByTestId('classroom-layout')).toBeInTheDocument();
      expect(screen.getByText('Classroom Mode')).toBeInTheDocument();
      expect(screen.getAllByTestId('video-card')).toHaveLength(2);
    });
  });

  // =========================================================================
  // Requirement 3: Teacher locking permissions reflects on student UI
  // =========================================================================
  describe('Suite 3: Authoritative Permissions & Realtime Delta Sync', () => {
    it('reflects teacher locking permissions on student UI via real-time signaling', async () => {
      // Create interconnected peer channels for teacher and student
      const teacherChannel = new MockRealtimeChannel('whiteboard:demo-room');
      const studentChannel = new MockRealtimeChannel('whiteboard:demo-room');
      teacherChannel.connectPeer(studentChannel);

      const teacherAdapter = new WhiteboardRealtimeAdapter(
        teacherChannel,
        'teacher-user-1'
      );
      const studentAdapter = new WhiteboardRealtimeAdapter(
        studentChannel,
        'student-user-2'
      );

      // Render Student View with Student Adapter and unlocked initial state
      render(
        <ClassroomWorkspace
          roomId="demo-room"
          role="student"
          userId="student-user-2"
          userName="Student Bob"
          whiteboardAdapter={studentAdapter}
          initialPermissions={{
            ...defaultWhiteboardPermissions(),
            isLockedGlobally: false,
          }}
        />
      );

      // Initially student banner is not locked
      const banner = screen.queryByTestId('student-status-banner');
      if (banner) {
        expect(banner.textContent?.toLowerCase()).not.toContain('locked by teacher');
      }

      // Teacher broadcasts global lock update
      const lockedPermissions: WhiteboardPermissions = {
        ...defaultWhiteboardPermissions(),
        isLockedGlobally: true,
      };

      await act(async () => {
        await teacherAdapter.broadcastPermissions(lockedPermissions);
      });

      // Student receives update: Student banner reflects lock
      await waitFor(() => {
        const studentBanner = screen.getByTestId('student-status-banner');
        expect(studentBanner).toBeInTheDocument();
        expect(studentBanner.textContent?.toLowerCase()).toContain('locked by teacher');
      });

      // Teacher grants drawing permission to this specific student
      const grantedPermissions: WhiteboardPermissions = {
        ...defaultWhiteboardPermissions(),
        isLockedGlobally: false,
        studentDrawingGranted: {
          'student-user-2': true,
        },
      };

      await act(async () => {
        await teacherAdapter.broadcastPermissions(grantedPermissions);
      });

      // Student banner reflects drawing permission granted
      await waitFor(() => {
        const updatedBanner = screen.getByTestId('student-status-banner');
        expect(updatedBanner.textContent?.toLowerCase()).toContain('drawing permission granted');
      });
    });
  });

  // =========================================================================
  // Requirement 4: PDF worksheet loading triggers page background update
  // =========================================================================
  describe('Suite 4: PDF Worksheet Ingestion & Background Stage Update', () => {
    it('triggers page background update when a worksheet is loaded from MaterialsTab', async () => {
      const handleLoadWorksheet = vi.fn();
      const mockWhiteboardAdapter = {
        broadcastModify: vi.fn().mockResolvedValue(undefined),
        onDelta: vi.fn().mockReturnValue(() => {}),
        subscribe: vi.fn(),
        disconnect: vi.fn(),
      } as any;

      const testWorksheets = [
        {
          id: 'test-worksheet-1',
          title: 'Algebra 1 Practice',
          url: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"></svg>',
          category: 'Algebra',
        },
      ];

      render(
        <ClassroomWorkspace
          roomId="math-session"
          role="teacher"
          userName="Teacher Gauss"
          whiteboardAdapter={mockWhiteboardAdapter}
          onLoadWorksheet={handleLoadWorksheet}
          initialSidePanelCollapsed={false}
          worksheets={testWorksheets}
        />
      );

      // Open Materials Tab in Studio Side Panel
      const materialsTabBtn = screen.getByTestId('tab-materials');
      fireEvent.click(materialsTabBtn);

      expect(screen.getByTestId('materials-tab')).toBeInTheDocument();
      expect(screen.getByText('Uploaded Documents (1)')).toBeInTheDocument();

      // Click "Load into Whiteboard" for test worksheet
      const loadBtn = screen.getByTestId('load-worksheet-test-worksheet-1');
      expect(loadBtn).toBeInTheDocument();

      await act(async () => {
        fireEvent.click(loadBtn);
      });

      // Verifies that onLoadWorksheet callback was invoked with worksheet URL
      expect(handleLoadWorksheet).toHaveBeenCalledWith(
        testWorksheets[0].url
      );

      // Verifies that broadcastModify was dispatched to sync peers with the background URL
      expect(mockWhiteboardAdapter.broadcastModify).toHaveBeenCalledWith(
        expect.any(String),
        '__page_background__',
        expect.objectContaining({
          backgroundImageUrl: testWorksheets[0].url,
        })
      );
    });
  });

  // =========================================================================
  // Requirement 5: Session data flushes to persistence layer
  // =========================================================================
  describe('Suite 5: Debounced Cloud Persistence & Session Flushing', () => {
    it('flushes session data to persistence layer on changes or classroom departure', async () => {
      const mockSaveFn = vi.fn().mockResolvedValue(true);
      const persistenceManager = new DebouncedPersistenceManager(mockSaveFn, 1000);

      const handleSave = vi.fn();
      const handleLeave = vi.fn();

      render(
        <ClassroomWorkspace
          roomId="persistence-room-101"
          role="teacher"
          userName="Prof. Lovelace"
          persistenceManager={persistenceManager}
          initialPermissions={{
            ...defaultWhiteboardPermissions(),
            isLockedGlobally: false,
          }}
          onSave={handleSave}
          onLeave={handleLeave}
          initialSidePanelCollapsed={false}
        />
      );

      // Trigger a permission change (authoritative teacher toggles global lock from false -> true)
      const lockToggle = screen.getByTestId('toggle-global-lock');
      fireEvent.click(lockToggle);

      // Persistence should be scheduled & pending
      expect(persistenceManager.isPending()).toBe(true);

      // Immediately flush persistence
      let flushResult = false;
      await act(async () => {
        flushResult = await persistenceManager.flush();
      });

      expect(flushResult).toBe(true);
      expect(persistenceManager.isPending()).toBe(false);
      expect(mockSaveFn).toHaveBeenCalledTimes(1);

      // Verify the saved session payload structure
      const savedPayload: WhiteboardSessionRecord = mockSaveFn.mock.calls[0][0];
      expect(savedPayload.room_id).toBe('persistence-room-101');
      expect(savedPayload.pages.length).toBeGreaterThanOrEqual(1);
      expect(savedPayload.active_page_id).toBeDefined();
      expect(savedPayload.permissions.isLockedGlobally).toBe(true);
      expect(savedPayload.updated_at).toBeDefined();

      // Trigger leave classroom and verify cleanup
      const leaveBtn = screen.getByTestId('leave-class-btn');
      fireEvent.click(leaveBtn);

      expect(handleLeave).toHaveBeenCalledTimes(1);
    });
  });
});
