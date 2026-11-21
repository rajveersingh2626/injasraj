import { describe, it, expect } from 'vitest';
import { isRelayedConnection, createDefaultQuality, CandidateType, ConnectionQuality, IMediaSession, SignalingMessage } from '../../src/types/media';
import { Profile, TeacherAvailability, Lesson } from '../../src/types/database';

describe('Media & Domain Types', () => {
  describe('isRelayedConnection', () => {
    it('returns true when candidate type is relay', () => {
      expect(isRelayedConnection('relay')).toBe(true);
    });

    it('returns false for direct or non-relayed candidate types', () => {
      expect(isRelayedConnection('host')).toBe(false);
      expect(isRelayedConnection('srflx')).toBe(false);
      expect(isRelayedConnection('prflx')).toBe(false);
      expect(isRelayedConnection('unknown')).toBe(false);
    });
  });

  describe('createDefaultQuality', () => {
    it('provides safe default quality metrics', () => {
      const defaultQuality = createDefaultQuality();
      expect(defaultQuality).toEqual({
        status: 'connecting',
        rttMs: 0,
        packetLossPercent: 0,
        connectionType: 'unknown',
        isAudioPrioritized: false,
      });
      expect(defaultQuality.status).toBe('connecting');
      expect(defaultQuality.rttMs).toBe(0);
      expect(defaultQuality.packetLossPercent).toBe(0);
      expect(defaultQuality.connectionType).toBe('unknown');
      expect(defaultQuality.isAudioPrioritized).toBe(false);
      expect(defaultQuality.videoResolution).toBeUndefined();
      expect(defaultQuality.fps).toBeUndefined();
    });
  });

  describe('Type Contracts', () => {
    it('allows valid Profile, TeacherAvailability, and Lesson definitions', () => {
      const profile: Profile = {
        id: 'user-123',
        role: 'teacher',
        full_name: 'Aditi Sharma',
        timezone: 'Asia/Kolkata',
        created_at: '2026-11-21T00:00:00Z',
      };
      expect(profile.role).toBe('teacher');

      const availability: TeacherAvailability = {
        id: 'avail-1',
        teacher_id: 'user-123',
        day_of_week: 1,
        start_time: '09:00:00',
        end_time: '17:00:00',
        slot_duration_minutes: 30,
      };
      expect(availability.day_of_week).toBe(1);

      const lesson: Lesson = {
        id: 'lesson-1',
        room_id: 'room-abc-123',
        teacher_id: 'user-123',
        student_id: 'student-456',
        student_name: 'John Doe',
        student_email: 'john@example.com',
        start_time_utc: '2026-11-22T10:00:00Z',
        end_time_utc: '2026-11-22T10:30:00Z',
        status: 'scheduled',
      };
      expect(lesson.status).toBe('scheduled');
    });

    it('allows valid SignalingMessage and ConnectionQuality objects', () => {
      const message: SignalingMessage = {
        type: 'ice-candidate',
        senderId: 'peer-1',
        payload: { candidate: 'candidate:1 1 UDP ...' },
      };
      expect(message.type).toBe('ice-candidate');

      const quality: ConnectionQuality = {
        status: 'good',
        rttMs: 45,
        packetLossPercent: 0.5,
        connectionType: 'srflx',
        isAudioPrioritized: false,
        videoResolution: { width: 1280, height: 720 },
        fps: 30,
      };
      expect(quality.videoResolution?.width).toBe(1280);
    });
  });
});
