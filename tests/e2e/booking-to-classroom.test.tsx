import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import TeacherDashboardPage from '../../src/app/page';

import { loginTeacher, logoutTeacher, CANONICAL_TEACHER_ID } from '../../src/lib/auth/teacher-auth';
import BookTeacherPage from '../../src/app/book/[teacherId]/page';
import { BookTeacherView } from '../../src/components/booking/BookTeacherView';
import ClassroomPage from '../../src/app/classroom/[roomId]/page';
import { ClassroomView } from '../../src/components/classroom/ClassroomView';
import { IMediaSession, ConnectionQuality } from '../../src/types/media';
import { SlotItem, formatDateLabel } from '../../src/utils/timezone';

const DEFAULT_TEACHER_ID = CANONICAL_TEACHER_ID;
const DEFAULT_TEACHER_NAME = 'Inderjit Kaur';

// Extend expect for jest-dom matchers
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
  toHaveAttribute(received, name, expected) {
    const value = received?.getAttribute ? received.getAttribute(name) : null;
    const pass =
      expected !== undefined
        ? typeof expected === 'object' && expected !== null && 'asymmetricMatch' in expected
          ? (expected as any).asymmetricMatch(value)
          : value === expected
        : value !== null && value !== undefined;
    return {
      pass,
      message: () =>
        `expected element to ${pass ? 'not ' : ''}have attribute ${name}=${expected}, received ${value}`,
    };
  },
});

// Mock Next.js navigation hooks
let mockRouterPush = vi.fn();
let mockCurrentParams: Record<string, string> = {
  teacherId: DEFAULT_TEACHER_ID,
  roomId: 'test-room-101',
};
let mockCurrentSearchParams = new URLSearchParams('role=student&name=Alice%20Smith');

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useParams: () => mockCurrentParams,
  useSearchParams: () => mockCurrentSearchParams,
  usePathname: () => '/',
}));

// Mock Next.js Image component
vi.mock('next/image', () => ({
  default: ({ priority, ...props }: any) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt || 'mock-img'} {...props} />;
  },
}));

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

const todayDate = new Date();
const todayLabel = formatDateLabel(todayDate, 'America/New_York');

const mockTestSlots: SlotItem[] = [
  {
    id: 'slot-regular-1',
    utcStartTime: todayDate.toISOString(),
    utcEndTime: new Date(todayDate.getTime() + 3600000).toISOString(),
    studentFormattedTime: 'Nov 23, 2026, 5:30 AM EST',
    teacherFormattedTime: 'Nov 23, 2026, 4:00 PM IST',
    dateLabel: todayLabel,
    isCrossDay: false,
  },
  {
    id: 'slot-crossday-2',
    utcStartTime: new Date(todayDate.getTime() + 7200000).toISOString(),
    utcEndTime: new Date(todayDate.getTime() + 10800000).toISOString(),
    studentFormattedTime: 'Nov 23, 2026, 3:30 PM EST',
    teacherFormattedTime: 'Nov 24, 2026, 2:00 AM IST',
    dateLabel: todayLabel,
    isCrossDay: true,
  },
];

