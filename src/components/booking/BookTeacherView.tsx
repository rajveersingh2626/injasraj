'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Globe,
  Clock,
  CheckCircle2,
  Video,
  ArrowLeft,
  Calendar,
} from 'lucide-react';
import { Logo } from '../Logo';
import { GlassCard } from '../ui/GlassCard';
import { GlassButton } from '../ui/GlassButton';
import { StudentBookingCalendar } from './StudentBookingCalendar';
import { TeacherAvailability, Lesson } from '../../types/database';
import {
  SlotItem,
  detectUserTimeZone,
  TEACHER_TIMEZONE,
  formatLessonDateTime,
} from '../../utils/timezone';
import { createBrowserClient } from '../../lib/supabase/client';

export interface BookTeacherViewProps {
  teacherId?: string;
  teacherName?: string;
  initialTimezone?: string;
  initialAvailability?: TeacherAvailability[];
  slots?: SlotItem[];
  onBookSuccess?: (lesson: Lesson) => void;
}

const DEFAULT_AVAILABILITY: TeacherAvailability[] = [1, 2, 3, 4, 5].map((day) => ({
  id: `avail-${day}`,
  teacher_id: 'teacher-1',
  day_of_week: day,
  start_time: '16:00:00',
  end_time: '21:00:00',
  slot_duration_minutes: 60,
}));

export function BookTeacherView({
  teacherId = 'teacher-1',
  teacherName = 'Injasraj',
  initialTimezone,
  initialAvailability = DEFAULT_AVAILABILITY,
  slots,
  onBookSuccess,
}: BookTeacherViewProps) {
  // Detected student timezone
  const [studentTimezone, setStudentTimezone] = useState<string>(() => {
    return initialTimezone || detectUserTimeZone();
  });

  // State for created lesson upon booking confirmation
  const [bookedLesson, setBookedLesson] = useState<Lesson | null>(null);
  const [bookedSlot, setBookedSlot] = useState<SlotItem | null>(null);

  // Handle student slot booking
  const handleBookSlot = async (
    slot: SlotItem,
    student: { name: string; email: string }
  ) => {
    const roomId = `room-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;
    const lesson: Lesson = {
      id: `lesson-${Date.now()}`,
      room_id: roomId,
      teacher_id: teacherId,
      student_name: student.name,
      student_email: student.email,
      start_time_utc: slot.utcStartTime,
      end_time_utc: slot.utcEndTime,
      status: 'scheduled',
      created_at: new Date().toISOString(),
    };

    try {
      const supabase = createBrowserClient();
      if (supabase && typeof supabase.from === 'function') {
        await supabase.from('lessons').insert(lesson);
      }
    } catch {
      // Mock / offline fallback
    }

    setBookedLesson(lesson);
    setBookedSlot(slot);
    onBookSuccess?.(lesson);
  };

  const classroomPath = bookedLesson
    ? `/classroom/${bookedLesson.room_id}?role=student&name=${encodeURIComponent(bookedLesson.student_name)}`
    : '';

  return (
    <main
      data-testid="student-booking-page"
      className="min-h-screen bg-zinc-950 text-zinc-100 p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6"
    >
      {/* Navigation & Teacher Profile Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="flex items-center space-x-3.5">
          <div className="p-2 rounded-xl bg-zinc-900 border border-zinc-800 shadow-inner">
            <Logo size={40} alt="Injasraj Platform" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100">
                Book 1:1 with {teacherName}
              </h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Verified Teacher
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-zinc-400 mt-1">
              <span className="flex items-center space-x-1">
                <Globe className="w-3.5 h-3.5 text-zinc-400" />
                <span>Teacher Base: {TEACHER_TIMEZONE} (IST)</span>
              </span>
              <span>•</span>
              <span className="flex items-center space-x-1 text-indigo-400 font-medium">
                <Clock className="w-3.5 h-3.5" />
                <span>Your Timezone: {studentTimezone}</span>
              </span>
            </div>
          </div>
        </div>

        <Link href="/">
          <GlassButton
            variant="ghost"
            size="sm"
            className="flex items-center space-x-1.5 text-zinc-400 hover:text-zinc-200"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Platform Home</span>
          </GlassButton>
        </Link>
      </div>

      {/* Confirmation Screen after booking */}
      {bookedLesson ? (
        <GlassCard
          data-testid="booking-confirmation-card"
          className="p-6 sm:p-8 border-emerald-500/40 bg-emerald-950/20 max-w-2xl mx-auto text-center space-y-6"
        >
          <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <CheckCircle2 className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <h2 className="text-2xl font-bold text-zinc-100">
              Lesson Confirmed!
            </h2>
            <p className="text-sm text-zinc-300">
              Your 1:1 classroom session with <strong className="text-white">{teacherName}</strong> is reserved.
            </p>
          </div>

          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 text-left space-y-3 font-sans text-sm">
            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="text-zinc-400">Student:</span>
              <span className="font-semibold text-zinc-200">
                {bookedLesson.student_name} ({bookedLesson.student_email})
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="text-zinc-400">Your Local Time ({studentTimezone}):</span>
              <span className="font-semibold text-emerald-400">
                {bookedSlot?.studentFormattedTime ||
                  formatLessonDateTime(bookedLesson.start_time_utc, studentTimezone)}
              </span>
            </div>

            <div className="flex justify-between items-center border-b border-zinc-800 pb-2">
              <span className="text-zinc-400">Teacher Time (IST):</span>
              <span className="font-semibold text-zinc-300">
                {bookedSlot?.teacherFormattedTime ||
                  formatLessonDateTime(bookedLesson.start_time_utc, TEACHER_TIMEZONE)}
              </span>
            </div>

            <div className="flex justify-between items-center pt-1">
              <span className="text-zinc-400">Classroom Room ID:</span>
              <span className="font-mono text-xs bg-zinc-800 px-2 py-1 rounded text-indigo-300">
                {bookedLesson.room_id}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link href={classroomPath} className="w-full sm:w-auto">
              <GlassButton
                variant="primary"
                size="lg"
                data-testid="enter-classroom-btn"
                className="w-full flex items-center justify-center space-x-2 px-6"
              >
                <Video className="w-5 h-5" />
                <span>Enter Classroom Now</span>
              </GlassButton>
            </Link>

            <GlassButton
              variant="default"
              size="lg"
              onClick={() => {
                setBookedLesson(null);
                setBookedSlot(null);
              }}
              className="w-full sm:w-auto"
            >
              <Calendar className="w-4 h-4 mr-1.5" />
              <span>Book Another Lesson</span>
            </GlassButton>
          </div>
        </GlassCard>
      ) : (
        /* Student Booking Calendar Component */
        <section aria-label="Available Lesson Slots" className="space-y-4">
          <StudentBookingCalendar
            teacherAvailability={initialAvailability}
            slots={slots}
            initialTimezone={studentTimezone}
            onTimezoneChange={(newTz) => setStudentTimezone(newTz)}
            onBookSlot={handleBookSlot}
          />
        </section>
      )}
    </main>
  );
}
