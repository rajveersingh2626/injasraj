'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  Link2,
  History,
  Lock,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { Logo } from '@/components/Logo';
import { GlassCard } from '@/components/ui/GlassCard';
import { GlassButton } from '@/components/ui/GlassButton';
import { TeacherAvailabilityForm } from '@/components/booking/TeacherAvailabilityForm';
import { ActiveRoomsManager } from '@/components/dashboard/ActiveRoomsManager';
import { PastClassesManager } from '@/components/dashboard/PastClassesManager';
import { TeacherLoginModal } from '@/components/auth/TeacherLoginModal';
import { TeacherAvailability, Lesson } from '@/types/database';
import { formatLessonDateTime, TEACHER_TIMEZONE } from '@/utils/timezone';
import { createBrowserClient } from '@/lib/supabase/client';
import {
  getTeacherSession,
  logoutTeacher,
  TeacherSession,
  CANONICAL_TEACHER_ID,
} from '@/lib/auth/teacher-auth';
import {
  createManagedRoom,
  getActiveRooms,
  deleteManagedRoom,
  recordRoomJoin,
  checkAndExpireRooms,
  syncRoomsFromSupabase,
  ManagedRoom,
} from '@/lib/classroom/room-manager';
import {
  getPastClasses,
  deletePastClass,
  archiveClassToHistory,
  syncPastClassesFromSupabase,
  PastClassRecord,
} from '@/lib/classroom/past-classes';

const DEFAULT_TEACHER_ID = CANONICAL_TEACHER_ID;
const DEFAULT_TEACHER_NAME = 'Inderjit Kaur';

const INITIAL_AVAILABILITIES: TeacherAvailability[] = [1, 2, 3, 4, 5].map((day) => ({
  id: `avail-${day}`,
  teacher_id: DEFAULT_TEACHER_ID,
  day_of_week: day,
  start_time: '16:00:00',
  end_time: '21:00:00',
  slot_duration_minutes: 60,
}));

