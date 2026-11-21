import React, { useState } from 'react';
import { TeacherAvailability } from '../../types/database';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';

export interface TeacherAvailabilityFormProps {
  teacherId?: string;
  initialAvailabilities?: TeacherAvailability[];
  onSave: (availabilities: TeacherAvailability[]) => void | Promise<void>;
  isLoading?: boolean;
  className?: string;
}

export const DAYS_OF_WEEK = [
  { day: 0, name: 'Sunday', short: 'Sun' },
  { day: 1, name: 'Monday', short: 'Mon' },
  { day: 2, name: 'Tuesday', short: 'Tue' },
  { day: 3, name: 'Wednesday', short: 'Wed' },
  { day: 4, name: 'Thursday', short: 'Thu' },
  { day: 5, name: 'Friday', short: 'Fri' },
  { day: 6, name: 'Saturday', short: 'Sat' },
];

export const TeacherAvailabilityForm: React.FC<TeacherAvailabilityFormProps> = ({
  teacherId = 'teacher-1',
  initialAvailabilities,
  onSave,
  isLoading = false,
  className = '',
}) => {
  // Initialize state based on initialAvailabilities or defaults
  const [selectedDays, setSelectedDays] = useState<number[]>(() => {
    if (initialAvailabilities && initialAvailabilities.length > 0) {
      return initialAvailabilities.map((a) => a.day_of_week);
    }
    // Default to weekdays: Mon-Fri (1, 2, 3, 4, 5)
    return [1, 2, 3, 4, 5];
  });

  const [startTime, setStartTime] = useState<string>(() => {
    if (initialAvailabilities && initialAvailabilities.length > 0) {
      return initialAvailabilities[0].start_time.slice(0, 5);
    }
    return '16:00';
  });

  const [endTime, setEndTime] = useState<string>(() => {
    if (initialAvailabilities && initialAvailabilities.length > 0) {
      return initialAvailabilities[0].end_time.slice(0, 5);
    }
    return '21:00';
  });

  const [slotDuration, setSlotDuration] = useState<number>(() => {
    if (initialAvailabilities && initialAvailabilities.length > 0) {
      return initialAvailabilities[0].slot_duration_minutes || 60;
    }
    return 60;
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const toggleDay = (day: number) => {
    setError(null);
    setSelectedDays((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]
    );
  };

  const handleSelectAllDays = () => {
    setError(null);
    setSelectedDays([0, 1, 2, 3, 4, 5, 6]);
  };

  const handleClearDays = () => {
    setSelectedDays([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (selectedDays.length === 0) {
      setError('Please select at least one active day.');
      return;
    }

    if (!startTime || !endTime) {
      setError('Please provide valid start and end times.');
      return;
    }

    // Format times into HH:mm:ss for database schema compliance
    const formattedStart = startTime.length === 5 ? `${startTime}:00` : startTime;
    const formattedEnd = endTime.length === 5 ? `${endTime}:00` : endTime;

    const sortedDays = [...selectedDays].sort((a, b) => a - b);
    const availabilities: TeacherAvailability[] = sortedDays.map((day) => {
      const existing = initialAvailabilities?.find((a) => a.day_of_week === day);
      return {
        id: existing?.id || `avail-${teacherId}-${day}`,
        teacher_id: teacherId,
        day_of_week: day,
        start_time: formattedStart,
        end_time: formattedEnd,
        slot_duration_minutes: Number(slotDuration),
      };
    });

    setIsSubmitting(true);
    try {
      await onSave(availabilities);
      setSuccessMessage('Availability saved in IST (UTC+5:30) successfully!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save availability.';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GlassCard className={`p-6 max-w-2xl w-full mx-auto shadow-2xl ${className}`}>
      <div className="mb-6">
        <h2 className="text-xl font-bold text-white tracking-tight">Teacher Availability</h2>
        <p className="text-sm text-zinc-400 mt-1">
          Configure your active weekly teaching hours in{' '}
          <span className="text-indigo-400 font-medium">India Standard Time (IST / UTC+5:30)</span>.
          All inputs use accessible &gt;= 16px touch targets.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Active Days Selection */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-zinc-200">
              Active Days of the Week
            </label>
            <div className="flex items-center gap-2 text-xs">
              <button
                type="button"
                onClick={handleSelectAllDays}
                className="text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
              >
                Select All
              </button>
              <span className="text-zinc-600">|</span>
              <button
                type="button"
                onClick={handleClearDays}
                className="text-zinc-400 hover:text-zinc-300 transition-colors cursor-pointer"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {DAYS_OF_WEEK.map(({ day, name, short }) => {
              const isChecked = selectedDays.includes(day);
              return (
                <label
                  key={day}
                  htmlFor={`day-checkbox-${day}`}
                  className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all cursor-pointer select-none ${
                    isChecked
                      ? 'bg-indigo-600/20 border-indigo-500/50 text-white shadow-inner'
                      : 'bg-[#181822]/60 border-white/5 text-zinc-400 hover:border-white/15 hover:text-zinc-200'
                  }`}
                >
                  <input
                    id={`day-checkbox-${day}`}
                    name="active_days"
                    type="checkbox"
                    value={day}
                    checked={isChecked}
                    onChange={() => toggleDay(day)}
                    style={{ fontSize: '16px' }}
                    className="w-4 h-4 rounded border-zinc-700 text-indigo-600 focus:ring-indigo-500 bg-zinc-900 cursor-pointer"
                  />
                  <span className="text-sm font-medium">
                    <span className="hidden sm:inline">{name}</span>
                    <span className="sm:hidden">{short}</span>
                  </span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Time Settings */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label
              htmlFor="start-time-input"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              Start Time (IST)
            </label>
            <input
              id="start-time-input"
              name="start_time"
              type="time"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              style={{ fontSize: '16px' }}
              className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-white/10 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all"
              required
            />
            <span className="text-xs text-zinc-500 mt-1 block">Default: 16:00 IST (4:00 PM)</span>
          </div>

          <div>
            <label
              htmlFor="end-time-input"
              className="block text-sm font-medium text-zinc-300 mb-1.5"
            >
              End Time (IST)
            </label>
            <input
              id="end-time-input"
              name="end_time"
              type="time"
              value={endTime}
              onChange={(e) => setEndTime(e.target.value)}
              style={{ fontSize: '16px' }}
              className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-white/10 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all"
              required
            />
            <span className="text-xs text-zinc-500 mt-1 block">Default: 21:00 IST (9:00 PM)</span>
          </div>
        </div>

        {/* Slot Duration */}
        <div>
          <label
            htmlFor="slot-duration-select"
            className="block text-sm font-medium text-zinc-300 mb-1.5"
          >
            Lesson Slot Duration
          </label>
          <select
            id="slot-duration-select"
            name="slot_duration"
            value={slotDuration}
            onChange={(e) => setSlotDuration(Number(e.target.value))}
            style={{ fontSize: '16px' }}
            className="w-full px-3.5 py-2.5 bg-zinc-900/80 border border-white/10 rounded-xl text-white text-base focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-400 transition-all cursor-pointer"
          >
            <option value={30} className="bg-zinc-900 text-white">
              30 minutes
            </option>
            <option value={45} className="bg-zinc-900 text-white">
              45 minutes
            </option>
            <option value={60} className="bg-zinc-900 text-white">
              60 minutes
            </option>
          </select>
          <span className="text-xs text-zinc-500 mt-1 block">
            Each lesson block is partitioned based on this duration.
          </span>
        </div>

        {/* Status and Error Messages */}
        {error && (
          <div
            role="alert"
            className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-red-300 text-sm"
          >
            {error}
          </div>
        )}

        {successMessage && (
          <div
            role="status"
            className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-sm"
          >
            {successMessage}
          </div>
        )}

        {/* Submit Button */}
        <GlassButton
          type="submit"
          variant="primary"
          size="lg"
          disabled={isLoading || isSubmitting}
          className="w-full text-base font-semibold"
        >
          {isLoading || isSubmitting ? 'Saving Availability...' : 'Save Availability'}
        </GlassButton>
      </form>
    </GlassCard>
  );
};

export default TeacherAvailabilityForm;
