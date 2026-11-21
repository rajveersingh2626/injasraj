'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Video,
  Calendar,
  Clock,
  Copy,
  Check,
  ExternalLink,
  Sparkles,
  Users,
  Radio,
  BookOpen,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { TeacherAvailabilityForm } from '@/components/booking/TeacherAvailabilityForm';
import { TeacherAvailability, Lesson } from '@/types/database';
import { formatLessonDateTime, TEACHER_TIMEZONE } from '@/utils/timezone';
import { createBrowserClient } from '@/lib/supabase/client';

const DEFAULT_TEACHER_ID = 'teacher-1';
const DEFAULT_TEACHER_NAME = 'Injasraj';

const INITIAL_AVAILABILITIES: TeacherAvailability[] = [1, 2, 3, 4, 5].map((day) => ({
  id: `avail-${day}`,
  teacher_id: DEFAULT_TEACHER_ID,
  day_of_week: day,
  start_time: '16:00:00',
  end_time: '21:00:00',
  slot_duration_minutes: 60,
}));

const INITIAL_LESSONS: Lesson[] = [
  {
    id: 'lesson-101',
    room_id: 'lesson-room-101',
    teacher_id: DEFAULT_TEACHER_ID,
    student_name: 'Emma Watson',
    student_email: 'emma@oxford-intl.edu',
    start_time_utc: new Date(Date.now() + 86400000).toISOString(),
    end_time_utc: new Date(Date.now() + 86400000 + 3600000).toISOString(),
    status: 'scheduled',
    created_at: new Date().toISOString(),
  },
  {
    id: 'lesson-102',
    room_id: 'lesson-room-102',
    teacher_id: DEFAULT_TEACHER_ID,
    student_name: 'Kenji Sato',
    student_email: 'kenji@tokyo-ed.jp',
    start_time_utc: new Date(Date.now() + 172800000).toISOString(),
    end_time_utc: new Date(Date.now() + 172800000 + 3600000).toISOString(),
    status: 'scheduled',
    created_at: new Date().toISOString(),
  },
];

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'availability' | 'lessons'>('availability');
  const [availabilities, setAvailabilities] = useState<TeacherAvailability[]>(INITIAL_AVAILABILITIES);
  const [lessons, setLessons] = useState<Lesson[]>(INITIAL_LESSONS);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Instant room state
  const [customRoomId, setCustomRoomId] = useState<string>('');
  const [generatedRoomId, setGeneratedRoomId] = useState<string>('');

  // Shareable booking link state
  const [origin, setOrigin] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
    }
  }, []);

  const bookingPath = `/book/${DEFAULT_TEACHER_ID}`;
  const fullBookingUrl = origin ? `${origin}${bookingPath}` : bookingPath;

  // Handle saving teacher availability
  const handleSaveAvailability = async (updated: TeacherAvailability[]) => {
    setAvailabilities(updated);
    setSaveSuccessMsg('Teacher weekly availability saved successfully!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4000);

    // Attempt to persist to Supabase if table is configured
    try {
      const supabase = createBrowserClient();
      if (supabase && typeof supabase.from === 'function') {
        await supabase
          .from('teacher_availability')
          .upsert(updated, { onConflict: 'teacher_id,day_of_week' });
      }
    } catch {
      // Graceful fallback for mock/local setups
    }
  };

  // Generate instant room
  const handleGenerateInstantRoom = () => {
    const randomCode = Math.random().toString(36).substring(2, 8);
    const roomId = customRoomId.trim() || `room-${Date.now().toString(36)}-${randomCode}`;
    setGeneratedRoomId(roomId);
  };

  // Launch instant room
  const handleJoinInstantRoom = () => {
    const roomId = generatedRoomId || customRoomId.trim() || `room-${Date.now().toString(36)}`;
    router.push(`/classroom/${roomId}?role=teacher&name=${encodeURIComponent(DEFAULT_TEACHER_NAME)}`);
  };

  // Copy booking link to clipboard
  const handleCopyLink = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullBookingUrl);
      }
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    } catch {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2500);
    }
  };

  return (
    <main
      data-testid="teacher-dashboard"
      className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-8"
    >
      {/* Platform Header */}
      <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-zinc-800/80 pb-6">
        <div className="flex items-center space-x-3.5">
          <div className="p-2 rounded-xl bg-zinc-900/90 border border-zinc-800 shadow-inner">
            <Logo size={42} alt="Injasraj Platform Logo" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-50">
                Injasraj Classroom
              </h1>
              <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Teacher Hub
              </span>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400">
              Low-latency international 1:1 lessons • Base TZ: {TEACHER_TIMEZONE} (IST)
            </p>
          </div>
        </div>

        {/* Instant 1:1 Room Quick Bar */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto">
          <div className="relative flex-1 sm:w-60">
            <input
              type="text"
              placeholder="Custom room ID (optional)"
              value={customRoomId}
              onChange={(e) => setCustomRoomId(e.target.value)}
              className="w-full bg-zinc-900/90 border border-zinc-800/90 rounded-lg px-3 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/70"
            />
          </div>

          <GlassButton
            variant="default"
            onClick={handleGenerateInstantRoom}
            data-testid="instant-room-btn"
            className="flex items-center space-x-1.5"
          >
            <Sparkles className="w-4 h-4 text-indigo-400" />
            <span>Generate Room</span>
          </GlassButton>

          <GlassButton
            variant="primary"
            onClick={handleJoinInstantRoom}
            data-testid="launch-room-btn"
            className="flex items-center space-x-1.5"
          >
            <Video className="w-4 h-4" />
            <span>Start Instant Class</span>
          </GlassButton>
        </div>
      </header>

      {/* Generated Instant Room Alert Banner */}
      {generatedRoomId && (
        <GlassCard className="p-4 border-indigo-500/40 bg-indigo-950/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <Radio className="w-5 h-5 text-indigo-400 animate-pulse" />
            <div>
              <p className="text-sm font-semibold text-zinc-100">
                Instant Room Ready:{' '}
                <span className="text-indigo-300 font-mono">{generatedRoomId}</span>
              </p>
              <p className="text-xs text-zinc-400">
                Share this room ID or link with your student to start right away.
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Link
              href={`/classroom/${generatedRoomId}?role=teacher&name=${encodeURIComponent(DEFAULT_TEACHER_NAME)}`}
            >
              <GlassButton variant="primary" size="sm" className="flex items-center space-x-1">
                <Video className="w-3.5 h-3.5" />
                <span>Enter Room</span>
              </GlassButton>
            </Link>
          </div>
        </GlassCard>
      )}

      {/* Shareable Booking Link Card */}
      <GlassCard className="p-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <Users className="w-4 h-4 text-emerald-400" />
              <h2 className="text-base font-semibold text-zinc-100">
                Shareable Student Booking Link
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400">
              Students automatically see your available slots converted seamlessly into their local timezone.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            <div
              data-testid="shareable-booking-link"
              className="bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-zinc-300 font-mono truncate max-w-md select-all"
            >
              {fullBookingUrl}
            </div>

            <GlassButton
              variant="default"
              onClick={handleCopyLink}
              data-testid="copy-booking-link-btn"
              className="flex items-center justify-center space-x-1.5 whitespace-nowrap"
            >
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400 font-medium">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-zinc-300" />
                  <span>Copy Link</span>
                </>
              )}
            </GlassButton>

            <Link href={bookingPath} target="_blank" rel="noopener noreferrer">
              <GlassButton
                variant="ghost"
                className="flex items-center justify-center space-x-1.5 whitespace-nowrap w-full"
              >
                <ExternalLink className="w-4 h-4 text-zinc-400" />
                <span>Preview Student View</span>
              </GlassButton>
            </Link>
          </div>
        </div>
      </GlassCard>

      {/* Navigation Tabs */}
      <div className="flex items-center space-x-2 border-b border-zinc-800/80 pb-2">
        <button
          onClick={() => setActiveTab('availability')}
          className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'availability'
              ? 'bg-zinc-800/90 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>Weekly Availability</span>
        </button>

        <button
          onClick={() => setActiveTab('lessons')}
          className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'lessons'
              ? 'bg-zinc-800/90 text-white shadow-sm'
              : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Upcoming Lessons</span>
          <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-zinc-700/60 text-zinc-300">
            {lessons.length}
          </span>
        </button>
      </div>

      {/* Success Notification */}
      {saveSuccessMsg && (
        <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-emerald-300 text-sm flex items-center space-x-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{saveSuccessMsg}</span>
        </div>
      )}

      {/* Tab 1: Weekly Availability Form */}
      {activeTab === 'availability' && (
        <section aria-label="Teacher Availability Management" className="space-y-4">
          <TeacherAvailabilityForm
            teacherId={DEFAULT_TEACHER_ID}
            initialAvailabilities={availabilities}
            onSave={handleSaveAvailability}
          />
        </section>
      )}

      {/* Tab 2: Upcoming Lessons List */}
      {activeTab === 'lessons' && (
        <section
          data-testid="upcoming-lessons-list"
          aria-label="Upcoming Scheduled Lessons"
          className="space-y-4"
        >
          {lessons.length === 0 ? (
            <GlassCard className="p-8 text-center text-zinc-400">
              <BookOpen className="w-10 h-10 mx-auto text-zinc-500 mb-2 opacity-60" />
              <p className="text-base font-medium">No upcoming lessons yet</p>
              <p className="text-xs text-zinc-500 mt-1">
                Share your booking link to let international students schedule 1:1 sessions.
              </p>
            </GlassCard>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {lessons.map((lesson) => {
                const formattedIst = formatLessonDateTime(
                  lesson.start_time_utc,
                  TEACHER_TIMEZONE
                );

                return (
                  <GlassCard
                    key={lesson.id}
                    className="p-5 flex flex-col justify-between space-y-4 hover:border-zinc-700/70 transition-colors"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="px-2 py-0.5 text-xs font-semibold rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 capitalize">
                          {lesson.status}
                        </span>
                        <span className="text-xs font-mono text-zinc-500">
                          Room: {lesson.room_id}
                        </span>
                      </div>

                      <h3 className="text-base font-semibold text-zinc-100">
                        {lesson.student_name}
                      </h3>
                      <p className="text-xs text-zinc-400 font-mono">
                        {lesson.student_email}
                      </p>

                      <div className="flex items-center space-x-2 text-xs text-zinc-300 pt-1">
                        <Clock className="w-3.5 h-3.5 text-indigo-400" />
                        <span>Teacher IST: {formattedIst}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-zinc-800/80 flex items-center justify-between">
                      <span className="text-xs text-zinc-400">1:1 Video Session</span>
                      <Link
                        href={`/classroom/${lesson.room_id}?role=teacher&name=${encodeURIComponent(DEFAULT_TEACHER_NAME)}`}
                      >
                        <GlassButton
                          variant="primary"
                          size="sm"
                          className="flex items-center space-x-1.5"
                        >
                          <Video className="w-3.5 h-3.5" />
                          <span>Join Room</span>
                        </GlassButton>
                      </Link>
                    </div>
                  </GlassCard>
                );
              })}
            </div>
          )}
        </section>
      )}
    </main>
  );
}
