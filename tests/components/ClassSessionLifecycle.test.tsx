import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { EndClassSummaryModal } from '../../src/components/classroom/EndClassSummaryModal';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';

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
});

describe('Classroom Session Lifecycle (Start Class & End Class)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('EndClassSummaryModal', () => {
    it('renders lesson duration, pages count, stars awarded, and triggers PDF download callback', () => {
      const mockDownload = vi.fn();
      const mockClose = vi.fn();

      render(
        <EndClassSummaryModal
          isOpen={true}
          durationSeconds={2720} // 45m 20s
          pagesCount={4}
          starsAwarded={5}
          onDownloadPdf={mockDownload}
          onClose={mockClose}
        />
      );

      expect(screen.getByText(/Class Completed!/i)).toBeInTheDocument();
      expect(screen.getByText('45m 20s')).toBeInTheDocument();
      expect(screen.getByText('Worksheets')).toBeInTheDocument();
      expect(screen.getByText('Stars')).toBeInTheDocument();

      const downloadBtn = screen.getByTestId('download-summary-pdf-btn');
      fireEvent.click(downloadBtn);
      expect(mockDownload).toHaveBeenCalledTimes(1);

      const closeBtn = screen.getByTestId('close-summary-modal-btn');
      fireEvent.click(closeBtn);
      expect(mockClose).toHaveBeenCalledTimes(1);
    }, 15000);

    it('does not render when isOpen is false', () => {
      const { container } = render(
        <EndClassSummaryModal
          isOpen={false}
          durationSeconds={100}
          pagesCount={1}
          starsAwarded={0}
          onDownloadPdf={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(container.firstChild).toBeNull();
    });
  });

  describe('ClassroomWorkspace Session Controls', () => {
    it('shows Start Class button for teacher when in waiting status, then switches to End Class', () => {
      render(
        <ClassroomWorkspace
          roomId="room-test"
          currentUserId="user-teacher"
          role="teacher"
        />
      );

      const startClassBtn = screen.getByTestId('start-class-btn');
      expect(startClassBtn).toBeInTheDocument();
      expect(startClassBtn.textContent).toContain('Start Class');

      // Start the class
      fireEvent.click(startClassBtn);

      const endClassBtn = screen.getByTestId('end-class-btn');
      expect(endClassBtn).toBeInTheDocument();
      expect(endClassBtn.textContent).toContain('End Class');
    });

    it('shows waiting banner/overlay for student before teacher starts class', () => {
      render(
        <ClassroomWorkspace
          roomId="room-test"
          currentUserId="user-student"
          role="student"
        />
      );

      expect(screen.getByTestId('student-waiting-room')).toBeInTheDocument();
      expect(screen.getByText(/Waiting for tutor to start/i)).toBeInTheDocument();
    });
  });
});
