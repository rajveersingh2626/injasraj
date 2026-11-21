import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  detectUserTimeZone,
  formatLessonDateTime,
  formatDualTimezones,
  generateAvailableSlots,
  TEACHER_TIMEZONE,
  SlotItem,
} from '../../src/utils/timezone';
import { TeacherAvailability, Lesson } from '../../src/types/database';

describe('Timezone Utilities', () => {
  const utcSample = '2026-11-21T18:30:00Z'; // 18:30 UTC = 00:00 next day (Nov 22) IST (+5:30)

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('detectUserTimeZone', () => {
    it('returns a detected timezone or UTC fallback', () => {
      const tz = detectUserTimeZone();
      expect(typeof tz).toBe('string');
      expect(tz.length).toBeGreaterThan(0);
    });

    it('falls back to UTC if Intl is unavailable or throws', () => {
      vi.spyOn(Intl, 'DateTimeFormat').mockImplementation(() => {
        throw new Error('Intl error');
      });
      expect(detectUserTimeZone()).toBe('UTC');
    });
  });

  describe('formatLessonDateTime', () => {
    it('formats UTC string into unambiguous date and time in IST', () => {
      const formatted = formatLessonDateTime(utcSample, 'Asia/Kolkata');
      expect(formatted).toContain('Nov 22, 2026');
      expect(formatted).toContain('12:00 AM');
      expect(formatted).toContain('IST');
    });

    it('formats UTC string into student local timezone (America/New_York)', () => {
      const formatted = formatLessonDateTime(utcSample, 'America/New_York');
      expect(formatted).toContain('Nov 21, 2026');
      expect(formatted).toContain('1:30 PM');
      expect(formatted).toContain('EST');
    });

    it('handles invalid date strings gracefully', () => {
      expect(formatLessonDateTime('not-a-valid-date')).toBe('');
    });
  });

  describe('formatDualTimezones', () => {
    it('detects cross-day boundary for international student in New York', () => {
      const dual = formatDualTimezones(utcSample, 'America/New_York');
      expect(dual.teacherTime).toContain('Nov 22');
      expect(dual.studentTime).toContain('Nov 21');
      expect(dual.isCrossDay).toBe(true);
    });

    it('detects same-day when teacher and student dates match', () => {
      // 10:00 UTC = 15:30 IST (Nov 21) and 05:00 EST (Nov 21)
      const sameDayUtc = '2026-11-21T10:00:00Z';
      const dual = formatDualTimezones(sameDayUtc, 'America/New_York');
      expect(dual.teacherTime).toContain('Nov 21');
      expect(dual.studentTime).toContain('Nov 21');
      expect(dual.isCrossDay).toBe(false);
    });

    it('detects cross-day boundary when student is ahead of IST (e.g. Sydney)', () => {
      // 16:00 UTC = 21:30 IST (Nov 21), 03:00 AEDT next day (Nov 22)
      const aheadUtc = '2026-11-21T16:00:00Z';
      const dual = formatDualTimezones(aheadUtc, 'Australia/Sydney');
      expect(dual.teacherTime).toContain('Nov 21');
      expect(dual.studentTime).toContain('Nov 22');
      expect(dual.isCrossDay).toBe(true);
    });

    it('defaults to detected student timezone when not explicitly provided', () => {
      const dual = formatDualTimezones(utcSample);
      expect(dual.teacherTime).toBeDefined();
      expect(dual.studentTime).toBeDefined();
      expect(typeof dual.isCrossDay).toBe('boolean');
    });
  });

  describe('generateAvailableSlots', () => {
    // 2026-11-23 is a Monday (day_of_week = 1)
    const baseAvailability: TeacherAvailability[] = [
      {
        id: 'avail-1',
        teacher_id: 't-1',
        day_of_week: 1, // Monday
        start_time: '16:00:00', // 16:00 IST = 10:30 UTC
        end_time: '18:00:00', // 18:00 IST = 12:30 UTC
        slot_duration_minutes: 60,
      },
    ];

    it('generates non-conflicting booking slots converted to student timezone', () => {
      const lessons: Lesson[] = [];
      const slots = generateAvailableSlots(
        baseAvailability,
        lessons,
        { start: '2026-11-23T00:00:00Z', end: '2026-11-24T00:00:00Z' },
        'America/New_York'
      );

      expect(slots.length).toBe(2);

      // Slot 1: 10:30 UTC - 11:30 UTC (16:00 - 17:00 IST)
      expect(slots[0].utcStartTime).toBe('2026-11-23T10:30:00.000Z');
      expect(slots[0].utcEndTime).toBe('2026-11-23T11:30:00.000Z');
      expect(slots[0].teacherFormattedTime).toContain('4:00 PM');
      expect(slots[0].studentFormattedTime).toContain('5:30 AM');
      expect(slots[0].dateLabel).toContain('Nov 23');
      expect(slots[0].isCrossDay).toBe(false);

      // Slot 2: 11:30 UTC - 12:30 UTC (17:00 - 18:00 IST)
      expect(slots[1].utcStartTime).toBe('2026-11-23T11:30:00.000Z');
      expect(slots[1].utcEndTime).toBe('2026-11-23T12:30:00.000Z');
      expect(slots[1].teacherFormattedTime).toContain('5:00 PM');
      expect(slots[1].studentFormattedTime).toContain('6:30 AM');
    });

    it('slices slots into 30-minute increments correctly', () => {
      const halfHourAvail: TeacherAvailability[] = [
        {
          id: 'avail-2',
          teacher_id: 't-1',
          day_of_week: 1,
          start_time: '16:00:00',
          end_time: '18:00:00',
          slot_duration_minutes: 30,
        },
      ];

      const slots = generateAvailableSlots(
        halfHourAvail,
        [],
        { start: '2026-11-23T00:00:00Z', end: '2026-11-24T00:00:00Z' },
        'Asia/Kolkata'
      );

      expect(slots.length).toBe(4);
      expect(slots[0].utcStartTime).toBe('2026-11-23T10:30:00.000Z');
      expect(slots[1].utcStartTime).toBe('2026-11-23T11:00:00.000Z');
      expect(slots[2].utcStartTime).toBe('2026-11-23T11:30:00.000Z');
      expect(slots[3].utcStartTime).toBe('2026-11-23T12:00:00.000Z');
    });

    it('filters out slots that conflict with existing scheduled lessons', () => {
      // Conflicting lesson overlaps with slot 1 (10:30 - 11:30 UTC)
      const existingLessons: Lesson[] = [
        {
          id: 'lesson-1',
          room_id: 'room-1',
          teacher_id: 't-1',
          student_name: 'Alice',
          student_email: 'alice@example.com',
          start_time_utc: '2026-11-23T10:30:00.000Z',
          end_time_utc: '2026-11-23T11:30:00.000Z',
          status: 'scheduled',
        },
      ];

      const slots = generateAvailableSlots(
        baseAvailability,
        existingLessons,
        { start: '2026-11-23T00:00:00Z', end: '2026-11-24T00:00:00Z' },
        'America/New_York'
      );

      // Only slot 2 remains
      expect(slots.length).toBe(1);
      expect(slots[0].utcStartTime).toBe('2026-11-23T11:30:00.000Z');
    });

    it('does NOT filter out slots if the overlapping lesson is cancelled', () => {
      const cancelledLessons: Lesson[] = [
        {
          id: 'lesson-2',
          room_id: 'room-2',
          teacher_id: 't-1',
          student_name: 'Bob',
          student_email: 'bob@example.com',
          start_time_utc: '2026-11-23T10:30:00.000Z',
          end_time_utc: '2026-11-23T11:30:00.000Z',
          status: 'cancelled',
        },
      ];

      const slots = generateAvailableSlots(
        baseAvailability,
        cancelledLessons,
        { start: '2026-11-23T00:00:00Z', end: '2026-11-24T00:00:00Z' },
        'America/New_York'
      );

      expect(slots.length).toBe(2);
    });

    it('does NOT filter out slots if the booked lesson belongs to a different teacher', () => {
      const otherTeacherLesson: Lesson[] = [
        {
          id: 'lesson-3',
          room_id: 'room-3',
          teacher_id: 'different-teacher-99',
          student_name: 'Charlie',
          student_email: 'charlie@example.com',
          start_time_utc: '2026-11-23T10:30:00.000Z',
          end_time_utc: '2026-11-23T11:30:00.000Z',
          status: 'scheduled',
        },
      ];

      const slots = generateAvailableSlots(
        baseAvailability,
        otherTeacherLesson,
        { start: '2026-11-23T00:00:00Z', end: '2026-11-24T00:00:00Z' },
        'America/New_York'
      );

      expect(slots.length).toBe(2);
    });

    it('correctly flags isCrossDay for night slots viewed by a US student', () => {
      // Availability on Monday night: 23:00 IST to 24:00 IST (17:30 UTC to 18:30 UTC)
      // On Monday Nov 23:
      // In IST: Nov 23, 11:00 PM
      // In New York (EST = UTC-5): Nov 23, 12:30 PM (same day)
      // Availability on Sunday late night: 00:00 to 01:00 IST (18:30 UTC to 19:30 UTC previous day)
      // In IST: Nov 23 00:00 (Monday)
      // In New York: Nov 22 13:30 (Sunday) -> Cross-day!
      const lateNightAvail: TeacherAvailability[] = [
        {
          id: 'avail-late',
          teacher_id: 't-1',
          day_of_week: 1, // Monday
          start_time: '00:00:00', // 00:00 IST = 18:30 UTC previous day (Sunday)
          end_time: '01:00:00',
          slot_duration_minutes: 60,
        },
      ];

      const slots = generateAvailableSlots(
        lateNightAvail,
        [],
        { start: '2026-11-22T00:00:00Z', end: '2026-11-24T00:00:00Z' },
        'America/New_York'
      );

      expect(slots.length).toBeGreaterThan(0);
      const crossDaySlot = slots.find((s) => s.utcStartTime === '2026-11-22T18:30:00.000Z');
      expect(crossDaySlot).toBeDefined();
      expect(crossDaySlot?.isCrossDay).toBe(true);
      expect(crossDaySlot?.teacherFormattedTime).toContain('Nov 23');
      expect(crossDaySlot?.studentFormattedTime).toContain('Nov 22');
    });

    it('returns empty array when no availabilities or range is empty', () => {
      expect(
        generateAvailableSlots([], [], { start: '2026-11-23T00:00:00Z', end: '2026-11-24T00:00:00Z' })
      ).toEqual([]);
      expect(
        generateAvailableSlots(
          baseAvailability,
          [],
          { start: '2026-11-24T00:00:00Z', end: '2026-11-23T00:00:00Z' }
        )
      ).toEqual([]);
    });
  });
});
