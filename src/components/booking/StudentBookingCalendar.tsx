import React, { useState, useMemo } from 'react';
import { TeacherAvailability, Lesson } from '../../types/database';
import {
  SlotItem,
  generateAvailableSlots,
  detectUserTimeZone,
  formatDateLabel,
} from '../../utils/timezone';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';

export interface StudentBookingCalendarProps {
  teacherAvailability?: TeacherAvailability[];
  existingLessons?: Lesson[];
  slots?: SlotItem[];
  onBookSlot: (slot: SlotItem, student: { name: string; email: string }) => void | Promise<void>;
  initialTimezone?: string;
  onTimezoneChange?: (timezone: string) => void;
  className?: string;
}

const COMMON_TIMEZONES = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Toronto',
  'America/Sao_Paulo',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Hong_Kong',
  'Asia/Tokyo',
  'Asia/Seoul',
  'Australia/Sydney',
  'Pacific/Auckland',
  'UTC',
];

export const StudentBookingCalendar: React.FC<StudentBookingCalendarProps> = ({
  teacherAvailability,
  existingLessons = [],
  slots: initialSlots,
  onBookSlot,
  initialTimezone,
  onTimezoneChange,
  className = '',
}) => {
  // Detected or configured student timezone
  const [currentTimezone, setCurrentTimezone] = useState<string>(() => {
    return initialTimezone || detectUserTimeZone();
  });

  // Ensure detected timezone is in the select dropdown list
  const timezoneOptions = useMemo(() => {
    if (!COMMON_TIMEZONES.includes(currentTimezone)) {
      return [currentTimezone, ...COMMON_TIMEZONES];
    }
    return COMMON_TIMEZONES;
  }, [currentTimezone]);

  // Compute available slots
  const computedSlots = useMemo(() => {
    if (teacherAvailability && teacherAvailability.length > 0) {
      const now = new Date();
      // 14-day window in UTC
      const startUtc = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0).toISOString();
      const endUtc = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 14, 23, 59, 59).toISOString();

      return generateAvailableSlots(
        teacherAvailability,
        existingLessons,
        { start: startUtc, end: endUtc },
        currentTimezone
      );
    }
    return initialSlots || [];
  }, [teacherAvailability, existingLessons, initialSlots, currentTimezone]);

  // 14-day date picker dates
  const next14Days = useMemo(() => {
    const dates: { date: Date; dateLabel: string; weekday: string; dayMonth: string }[] = [];
    const now = new Date();

    for (let i = 0; i < 14; i++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
      const label = formatDateLabel(d, currentTimezone);

      let weekday = '';
      let dayMonth = '';
      try {
        weekday = new Intl.DateTimeFormat('en-US', {
          timeZone: currentTimezone,
          weekday: 'short',
        }).format(d);
        dayMonth = new Intl.DateTimeFormat('en-US', {
          timeZone: currentTimezone,
          month: 'short',
          day: 'numeric',
        }).format(d);
      } catch {
        weekday = 'Day';
        dayMonth = `${d.getMonth() + 1}/${d.getDate()}`;
      }

      dates.push({
        date: d,
        dateLabel: label,
        weekday,
        dayMonth,
      });
    }
    return dates;
  }, [currentTimezone]);

  // Selected date state
  const [selectedDateLabel, setSelectedDateLabel] = useState<string | null>(() => {
    if (initialSlots && initialSlots.length > 0) {
      return initialSlots[0].dateLabel;
    }
    return next14Days[0]?.dateLabel || null;
  });

  // Filter slots for the selected date
  const visibleSlots = useMemo(() => {
    if (!selectedDateLabel) {
      return computedSlots;
    }
    const matching = computedSlots.filter((s) => s.dateLabel === selectedDateLabel);
    // If no slots match the selected date but we have slots (e.g. from props), show all available
    if (matching.length === 0 && computedSlots.length > 0 && initialSlots) {
      return computedSlots;
    }
    return matching;
  }, [computedSlots, selectedDateLabel, initialSlots]);

  // Modal State for Booking
  const [selectedSlotForBooking, setSelectedSlotForBooking] = useState<SlotItem | null>(null);
  const [studentName, setStudentName] = useState('');
  const [studentEmail, setStudentEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingError, setBookingError] = useState<string | null>(null);
  const [bookingSuccess, setBookingSuccess] = useState<string | null>(null);

  const handleTimezoneChange = (newTz: string) => {
    setCurrentTimezone(newTz);
    if (onTimezoneChange) {
      onTimezoneChange(newTz);
    }
  };

  const handleOpenBookingModal = (slot: SlotItem) => {
    setSelectedSlotForBooking(slot);
    setBookingError(null);
    setBookingSuccess(null);
  };

  const handleCloseBookingModal = () => {
    setSelectedSlotForBooking(null);
    setStudentName('');
    setStudentEmail('');
    setBookingError(null);
  };

  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlotForBooking) return;

    if (!studentName.trim()) {
      setBookingError('Please enter your full name.');
      return;
    }

    if (!studentEmail.trim() || !studentEmail.includes('@')) {
      setBookingError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    setBookingError(null);

    try {
      await onBookSlot(selectedSlotForBooking, {
        name: studentName.trim(),
        email: studentEmail.trim(),
      });
      setBookingSuccess('Lesson booked successfully! Redirecting to classroom...');
      setTimeout(() => {
        handleCloseBookingModal();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to book slot. Please try again.';
      setBookingError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`space-y-6 max-w-4xl w-full mx-auto ${className}`}>
      {/* Top Header Card with Timezone Selection */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Book a 1-on-1 Lesson</h2>
            <p className="text-sm text-zinc-400 mt-1">
              Select an available time slot. Dual timezone badges show both your local time and the
              teacher&apos;s time in India (IST).
            </p>
          </div>

          <div className="w-full sm:w-auto">
            <label
              htmlFor="student-timezone-select"
              className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-1.5"
            >
              Your Local Timezone
            </label>
            <select
              id="student-timezone-select"
              aria-label="Select Timezone"
              value={currentTimezone}
              onChange={(e) => handleTimezoneChange(e.target.value)}
              style={{ fontSize: '16px' }}
              className="w-full sm:w-64 px-3.5 py-2 bg-zinc-900/90 border border-white/10 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
            >
              {timezoneOptions.map((tz) => (
                <option key={tz} value={tz} className="bg-zinc-900 text-white">
                  {tz}
                </option>
              ))}
            </select>
          </div>
        </div>
      </GlassCard>

      {/* Date Picker (Next 14 Days) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Select Date (Next 14 Days)
          </h3>
          <span className="text-xs text-zinc-400">
            Current timezone: <span className="text-indigo-400">{currentTimezone}</span>
          </span>
        </div>

        <div
          role="region"
          aria-label="14-day date picker"
          className="flex gap-2 overflow-x-auto pb-2 pt-1 scrollbar-thin scrollbar-thumb-zinc-700"
        >
          {next14Days.map((d) => {
            const isSelected = selectedDateLabel === d.dateLabel;
            return (
              <button
                key={d.dateLabel}
                type="button"
                onClick={() => setSelectedDateLabel(d.dateLabel)}
                aria-pressed={isSelected}
                aria-label={`Select date ${d.dateLabel}`}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                className={`flex-shrink-0 flex flex-col items-center justify-center min-w-[76px] py-3 px-2.5 rounded-2xl border transition-all cursor-pointer active:scale-[0.97] select-none ${
                  isSelected
                    ? 'bg-indigo-600/35 border-indigo-400/60 text-white shadow-lg shadow-indigo-950/40'
                    : 'bg-[#121218]/70 border-white/8 text-zinc-400 hover:border-white/18 hover:text-zinc-200'
                }`}
              >
                <span className="text-xs font-medium uppercase tracking-wider">{d.weekday}</span>
                <span className="text-base font-bold text-white mt-0.5">{d.dayMonth}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Available Slots Grid */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-300">
            Available Slots {selectedDateLabel ? `for ${selectedDateLabel}` : ''}
          </h3>
          <span className="text-xs text-zinc-400">
            {visibleSlots.length} slot{visibleSlots.length === 1 ? '' : 's'} available
          </span>
        </div>

        {visibleSlots.length === 0 ? (
          <GlassCard className="p-8 text-center">
            <p className="text-zinc-400 text-sm">
              No available slots found for this date. Please pick another date from the calendar.
            </p>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {visibleSlots.map((slot) => (
              <button
                key={slot.id}
                type="button"
                onClick={() => handleOpenBookingModal(slot)}
                style={{
                  touchAction: 'manipulation',
                  WebkitTapHighlightColor: 'transparent',
                }}
                className="group relative text-left p-4 rounded-2xl border bg-[#121218]/75 border-[rgba(255,255,255,0.08)] backdrop-blur-[16px] hover:border-indigo-400/50 hover:bg-[#1a1a24]/90 transition-all cursor-pointer active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
              >
                {/* Student Time (Prominent) */}
                <div className="flex items-baseline justify-between">
                  <span className="text-base sm:text-lg font-semibold text-white tracking-wide">
                    {slot.studentFormattedTime}
                  </span>
                  <span className="text-xs font-medium text-indigo-400 group-hover:text-indigo-300 transition-colors">
                    Book &rarr;
                  </span>
                </div>

                {/* Teacher Time (Subtle IST secondary) */}
                <div className="text-xs text-zinc-400 mt-1">
                  Teacher: <span className="text-zinc-300 font-medium">{slot.teacherFormattedTime}</span>
                </div>

                {/* Cross-Day Warning Badge if active */}
                {slot.isCrossDay && (
                  <div className="mt-2.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                      Different calendar day in India
                    </span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Booking Confirmation Modal */}
      {selectedSlotForBooking && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="booking-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-white/10 bg-[#14141e]/95 backdrop-blur-[24px] shadow-2xl p-6 sm:p-7 overflow-hidden text-zinc-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 id="booking-modal-title" className="text-xl font-bold text-white">
                  Confirm Lesson Booking
                </h3>
                <p className="text-xs text-zinc-400 mt-1">
                  Enter your details to confirm your lesson and get your instant WebRTC classroom link.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseBookingModal}
                aria-label="Close booking modal"
                className="text-zinc-400 hover:text-white p-1 rounded-lg transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Selected Slot Time Details */}
            <div className="p-4 rounded-xl bg-zinc-900/70 border border-white/8 mb-5 space-y-2">
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-zinc-400">Your Local Time:</span>
                <span className="font-semibold text-white">
                  {selectedSlotForBooking.studentFormattedTime}
                </span>
              </div>
              <div className="flex justify-between items-baseline text-sm">
                <span className="text-zinc-400">Teacher Time (IST):</span>
                <span className="font-medium text-zinc-300">
                  {selectedSlotForBooking.teacherFormattedTime}
                </span>
              </div>
              {selectedSlotForBooking.isCrossDay && (
                <div className="pt-1">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Different calendar day in India
                  </span>
                </div>
              )}
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmBooking} noValidate className="space-y-4">
              <div>
                <label
                  htmlFor="student-name-input"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Student Name
                </label>
                <input
                  id="student-name-input"
                  name="name"
                  type="text"
                  required
                  placeholder="e.g. Alex Johnson"
                  value={studentName}
                  onChange={(e) => setStudentName(e.target.value)}
                  style={{ fontSize: '16px' }}
                  className="w-full px-3.5 py-2.5 bg-zinc-900/90 border border-white/10 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                />
              </div>

              <div>
                <label
                  htmlFor="student-email-input"
                  className="block text-sm font-medium text-zinc-300 mb-1.5"
                >
                  Student Email
                </label>
                <input
                  id="student-email-input"
                  name="email"
                  type="email"
                  required
                  placeholder="e.g. alex@example.com"
                  value={studentEmail}
                  onChange={(e) => setStudentEmail(e.target.value)}
                  style={{ fontSize: '16px' }}
                  className="w-full px-3.5 py-2.5 bg-zinc-900/90 border border-white/10 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400"
                />
              </div>

              {bookingError && (
                <div
                  role="alert"
                  className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm"
                >
                  {bookingError}
                </div>
              )}

              {bookingSuccess && (
                <div
                  role="status"
                  className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm"
                >
                  {bookingSuccess}
                </div>
              )}

              <div className="pt-2 flex flex-col sm:flex-row gap-3">
                <GlassButton
                  type="button"
                  variant="ghost"
                  onClick={handleCloseBookingModal}
                  disabled={isSubmitting}
                  className="order-2 sm:order-1 sm:w-1/3"
                >
                  Cancel
                </GlassButton>
                <GlassButton
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={isSubmitting}
                  className="order-1 sm:order-2 sm:w-2/3 text-base font-semibold"
                >
                  {isSubmitting ? 'Confirming...' : 'Confirm & Get Classroom Link'}
                </GlassButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudentBookingCalendar;
