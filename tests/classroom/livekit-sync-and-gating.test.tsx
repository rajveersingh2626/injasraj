import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import {
  StudentNameModal,
  STUDENT_NAME_STORAGE_KEY,
  STUDENT_DEVICE_ID_STORAGE_KEY,
  getOrCreateStudentDeviceId,
} from '@/components/classroom/StudentNameModal';
import { VideoCard } from '@/components/classroom/VideoCard';
import { ClassroomWorkspace } from '@/components/classroom/ClassroomWorkspace';

describe('Task Suite: LiveKit Sync, Student Persistence & Pre-Class Media Gating', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  describe('1. Student Rejoin Persistence (Same Device / Same Identity)', () => {
    it('creates and persists a stable student device ID across rejoins', () => {
      expect(localStorage.getItem(STUDENT_DEVICE_ID_STORAGE_KEY)).toBeNull();
      const firstDeviceId = getOrCreateStudentDeviceId();
      expect(firstDeviceId).toContain('student_dev_');
      expect(localStorage.getItem(STUDENT_DEVICE_ID_STORAGE_KEY)).toBe(firstDeviceId);

      // Subsequent call from the same browser context must return identical device ID
      const secondDeviceId = getOrCreateStudentDeviceId();
      expect(secondDeviceId).toBe(firstDeviceId);
    });

    it('submits and saves student name alongside stable device ID', () => {
      const onJoinMock = vi.fn();
      render(<StudentNameModal isOpen={true} onJoin={onJoinMock} />);

      const input = screen.getByTestId('student-display-name-input');
      const submitBtn = screen.getByTestId('student-name-submit-btn');

      fireEvent.change(input, { target: { value: 'Harpreet Singh' } });
      fireEvent.click(submitBtn);

      expect(onJoinMock).toHaveBeenCalledWith('Harpreet Singh');
      expect(localStorage.getItem(STUDENT_NAME_STORAGE_KEY)).toBe('Harpreet Singh');
    });
  });

  describe('2. Bidirectional Mic & Video State Sync + Camera-Off Avatar Fallback', () => {
    it('renders clean avatar fallback with initials when isCameraOff is true', () => {
      render(
        <VideoCard
          participantName="Simranjit Kaur"
          roleBadge="Student"
          isCameraOff={true}
          isAudioMuted={false}
        />
      );

      const avatar = screen.getByTestId('avatar-fallback');
      expect(avatar).toBeDefined();
      expect(screen.getByTestId('avatar-initials').textContent).toBe('SK');
      expect(screen.getByTestId('avatar-camera-off-icon')).toBeDefined();
    });

    it('renders muted mic badge when isAudioMuted is true', () => {
      render(
        <VideoCard
          participantName="Simranjit Kaur"
          roleBadge="Student"
          isCameraOff={false}
          isAudioMuted={true}
        />
      );

      expect(screen.getByTestId('audio-muted-badge')).toBeDefined();
    });
  });

  describe('3. Pre-Class Waiting Gate (Block Media Until Teacher Starts)', () => {
    it('renders waiting placeholder for students when sessionStatus is waiting, blocking video feed', () => {
      render(
        <ClassroomWorkspace
          roomId="room-test-waiting"
          role="student"
          userName="Aman"
          initialMode="classroom"
          participants={[
            { id: 'teacher_1', name: 'Master Teacher', role: 'teacher', isCameraOn: true, isMicOn: true },
          ]}
        />
      );

      // Student waiting room banner should be rendered
      expect(screen.getByTestId('student-waiting-room')).toBeDefined();
      expect(screen.getByText(/Waiting for tutor to start the class/i)).toBeDefined();

      // Remote video tile is replaced by waiting placeholder
      expect(screen.getByTestId('remote-video-waiting-placeholder')).toBeDefined();
      expect(screen.getByText(/Teacher Video Feed Gated/i)).toBeDefined();
      expect(screen.queryByTestId('remote-video-wrapper')).toBeNull();
    });

    it('renders video tiles when role is teacher even in waiting status so teacher can preview', () => {
      render(
        <ClassroomWorkspace
          roomId="room-test-teacher"
          role="teacher"
          userName="Tutor"
          initialMode="classroom"
          participants={[
            { id: 'student_1', name: 'Student Aman', role: 'student', isCameraOn: true, isMicOn: true },
          ]}
        />
      );

      // Teacher sees Start Class button
      expect(screen.getByTestId('start-class-btn')).toBeDefined();
      // Teacher can see remote student tile once student enters
      expect(screen.getByTestId('remote-video-wrapper')).toBeDefined();
    });
  });
});
