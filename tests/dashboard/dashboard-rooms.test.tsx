import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ActiveRoomsManager } from '../../src/components/dashboard/ActiveRoomsManager';
import { PastClassesManager } from '../../src/components/dashboard/PastClassesManager';
import { ManagedRoom } from '../../src/lib/classroom/room-manager';
import { PastClassRecord } from '../../src/lib/classroom/past-classes';

describe('Teacher Dashboard Room Management Components', () => {
  const mockActiveRooms: ManagedRoom[] = [
    {
      id: 'active-1',
      roomId: 'room-active-instant',
      title: 'Instant Math 1:1',
      type: 'instant',
      createdAt: new Date().toISOString(),
      joinedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 12 * 60 * 1000).toISOString(), // 12 mins left
      status: 'active',
    },
    {
      id: 'active-2',
      roomId: 'room-active-scheduled',
      title: 'Scheduled Science Session',
      type: 'scheduled',
      createdAt: new Date().toISOString(),
      status: 'active',
    },
  ];

  it('renders active room links with student copy button, join button, and delete button', () => {
    const handleDelete = vi.fn();
    const handleJoin = vi.fn();

    render(
      <ActiveRoomsManager
        rooms={mockActiveRooms}
        onDeleteRoom={handleDelete}
        onJoinAsTeacher={handleJoin}
      />
    );

    expect(screen.getByText('Instant Math 1:1')).toBeDefined();
    expect(screen.getByText('Scheduled Science Session')).toBeDefined();

    // Verify copy student link button exists
    const copyBtns = screen.getAllByRole('button', { name: /copy student link/i });
    expect(copyBtns.length).toBe(2);

    // Verify delete button triggers handler
    const deleteBtn = screen.getByTestId('delete-room-room-active-instant');
    fireEvent.click(deleteBtn);
    expect(handleDelete).toHaveBeenCalledWith('room-active-instant');

    // Verify join button triggers handler
    const joinBtn = screen.getByTestId('join-teacher-room-active-instant');
    fireEvent.click(joinBtn);
    expect(handleJoin).toHaveBeenCalledWith('room-active-instant');
  });

  it('renders past classes list with duration, page count, and launch whiteboard action', () => {
    const mockPastClasses: PastClassRecord[] = [
      {
        id: 'past-1',
        roomId: 'room-past-101',
        title: 'Completed Calculus Intro',
        date: new Date().toISOString(),
        durationSeconds: 780,
        pageCount: 3,
      },
    ];

    const handleDeletePast = vi.fn();
    const handleLaunch = vi.fn();

    render(
      <PastClassesManager
        pastClasses={mockPastClasses}
        onDeletePastClass={handleDeletePast}
        onLaunchWithWhiteboard={handleLaunch}
      />
    );

    expect(screen.getByText('Completed Calculus Intro')).toBeDefined();
    expect(screen.getByText(/3 pages/i)).toBeDefined();

    const launchBtn = screen.getByTestId('launch-with-wb-room-past-101');
    fireEvent.click(launchBtn);
    expect(handleLaunch).toHaveBeenCalledWith(mockPastClasses[0]);

    const deletePastBtn = screen.getByTestId('delete-past-past-1');
    fireEvent.click(deletePastBtn);
    expect(handleDeletePast).toHaveBeenCalledWith('past-1');
  });
});
