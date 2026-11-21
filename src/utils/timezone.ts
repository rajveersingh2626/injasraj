import { TeacherAvailability, Lesson } from '../types/database';

export const TEACHER_TIMEZONE = 'Asia/Kolkata';

export interface SlotItem {
  id: string;
  utcStartTime: string;
  utcEndTime: string;
  studentFormattedTime: string;
  teacherFormattedTime: string;
  dateLabel: string;
  isCrossDay: boolean;
}

/**
 * Auto-detects the client / user's local timezone.
 * Falls back to 'UTC' if Intl is unsupported or fails.
 */
export function detectUserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

/**
 * Returns unambiguous date and time with short timezone abbreviation.
 * e.g. "Nov 22, 2026, 12:00 AM IST"
 */
export function formatLessonDateTime(
  utcString: string,
  targetTz: string = detectUserTimeZone(),
  locale: string = 'en-US'
): string {
  const date = new Date(utcString);
  if (isNaN(date.getTime())) {
    return '';
  }

  const tz = targetTz || detectUserTimeZone();

  try {
    const formatter = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: tz,
      timeZoneName: 'short',
    });
    let formatted = formatter.format(date);
    if (tz === 'Asia/Kolkata') {
      formatted = formatted.replace(/GMT\+0?5:30/g, 'IST');
    }
    return formatted;
  } catch {
    const fallback = new Intl.DateTimeFormat(locale, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: 'UTC',
      timeZoneName: 'short',
    });
    return fallback.format(date);
  }
}

/**
 * Formats a localized date label for calendar grouping (e.g. "Mon, Nov 23, 2026").
 */
