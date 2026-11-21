import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PeopleTab, Participant } from '../../src/components/whiteboard/tabs/PeopleTab';
import { WhiteboardPermissions, defaultWhiteboardPermissions } from '../../src/types/whiteboard';

// Extend expect for matchers
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

describe('PeopleTab Component (Whiteboard Classroom Participants & Authority)', () => {
  const mockParticipants: Participant[] = [
    {
      id: 'teacher-1',
      name: 'Dr. Jane Smith',
      role: 'teacher',
      isMicOn: true,
      isCameraOn: true,
      isSelf: true,
    },
    {
      id: 'student-1',
      name: 'Alex Johnson',
      role: 'student',
      isMicOn: true,
      isCameraOn: false,
      isDrawingAllowed: false,
    },
    {
      id: 'student-2',
      name: 'Samira Patel',
      role: 'student',
      isMicOn: false,
      isCameraOn: true,
      isDrawingAllowed: true,
    },
  ];

  const mockPermissions: WhiteboardPermissions = {
    ...defaultWhiteboardPermissions(),
    isLockedGlobally: false,
    laserPointerOnly: false,
    studentDrawingGranted: {
      'student-1': false,
      'student-2': true,
    },
  };

  it('renders all participants with names, role badges, and media status icons', () => {
    render(
      <PeopleTab
        participants={mockParticipants}
        currentUserRole="student"
        permissions={mockPermissions}
      />
    );

    // Names
    expect(screen.getByText('Dr. Jane Smith')).toBeInTheDocument();
    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
    expect(screen.getByText('Samira Patel')).toBeInTheDocument();

    // Role Badges
    expect(screen.getByTestId('role-badge-teacher-1')).toBeInTheDocument();
    expect(screen.getByTestId('role-badge-teacher-1').textContent).toContain('Teacher');
    expect(screen.getByTestId('role-badge-student-1').textContent).toContain('Student');

    // Media status indicators
    expect(screen.getByTestId('mic-status-teacher-1')).toBeInTheDocument();
    expect(screen.getByTestId('camera-status-teacher-1')).toBeInTheDocument();
    expect(screen.getByTestId('mic-status-student-2')).toBeInTheDocument();
  });

  it('enforces teacher-only visibility guard: hides controls when current user is a student', () => {
    render(
      <PeopleTab
        participants={mockParticipants}
        currentUserRole="student"
        permissions={mockPermissions}
      />
    );

    // Teacher section and controls must not exist for students
    expect(screen.queryByTestId('teacher-controls-section')).toBeNull();
    expect(screen.queryByTestId('toggle-global-lock')).toBeNull();
    expect(screen.queryByTestId('toggle-laser-only')).toBeNull();
    expect(screen.queryByTestId('toggle-drawing-student-1')).toBeNull();
    expect(screen.queryByTestId('toggle-drawing-student-2')).toBeNull();
  });

  it('renders teacher controls and per-student drawing toggles when current user is a teacher', () => {
    render(
      <PeopleTab
        participants={mockParticipants}
        currentUserRole="teacher"
        permissions={mockPermissions}
      />
    );

    // Teacher section & controls visible
    expect(screen.getByTestId('teacher-controls-section')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-global-lock')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-laser-only')).toBeInTheDocument();

    // Per-student drawing switches rendered for students
    expect(screen.getByTestId('toggle-drawing-student-1')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-drawing-student-2')).toBeInTheDocument();
    // But NOT for the teacher
    expect(screen.queryByTestId('toggle-drawing-teacher-1')).toBeNull();
  });

  it('triggers onToggleGlobalLock callback when global lock switch is clicked', () => {
    const handleToggleGlobalLock = vi.fn();
    render(
      <PeopleTab
        participants={mockParticipants}
        currentUserRole="teacher"
        permissions={mockPermissions}
        onToggleGlobalLock={handleToggleGlobalLock}
      />
    );

    const lockToggle = screen.getByTestId('toggle-global-lock');
    fireEvent.click(lockToggle);

    expect(handleToggleGlobalLock).toHaveBeenCalledTimes(1);
    expect(handleToggleGlobalLock).toHaveBeenCalledWith(true);
  });

  it('triggers onToggleLaserOnly callback when laser pointer only switch is clicked', () => {
    const handleToggleLaserOnly = vi.fn();
    render(
      <PeopleTab
        participants={mockParticipants}
        currentUserRole="teacher"
        permissions={mockPermissions}
        onToggleLaserOnly={handleToggleLaserOnly}
      />
    );

    const laserToggle = screen.getByTestId('toggle-laser-only');
    fireEvent.click(laserToggle);

    expect(handleToggleLaserOnly).toHaveBeenCalledTimes(1);
    expect(handleToggleLaserOnly).toHaveBeenCalledWith(true);
  });

  it('triggers onToggleStudentDrawing callback with studentId and inverted grant flag', () => {
    const handleToggleStudentDrawing = vi.fn();
    render(
      <PeopleTab
        participants={mockParticipants}
        currentUserRole="teacher"
        permissions={mockPermissions}
        onToggleStudentDrawing={handleToggleStudentDrawing}
      />
    );

    // student-1 currently has drawing = false -> click should request true
    const drawingToggle1 = screen.getByTestId('toggle-drawing-student-1');
    fireEvent.click(drawingToggle1);
    expect(handleToggleStudentDrawing).toHaveBeenCalledWith('student-1', true);

    // student-2 currently has drawing = true -> click should request false
    const drawingToggle2 = screen.getByTestId('toggle-drawing-student-2');
    fireEvent.click(drawingToggle2);
    expect(handleToggleStudentDrawing).toHaveBeenCalledWith('student-2', false);
  });
});