export default function TeacherDashboardPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'availability' | 'active_links' | 'lessons' | 'past_classes'>('availability');
  const [availabilities, setAvailabilities] = useState<TeacherAvailability[]>(INITIAL_AVAILABILITIES);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Authentication State
  const [teacherSession, setTeacherSession] = useState<TeacherSession | null>(null);
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);

  // Active Rooms & Past Classes State
  const [activeRooms, setActiveRooms] = useState<ManagedRoom[]>([]);
  const [pastClasses, setPastClasses] = useState<PastClassRecord[]>([]);

  // Student Portal State
  const [studentJoinRoomId, setStudentJoinRoomId] = useState<string>('');

  // Instant room creation input
  const [customRoomId, setCustomRoomId] = useState<string>('');
  const [generatedRoomId, setGeneratedRoomId] = useState<string>('');

  // Shareable booking link state
  const [origin, setOrigin] = useState<string>('');
  const [isCopied, setIsCopied] = useState<boolean>(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
        copyTimeoutRef.current = null;
      }
    };
  }, []);

  const handleStudentJoinRoom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const clean = studentJoinRoomId.trim();
    if (!clean) return;
    router.push(`/classroom/${encodeURIComponent(clean)}?role=student`);
  };

  const refreshRoomsAndHistory = useCallback(async () => {
    const { active, expired } = checkAndExpireRooms();
    // Auto-archive any expired instant rooms to past classes
    if (expired.length > 0) {
      await Promise.all(
        expired.map((exp) => archiveClassToHistory(exp.roomId, exp.title, 900))
      );
    }
    setActiveRooms(active);
    setPastClasses(getPastClasses());
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setOrigin(window.location.origin);
      setTeacherSession(getTeacherSession());
      refreshRoomsAndHistory();

      // Load availability and sync rooms from Supabase
      const loadSupabaseData = async () => {
        try {
          const supabase = createBrowserClient();
          if (supabase && typeof supabase.from === 'function') {
            const { data, error } = await supabase
              .from('teacher_availability')
              .select('*')
              .eq('teacher_id', DEFAULT_TEACHER_ID)
              .order('day_of_week', { ascending: true });

            if (!error && Array.isArray(data) && data.length > 0) {
              setAvailabilities(data);
            }
          }
        } catch {}

        try {
          const [rooms, past] = await Promise.all([
            syncRoomsFromSupabase(),
            syncPastClassesFromSupabase(),
          ]);
          setActiveRooms(rooms);
          setPastClasses(past);
        } catch {}
      };

      loadSupabaseData();
    }

    const interval = setInterval(() => {
      refreshRoomsAndHistory();
    }, 4000);

    return () => clearInterval(interval);
  }, [refreshRoomsAndHistory]);

  const bookingPath = `/book/${DEFAULT_TEACHER_ID}`;
  const fullBookingUrl = origin ? `${origin}${bookingPath}` : bookingPath;

  // Handle saving teacher availability
  const handleSaveAvailability = async (updated: TeacherAvailability[]) => {
    setAvailabilities(updated);
    setSaveSuccessMsg('Teacher weekly availability saved successfully!');
    setTimeout(() => {
      setSaveSuccessMsg(null);
    }, 4000);

    try {
      const supabase = createBrowserClient();
      if (supabase && typeof supabase.from === 'function') {
        const rowsToUpsert = updated.map((a) => ({
          teacher_id: DEFAULT_TEACHER_ID,
          day_of_week: a.day_of_week,
          start_time: a.start_time,
          end_time: a.end_time,
          slot_duration_minutes: a.slot_duration_minutes || 60,
        }));
        await supabase
          .from('teacher_availability')
          .upsert(rowsToUpsert, { onConflict: 'teacher_id,day_of_week' });
      }
    } catch (err) {
      console.warn('Failed to save teacher availability to Supabase:', err);
    }
  };

  // Generate instant room and add to active manager
  const handleGenerateInstantRoom = () => {
    const randomCode = Math.random().toString(36).substring(2, 8);
    const roomId = customRoomId.trim() || `room-${Date.now().toString(36)}-${randomCode}`;
    setGeneratedRoomId(roomId);

    createManagedRoom(roomId, 'instant', `Instant 1:1 Session (${roomId})`);
    refreshRoomsAndHistory();
  };

  // Launch instant room as teacher
  const handleJoinInstantRoom = (targetRoomId?: string) => {
    const roomId =
      targetRoomId || generatedRoomId || customRoomId.trim() || `room-${Date.now().toString(36)}`;
    
    // Ensure room is tracked and start 15m timer
    createManagedRoom(roomId, 'instant', `Instant 1:1 Session (${roomId})`);
    recordRoomJoin(roomId);
    refreshRoomsAndHistory();

    const teacherName = teacherSession?.teacherName || DEFAULT_TEACHER_NAME;
    router.push(`/classroom/${roomId}?role=teacher&name=${encodeURIComponent(teacherName)}`);
  };

  // Delete active room
  const handleDeleteActiveRoom = (roomId: string) => {
    deleteManagedRoom(roomId);
    refreshRoomsAndHistory();
  };

  // Launch past class with restored whiteboard
  const handleLaunchWithPastWhiteboard = (pastClass: PastClassRecord) => {
    // Re-create as managed room and route with restoreRoomId parameter
    createManagedRoom(pastClass.roomId, 'instant', `Resumed: ${pastClass.title}`);
    recordRoomJoin(pastClass.roomId);
    refreshRoomsAndHistory();

    const teacherName = teacherSession?.teacherName || DEFAULT_TEACHER_NAME;
    router.push(
      `/classroom/${pastClass.roomId}?role=teacher&name=${encodeURIComponent(teacherName)}&restoreRoomId=${encodeURIComponent(pastClass.roomId)}`
    );
  };

  // Delete past class record
  const handleDeletePastClass = (id: string) => {
    deletePastClass(id);
    setPastClasses(getPastClasses());
  };

  // Copy booking link to clipboard
  const handleCopyLink = async () => {
    const scheduleReset = () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      copyTimeoutRef.current = setTimeout(() => {
        copyTimeoutRef.current = null;
        setIsCopied(false);
      }, 2500);
    };

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(fullBookingUrl);
      }
      setIsCopied(true);
      scheduleReset();
    } catch {
      setIsCopied(true);
      scheduleReset();
    }
  };

  const handleTeacherLogout = () => {
    logoutTeacher();
    setTeacherSession(null);
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
                Injasraj
              </h1>
            </div>
            <p className="text-xs sm:text-sm text-zinc-400">
              Low-latency international 1:1 lessons • Base TZ: {TEACHER_TIMEZONE} (IST)
            </p>
          </div>
        </div>

        {/* Right side: Teacher Auth Status & Instant Class Quickbar */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto justify-end">
          {/* Teacher Login / Status Badge */}
          {teacherSession ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-stone-900 border border-stone-800">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="text-xs font-medium text-stone-200">
                {teacherSession.teacherName} (Teacher)
              </span>
              <button
                type="button"
                onClick={handleTeacherLogout}
                data-testid="teacher-logout-btn"
                title="Log out"
                className="text-stone-400 hover:text-stone-200 p-1 rounded transition-colors"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setIsLoginModalOpen(true)}
              data-testid="teacher-login-modal-trigger"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/30 transition-all cursor-pointer active:scale-95"
            >
              <Lock className="w-3.5 h-3.5" />
              <span>Teacher Login</span>
            </button>
          )}

          {teacherSession && (
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <div className="relative flex-1 sm:w-52">
                <input
                  type="text"
                  placeholder="Custom room ID (optional)"
                  value={customRoomId}
                  onChange={(e) => setCustomRoomId(e.target.value)}
                  className="w-full bg-zinc-900/90 border border-zinc-800/90 rounded-lg px-3 py-1.5 text-xs text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-indigo-500/70"
                />
              </div>

              <GlassButton
                variant="default"
                onClick={handleGenerateInstantRoom}
                data-testid="instant-room-btn"
                className="flex items-center space-x-1.5 text-xs py-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                <span>Create Link</span>
              </GlassButton>

              <GlassButton
                variant="primary"
                onClick={() => handleJoinInstantRoom()}
                data-testid="launch-room-btn"
                className="flex items-center space-x-1.5 text-xs py-1.5"
              >
                <Video className="w-3.5 h-3.5" />
                <span>Start Instant Class</span>
              </GlassButton>
            </div>
          )}
        </div>
      </header>

      {/* Public Student Portal (Shown when Teacher is not authenticated) */}
      {!teacherSession ? (
        <section
          data-testid="student-portal-section"
          aria-label="Student Portal"
          className="space-y-8 max-w-4xl mx-auto w-full py-8"
        >
          <div className="text-center space-y-2.5">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-100">
              Welcome to Injasraj
            </h2>
            <p className="text-sm text-zinc-400 max-w-xl mx-auto">
              Join a live interactive lesson with your room code, or book an upcoming 1:1 session across international timezones.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Join by Code Card */}
            <GlassCard className="p-6 space-y-4 border-indigo-500/30 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center">
                  <Video className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">Join a Live Class</h3>
                <p className="text-xs text-zinc-400">
                  Have a room code or link from your tutor? Enter it below to join the classroom directly.
                </p>
              </div>

              <form onSubmit={handleStudentJoinRoom} className="space-y-3 pt-2">
                <input
                  type="text"
                  data-testid="student-room-code-input"
                  placeholder="e.g. room-101 or code"
                  value={studentJoinRoomId}
                  onChange={(e) => setStudentJoinRoomId(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-xl px-3.5 py-2.5 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                />
                <GlassButton
                  type="submit"
                  variant="primary"
                  data-testid="student-join-room-btn"
                  className="w-full py-2.5 text-sm font-semibold flex items-center justify-center space-x-2"
                >
                  <Video className="w-4 h-4" />
                  <span>Enter Classroom</span>
                </GlassButton>
              </form>
            </GlassCard>

            {/* Book 1:1 Session Card */}
            <GlassCard className="p-6 space-y-4 border-emerald-500/30 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">Book 1:1 Lesson</h3>
                <p className="text-xs text-zinc-400">
                  View tutor availability converted into your local timezone and schedule an upcoming 1:1 session.
                </p>
              </div>

              <div className="pt-2">
                <Link href={bookingPath}>
                  <GlassButton
                    variant="default"
                    data-testid="student-book-portal-btn"
                    className="w-full py-2.5 text-sm font-semibold flex items-center justify-center space-x-2"
                  >
                    <span>View Calendar & Book</span>
                    <ExternalLink className="w-4 h-4" />
                  </GlassButton>
                </Link>
              </div>
            </GlassCard>
          </div>
        </section>
      ) : (
        /* Teacher Hub (Protected behind Teacher Passcode Login) */
        <>
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
                <GlassButton
                  variant="primary"
                  size="sm"
                  onClick={() => handleJoinInstantRoom(generatedRoomId)}
                  className="flex items-center space-x-1"
                >
                  <Video className="w-3.5 h-3.5" />
                  <span>Enter Room</span>
                </GlassButton>
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
          <div className="flex items-center space-x-2 border-b border-zinc-800/80 pb-2 overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveTab('active_links')}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'active_links'
                  ? 'bg-zinc-800/90 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Link2 className="w-4 h-4 text-emerald-400" />
              <span>Active Class Links</span>
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-emerald-500/20 text-emerald-300 font-mono">
                {activeRooms.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('past_classes')}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'past_classes'
                  ? 'bg-zinc-800/90 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <History className="w-4 h-4 text-amber-400" />
              <span>Past Classes</span>
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-zinc-700/60 text-zinc-300 font-mono">
                {pastClasses.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('lessons')}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'lessons'
                  ? 'bg-zinc-800/90 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Upcoming Lessons</span>
              <span className="ml-1.5 px-1.5 py-0.5 text-xs rounded-full bg-zinc-700/60 text-zinc-300 font-mono">
                {lessons.length}
              </span>
            </button>

            <button
              onClick={() => setActiveTab('availability')}
              className={`flex items-center space-x-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
                activeTab === 'availability'
                  ? 'bg-zinc-800/90 text-white shadow-sm'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-900/60'
              }`}
            >
              <Clock className="w-4 h-4" />
              <span>Weekly Availability</span>
            </button>
          </div>

          {/* Success Notification */}
          {saveSuccessMsg && (
            <div className="bg-emerald-950/30 border border-emerald-500/40 rounded-xl p-3 text-emerald-300 text-sm flex items-center space-x-2">
              <Check className="w-4 h-4 text-emerald-400" />
              <span>{saveSuccessMsg}</span>
            </div>
          )}

          {/* Tab: Active Class Links & Room Manager */}
          {activeTab === 'active_links' && (
            <section aria-label="Active Class Links Manager">
              <ActiveRoomsManager
                rooms={activeRooms}
                onDeleteRoom={handleDeleteActiveRoom}
                onJoinAsTeacher={handleJoinInstantRoom}
              />
            </section>
          )}

          {/* Tab: Past Classes & Whiteboard History */}
          {activeTab === 'past_classes' && (
            <section aria-label="Past Classes & Whiteboard Archives">
              <PastClassesManager
                pastClasses={pastClasses}
                onDeletePastClass={handleDeletePastClass}
                onLaunchWithWhiteboard={handleLaunchWithPastWhiteboard}
              />
            </section>
          )}

          {/* Tab: Weekly Availability Form */}
          {activeTab === 'availability' && (
            <section aria-label="Teacher Availability Management" className="space-y-4">
              <TeacherAvailabilityForm
                teacherId={DEFAULT_TEACHER_ID}
                initialAvailabilities={availabilities}
                onSave={handleSaveAvailability}
              />
            </section>
          )}

          {/* Tab: Upcoming Lessons List */}
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
                          <GlassButton
                            variant="primary"
                            size="sm"
                            onClick={() => handleJoinInstantRoom(lesson.room_id)}
                            className="flex items-center space-x-1.5"
                          >
                            <Video className="w-3.5 h-3.5" />
                            <span>Join Room</span>
                          </GlassButton>
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {/* Teacher Login Modal */}
      <TeacherLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(name) => {
          setTeacherSession(getTeacherSession());
        }}
      />
    </main>
  );
}
