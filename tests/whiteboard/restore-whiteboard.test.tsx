import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MaterialsTab } from '../../src/components/whiteboard/tabs/MaterialsTab';
import { PastClassRecord } from '../../src/lib/classroom/past-classes';
import { createDefaultWhiteboardPage, defaultWhiteboardPermissions } from '../../src/types/whiteboard';

describe('In-Classroom Whiteboard Reload from Past Sessions', () => {
  const mockPastClasses: PastClassRecord[] = [
    {
      id: 'past-math-1',
      roomId: 'room-math-prev',
      title: 'Previous Trigonometry Notes',
      date: new Date().toISOString(),
      durationSeconds: 900,
      pageCount: 3,
      whiteboardSnapshot: {
        room_id: 'room-math-prev',
        pages: [
          createDefaultWhiteboardPage('p-trig-1', 1, 'Trig Formulas'),
          createDefaultWhiteboardPage('p-trig-2', 2, 'Triangle Proofs'),
        ],
        active_page_id: 'p-trig-1',
        permissions: defaultWhiteboardPermissions(),
      },
    },
  ];

  it('renders past classes list in MaterialsTab and triggers onRestoreWhiteboard', () => {
    const handleRestore = vi.fn();
    const handleLoadWorksheet = vi.fn();

    render(
      <MaterialsTab
        onLoadWorksheet={handleLoadWorksheet}
        pastClasses={mockPastClasses}
        onRestoreWhiteboard={handleRestore}
        isTeacher={true}
      />
    );

    expect(screen.getByText('Previous Trigonometry Notes')).toBeDefined();
    expect(screen.getAllByText(/3 pages/i).length).toBeGreaterThan(0);

    const restoreBtn = screen.getByTestId('restore-past-wb-room-math-prev');
    fireEvent.click(restoreBtn);

    expect(handleRestore).toHaveBeenCalledWith(mockPastClasses[0]);
  });
});