describe('Task 10 E2E Platform Integration: Booking to Live Classroom', () => {
  let mockSession: IMediaSession;
  let sessionCallbacks: {
    remoteTrack?: (track: any, stream: any) => void;
    qualityMetrics?: (metrics: ConnectionQuality) => void;
  };

  beforeEach(() => {
    mockRouterPush = vi.fn();
    mockCurrentParams = {
      teacherId: DEFAULT_TEACHER_ID,
      roomId: 'test-room-101',
    };
    mockCurrentSearchParams = new URLSearchParams('role=student&name=Alice%20Smith');
    sessionCallbacks = {};

    mockSession = {
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

    // Mock clipboard
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Suite 1: Platform Home & Teacher Dashboard (src/app/page.tsx)', () => {
    beforeEach(() => {
      loginTeacher('Mt22@raman');
    });

    it('displays student portal when teacher is not logged in', () => {
      logoutTeacher();
      render(<TeacherDashboardPage />);
      expect(screen.getByTestId('student-portal-section')).toBeInTheDocument();
      expect(screen.getByText('Join a Live Class')).toBeInTheDocument();
      expect(screen.getByTestId('teacher-login-modal-trigger')).toBeInTheDocument();
      expect(screen.queryByTestId('instant-room-btn')).toBeNull();
    });
    it('renders platform branding, teacher timezone badge, and instant room generator', () => {
      render(<TeacherDashboardPage />);

      expect(screen.getByText('Injasraj')).toBeInTheDocument();
      expect(screen.getByText(/Base TZ: Asia\/Kolkata/)).toBeInTheDocument();
      expect(screen.getByTestId('instant-room-btn')).toBeInTheDocument();
      expect(screen.getByTestId('launch-room-btn')).toBeInTheDocument();
    });

    it('generates an instant 1:1 room and navigates or displays room code', async () => {
      render(<TeacherDashboardPage />);

      const generateBtn = screen.getByTestId('instant-room-btn');
      fireEvent.click(generateBtn);

      expect(await screen.findByText(/Instant Room Ready:/)).toBeInTheDocument();
      expect(screen.getByText('Enter Room')).toBeInTheDocument();
    });

    it('copies the shareable student booking link to clipboard', async () => {
      render(<TeacherDashboardPage />);

      const copyBtn = screen.getByTestId('copy-booking-link-btn');
      fireEvent.click(copyBtn);

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
        expect.stringContaining(`/book/${DEFAULT_TEACHER_ID}`)
      );
      expect(await screen.findByText('Copied!')).toBeInTheDocument();
    });

    it('toggles between Weekly Availability and Upcoming Lessons tabs', async () => {
      render(<TeacherDashboardPage />);

      // Weekly availability tab is active by default
      expect(screen.getByText('Weekly Availability')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Teacher Availability/i })).toBeInTheDocument();

      // Switch to Upcoming Lessons tab
      const lessonsTab = screen.getByRole('button', { name: /Upcoming Lessons/ });
      fireEvent.click(lessonsTab);

      expect(screen.getByTestId('upcoming-lessons-list')).toBeInTheDocument();
      expect(screen.getByText('No upcoming lessons yet')).toBeInTheDocument();
      expect(
        screen.getByText(/Share your booking link to let international students schedule 1:1 sessions/i)
      ).toBeInTheDocument();
    });
  });

  describe('Suite 2: Student Booking Flow (src/app/book/[teacherId]/page.tsx)', () => {
    it('renders teacher header and student detected timezone', () => {
      render(
        <BookTeacherView
          teacherId="teacher-1"
          teacherName="Injasraj"
          initialTimezone="America/New_York"
          slots={mockTestSlots}
        />
      );

      expect(screen.getByText('Book 1:1 with Injasraj')).toBeInTheDocument();
      expect(screen.getByText(/Your Timezone: America\/New_York/)).toBeInTheDocument();
      expect(screen.getByText(/Teacher Base: Asia\/Kolkata \(IST\)/)).toBeInTheDocument();
    });

    it('renders the default BookTeacherPage route component with Promise params', async () => {
      await act(async () => {
        render(
          <BookTeacherPage
            params={Promise.resolve({ teacherId: 'teacher-42' })}
          />
        );
      });

      expect(screen.getByTestId('student-booking-page')).toBeInTheDocument();
      expect(screen.getByText(/Verified Teacher/)).toBeInTheDocument();
    });

    it('allows student to select a slot, fill form, and book lesson', async () => {
      const handleBookSuccess = vi.fn();
      render(
        <BookTeacherView
          teacherId="teacher-1"
          teacherName="Injasraj"
          initialTimezone="America/New_York"
          slots={mockTestSlots}
          onBookSuccess={handleBookSuccess}
        />
      );

      // Verify slot text is in document and click its button
      const slotTimeText = screen.getByText('Nov 23, 2026, 5:30 AM EST');
      expect(slotTimeText).toBeInTheDocument();
      const slotButton = slotTimeText.closest('button');
      expect(slotButton).not.toBeNull();
      fireEvent.click(slotButton!);

      // Booking modal opens
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: /Confirm Lesson Booking/i })).toBeInTheDocument();

      // Enter student details
      const nameInput = screen.getByLabelText(/Student Name/i);
      const emailInput = screen.getByLabelText(/Student Email/i);

      fireEvent.change(nameInput, { target: { value: 'Sarah Connor' } });
      fireEvent.change(emailInput, { target: { value: 'sarah@resistance.ai' } });

      // Submit booking
      const confirmBtn = screen.getByRole('button', { name: /Confirm & Get Classroom Link/i });
      fireEvent.click(confirmBtn);

      // Confirmation screen is displayed
      await waitFor(() => {
        expect(screen.getByTestId('booking-confirmation-card')).toBeInTheDocument();
      }, { timeout: 5000 });

      expect(screen.getByText('Lesson Confirmed!')).toBeInTheDocument();
      expect(screen.getByText(/Sarah Connor/)).toBeInTheDocument();
      expect(screen.getByTestId('enter-classroom-btn')).toBeInTheDocument();
      expect(handleBookSuccess).toHaveBeenCalledTimes(1);
    });
  });

  describe('Suite 3: Live Classroom Integration & WebRTC Session (src/app/classroom/[roomId]/page.tsx)', () => {
    it('mounts classroom page, connects media session, and displays participant badges', async () => {
      render(
        <ClassroomView
          roomId="room-abc-123"
          role="student"
          userName="Alice Smith"
          mediaSession={mockSession}
        />
      );

      expect(screen.getByTestId('classroom-page')).toBeInTheDocument();
      expect(screen.getByTestId('classroom-container')).toBeInTheDocument();

      // Verify connect was called with roomId
      expect(mockSession.connect).toHaveBeenCalledWith(
        'room-abc-123',
        expect.stringContaining('student_')
      );

      // Verify local participant name & badges
      expect(screen.getAllByText(/Alice Smith/)[0]).toBeInTheDocument();
      expect(screen.getAllByText('Student').length).toBeGreaterThanOrEqual(1);
    });

    it('mounts classroom page as teacher with teacher badges and controls', async () => {
      loginTeacher('Mt22@raman');
      render(
        <ClassroomView
          roomId="room-teacher-99"
          role="teacher"
          userName="Injasraj"
          mediaSession={mockSession}
        />
      );

      expect(mockSession.connect).toHaveBeenCalledWith(
        'room-teacher-99',
        expect.any(String)
      );

      expect(screen.getAllByText(/Injasraj/)[0]).toBeInTheDocument();
      logoutTeacher();
    });

    it('mounts ClassroomPage default export with Promise params', async () => {
      await act(async () => {
        render(
          <ClassroomPage
            params={Promise.resolve({ roomId: 'room-promise-101' })}
          />
        );
      });

      expect(screen.getByTestId('classroom-page')).toBeInTheDocument();
      expect(screen.getByTestId('classroom-container')).toBeInTheDocument();
    });

    it('handles leaving the classroom: calls session disconnect and routes to home', async () => {
      const handleLeave = vi.fn();
      render(
        <ClassroomView
          roomId="room-leave-test"
          role="student"
          userName="Bob"
          mediaSession={mockSession}
          onLeave={handleLeave}
        />
      );

      const leaveBtn = screen.getByTestId('leave-class-btn');
      fireEvent.click(leaveBtn);

      expect(mockSession.disconnect).toHaveBeenCalled();
      expect(handleLeave).toHaveBeenCalledTimes(1);
      expect(mockRouterPush).toHaveBeenCalledWith('/');
    });
  });

  describe('Suite 4: End-to-End Booking to Classroom Flow', () => {
    it('simulates full booking -> direct classroom link creation -> classroom mounting', async () => {
      let createdLesson: any = null;

      // Step 1: Student visits booking page
      const { unmount } = render(
        <BookTeacherView
          teacherId="teacher-1"
          teacherName="Injasraj"
          initialTimezone="America/New_York"
          slots={mockTestSlots}
          onBookSuccess={(lesson) => {
            createdLesson = lesson;
          }}
        />
      );

      // Step 2: Book slot
      const slotButton = screen.getByText('Nov 23, 2026, 5:30 AM EST').closest('button');
      expect(slotButton).not.toBeNull();
      fireEvent.click(slotButton!);

      fireEvent.change(screen.getByLabelText(/Student Name/i), {
        target: { value: 'David Miller' },
      });
      fireEvent.change(screen.getByLabelText(/Student Email/i), {
        target: { value: 'david@intl-school.com' },
      });

      fireEvent.click(screen.getByRole('button', { name: /Confirm & Get Classroom Link/i }));

      await waitFor(() => {
        expect(screen.getByTestId('booking-confirmation-card')).toBeInTheDocument();
      });

      expect(createdLesson).not.toBeNull();
      expect(createdLesson.student_name).toBe('David Miller');
      expect(createdLesson.room_id).toBeDefined();

      const enterClassroomLink = screen.getByTestId('enter-classroom-btn').closest('a');
      expect(enterClassroomLink?.getAttribute('href')).toContain(`/classroom/${createdLesson.room_id}`);

      unmount();

      // Step 3: Mount Classroom using the generated room_id and student credentials
      render(
        <ClassroomView
          roomId={createdLesson.room_id}
          role="student"
          userName={createdLesson.student_name}
          mediaSession={mockSession}
        />
      );

      expect(screen.getByTestId('classroom-container')).toBeInTheDocument();
      expect(mockSession.connect).toHaveBeenCalledWith(
        createdLesson.room_id,
        expect.stringContaining('student_')
      );
      expect(screen.getAllByText(/David Miller/)[0]).toBeInTheDocument();
    });
  });
});