export function formatDateLabel(
  date: Date | string,
  targetTz: string = detectUserTimeZone(),
  locale: string = 'en-US'
): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) {
    return '';
  }

  const tz = targetTz || detectUserTimeZone();

  try {
    return new Intl.DateTimeFormat(locale, {
      timeZone: tz,
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  } catch {
    return new Intl.DateTimeFormat(locale, {
      timeZone: 'UTC',
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(d);
  }
}

/**
 * Returns calendar date in YYYY-MM-DD format for a given timezone.
 */
function getLocalDateString(date: Date, timeZone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);

    const year = parts.find((p) => p.type === 'year')?.value;
    const month = parts.find((p) => p.type === 'month')?.value;
    const day = parts.find((p) => p.type === 'day')?.value;
    return `${year}-${month}-${day}`;
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Calculates day of the week (0=Sun..6=Sat) for a given date in a specific timezone.
 */
function getDayOfWeekInTz(date: Date, timeZone: string): number {
  const dateStr = getLocalDateString(date, timeZone);
  // Using noon UTC on dateStr guarantees correct day of week calculation regardless of local offset
  const noonDate = new Date(`${dateStr}T12:00:00Z`);
  return noonDate.getUTCDay();
}

/**
 * Parses a time string (e.g. "16:00:00" or "16:00") into minutes from midnight.
 */
function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(':');
  const h = parseInt(parts[0], 10) || 0;
  const m = parseInt(parts[1], 10) || 0;
  return h * 60 + m;
}

/**
 * Formats dual timezone display for a lesson:
 * - Teacher timezone: Asia/Kolkata (IST)
 * - Student timezone: auto-detected or specified
 * - isCrossDay: true if local calendar date in teacher tz != student tz
 */
export function formatDualTimezones(
  utcString: string,
  studentTz?: string
): { teacherTime: string; studentTime: string; isCrossDay: boolean } {
  const date = new Date(utcString);
  const sTz = studentTz || detectUserTimeZone();

  const teacherTime = formatLessonDateTime(utcString, TEACHER_TIMEZONE);
  const studentTime = formatLessonDateTime(utcString, sTz);

  const teacherDate = getLocalDateString(date, TEACHER_TIMEZONE);
  const studentDate = getLocalDateString(date, sTz);
  const isCrossDay = teacherDate !== studentDate;

  return {
    teacherTime,
    studentTime,
    isCrossDay,
  };
}

/**
 * Generates available, non-conflicting booking slots for a teacher
 * across dateRangeUtc and formatted in the student's local timezone.
 */
export function generateAvailableSlots(
  availabilities: TeacherAvailability[],
  existingLessons: Lesson[],
  dateRangeUtc: { start: string; end: string },
  studentTz: string = detectUserTimeZone()
): SlotItem[] {
  if (!availabilities || availabilities.length === 0) {
    return [];
  }

  const rangeStartMs = new Date(dateRangeUtc.start).getTime();
  const rangeEndMs = new Date(dateRangeUtc.end).getTime();

  if (isNaN(rangeStartMs) || isNaN(rangeEndMs) || rangeEndMs < rangeStartMs) {
    return [];
  }

  const sTz = studentTz || detectUserTimeZone();
  const slots: SlotItem[] = [];
  const seenSlotKeys = new Set<string>();

  // Teacher availability is defined in teacher's timezone (Asia/Kolkata, UTC+5:30)
  // Step across calendar days in Asia/Kolkata spanning the range (-24h to +24h buffer)
  const bufferMs = 24 * 60 * 60 * 1000;
  const earliestMs = rangeStartMs - bufferMs;
  const latestMs = rangeEndMs + bufferMs;

  const candidateDateStrings = new Set<string>();
  for (let t = earliestMs; t <= latestMs; t += 12 * 60 * 60 * 1000) {
    candidateDateStrings.add(getLocalDateString(new Date(t), TEACHER_TIMEZONE));
  }

  const sortedDates = Array.from(candidateDateStrings).sort();

  for (const dateStr of sortedDates) {
    const dayDate = new Date(`${dateStr}T12:00:00Z`);
    const dayOfWeek = dayDate.getUTCDay();

    // Find teacher availabilities matching this day of week
    const matchingAvails = availabilities.filter((a) => a.day_of_week === dayOfWeek);

    for (const avail of matchingAvails) {
      const startMin = parseTimeToMinutes(avail.start_time);
      let endMin = parseTimeToMinutes(avail.end_time);

      if (endMin <= startMin) {
        // Support overnight availability spanning past midnight
        endMin += 24 * 60;
      }

      const duration =
        avail.slot_duration_minutes && avail.slot_duration_minutes > 0
          ? avail.slot_duration_minutes
          : 60;

      // Base timestamp for 00:00:00 IST on dateStr
      const baseMs = new Date(`${dateStr}T00:00:00+05:30`).getTime();

      for (let curMin = startMin; curMin + duration <= endMin; curMin += duration) {
        const slotStartMs = baseMs + curMin * 60 * 1000;
        const slotEndMs = baseMs + (curMin + duration) * 60 * 1000;

        // Check if slot start falls within dateRangeUtc
        const isInRange =
          rangeStartMs === rangeEndMs
            ? slotStartMs === rangeStartMs
            : slotStartMs >= rangeStartMs && slotStartMs < rangeEndMs;

        if (!isInRange) {
          continue;
        }

        // Check for conflicts with existing lessons
        const hasConflict = existingLessons.some((lesson) => {
          if (lesson.status === 'cancelled') {
            return false;
          }
          if (lesson.teacher_id && avail.teacher_id && lesson.teacher_id !== avail.teacher_id) {
            return false;
          }
          const lessonStartMs = new Date(lesson.start_time_utc).getTime();
          const lessonEndMs = new Date(lesson.end_time_utc).getTime();

          if (isNaN(lessonStartMs) || isNaN(lessonEndMs)) {
            return false;
          }

          // Overlap check: slot starts before lesson ends AND slot ends after lesson starts
          return slotStartMs < lessonEndMs && slotEndMs > lessonStartMs;
        });

        if (hasConflict) {
          continue;
        }

        const utcStartTime = new Date(slotStartMs).toISOString();
        const utcEndTime = new Date(slotEndMs).toISOString();
        const slotKey = `${avail.teacher_id || 't'}_${utcStartTime}`;

        if (seenSlotKeys.has(slotKey)) {
          continue;
        }
        seenSlotKeys.add(slotKey);

        const dual = formatDualTimezones(utcStartTime, sTz);

        slots.push({
          id: `${avail.id || 'slot'}-${utcStartTime}`,
          utcStartTime,
          utcEndTime,
          studentFormattedTime: dual.studentTime,
          teacherFormattedTime: dual.teacherTime,
          dateLabel: formatDateLabel(utcStartTime, sTz),
          isCrossDay: dual.isCrossDay,
        });
      }
    }
  }

  // Sort slots in chronological order
  slots.sort(
    (a, b) => new Date(a.utcStartTime).getTime() - new Date(b.utcStartTime).getTime()
  );

  return slots;
}
