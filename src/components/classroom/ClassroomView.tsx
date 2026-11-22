'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ClassroomWorkspace, WorkspaceMode } from './ClassroomWorkspace';
import { P2PWebRTCMediaSession } from '../../lib/webrtc/p2p-session';
import { SupabaseSignalingAdapter } from '../../lib/signaling/supabase-signaling';
import {
  WhiteboardRealtimeAdapter,
  createWhiteboardChannel,
} from '../../lib/whiteboard/whiteboard-signaling';
import {
  DebouncedPersistenceManager,
  saveWhiteboardSession,
  loadWhiteboardSession,
  WhiteboardSessionRecord,
} from '../../lib/whiteboard/whiteboard-persistence';
import { createBrowserClient } from '../../lib/supabase/client';
import { IMediaSession } from '../../types/media';
import { WhiteboardPermissions, WhiteboardPage } from '../../types/whiteboard';
import {
  resolveUserClassroomRole,
  getTeacherSession,
} from '../../lib/auth/teacher-auth';
import { recordRoomJoin, getRoomById } from '../../lib/classroom/room-manager';
import { TeacherLoginModal } from '../auth/TeacherLoginModal';
import { Lock, LogIn, AlertOctagon, ArrowLeft } from 'lucide-react';

export interface ClassroomViewProps {
  roomId?: string;
  role?: 'teacher' | 'student';
  userName?: string;
  userId?: string;
  mediaSession?: IMediaSession;
  whiteboardAdapter?: WhiteboardRealtimeAdapter;
  persistenceManager?: DebouncedPersistenceManager;
  supabaseClient?: any;
  onLeave?: () => void;
  initialPermissions?: WhiteboardPermissions;
  initialPages?: WhiteboardPage[];
  initialMode?: WorkspaceMode;
  onModeChange?: (mode: WorkspaceMode) => void;
  onSave?: (session: WhiteboardSessionRecord) => void;
  onLoadWorksheet?: (fileOrUrl: File | string) => void;
  restoreRoomId?: string;
}

export function ClassroomView({
  roomId = 'default-room',
  role = 'student',
  userName,
  userId: propUserId,
  mediaSession: injectedMediaSession,
  whiteboardAdapter: injectedWhiteboardAdapter,
  persistenceManager: injectedPersistenceManager,
  supabaseClient: injectedSupabaseClient,
  onLeave: propOnLeave,
  initialPermissions: propInitialPermissions,
  initialPages: propInitialPages,
  initialMode,
  onModeChange,
  onSave,
  onLoadWorksheet,
  restoreRoomId,
}: ClassroomViewProps) {
  const router = useRouter();

  const [activeRole, setActiveRole] = useState<'teacher' | 'student'>(() =>
    resolveUserClassroomRole(role)
  );
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  const [isRoomExpired, setIsRoomExpired] = useState<boolean>(() => {
    const existing = getRoomById(roomId);
    return existing?.status === 'expired';
  });

  // Track room join & stamp 15m instant timer on direct entry
  useEffect(() => {
    const joined = recordRoomJoin(roomId);
    if (joined?.status === 'expired') {
      setIsRoomExpired(true);
    }
  }, [roomId]);

  // Sync role if prop or auth changes
  useEffect(() => {
    setActiveRole(resolveUserClassroomRole(role));
  }, [role]);

  const teacherSession = getTeacherSession();
  const localName: string =
    userName ||
    (activeRole === 'teacher'
      ? teacherSession?.teacherName || 'Teacher'
      : 'Student');

  // Persistent User ID for this session
  const userIdRef = useRef<string>(
    propUserId || `peer_${activeRole}_${Math.random().toString(36).substring(2, 9)}`
  );
  const userId = userIdRef.current;

  // Instantiate or reuse WebRTC media session with correct polite peer role
  const internalMediaSession = useMemo(() => {
    if (injectedMediaSession) return injectedMediaSession;

    const signaling = new SupabaseSignalingAdapter(undefined, userId);
    const polite = activeRole !== 'teacher';
    return new P2PWebRTCMediaSession(signaling, { polite });
  }, [injectedMediaSession, activeRole, userId]);

  const activeMediaSession = injectedMediaSession || internalMediaSession;

  // Instantiate or reuse Realtime Whiteboard Broadcast Adapter
  const internalWhiteboardAdapter = useMemo(() => {
    if (injectedWhiteboardAdapter) return injectedWhiteboardAdapter;
    try {
      const client = injectedSupabaseClient || createBrowserClient();
      const channel = createWhiteboardChannel(client, roomId);
      return new WhiteboardRealtimeAdapter(channel, userId);
    } catch (err) {
      console.warn('Whiteboard Realtime adapter initialization notice:', err);
      return null;
    }
  }, [injectedWhiteboardAdapter, injectedSupabaseClient, roomId, userId]);

  const activeWhiteboardAdapter =
    injectedWhiteboardAdapter || internalWhiteboardAdapter;

  // Instantiate or reuse Debounced Postgres Persistence Manager
  const internalPersistenceManager = useMemo(() => {
    if (injectedPersistenceManager) return injectedPersistenceManager;
    try {
      const client = injectedSupabaseClient || createBrowserClient();
      return new DebouncedPersistenceManager(async (sessionData) => {
        return await saveWhiteboardSession(client, sessionData);
      }, 3000);
    } catch (err) {
      console.warn('Persistence manager initialization notice:', err);
      return null;
    }
  }, [injectedPersistenceManager, injectedSupabaseClient]);

  const activePersistenceManager =
    injectedPersistenceManager || internalPersistenceManager;

  // Local media stream state
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  // Whiteboard initial loaded state
  const [loadedPages, setLoadedPages] = useState<WhiteboardPage[] | undefined>(
    propInitialPages
  );
  const [loadedPermissions, setLoadedPermissions] = useState<
    WhiteboardPermissions | undefined
  >(propInitialPermissions);

  // Subscribe to Realtime Whiteboard Broadcast Channel
  useEffect(() => {
    if (!activeWhiteboardAdapter) return;
    activeWhiteboardAdapter.subscribe();
    return () => {
      activeWhiteboardAdapter.disconnect();
    };
  }, [activeWhiteboardAdapter]);

  // Load existing whiteboard session from Supabase Postgres on initial mount
  useEffect(() => {
    let isCancelled = false;
    const loadSession = async () => {
      try {
        const client = injectedSupabaseClient || createBrowserClient();
        const session = await loadWhiteboardSession(client, roomId);
        if (session && !isCancelled) {
          if (session.pages && session.pages.length > 0) {
            setLoadedPages(session.pages);
          }
          if (session.permissions) {
            setLoadedPermissions(session.permissions);
          }
        }
      } catch (err) {
        console.warn('Failed to load initial whiteboard session:', err);
      }
    };

    loadSession();
    return () => {
      isCancelled = true;
    };
  }, [roomId, injectedSupabaseClient]);

  // Connect media session on mount
  useEffect(() => {
    let isCancelled = false;

    const connectSession = async () => {
      // Connect signaling & WebRTC
      try {
        if (typeof activeMediaSession.connect === 'function') {
          await activeMediaSession.connect(roomId, userId);
        }
      } catch (err) {
        console.warn('WebRTC session connect notice:', err);
      }

      // Try acquiring local media if available in browser
      if (
        typeof navigator !== 'undefined' &&
        navigator.mediaDevices?.getUserMedia
      ) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: true,
            video: true,
          });
          if (!isCancelled) {
            setLocalStream(stream);
            const audioTrack = stream.getAudioTracks()[0];
            const videoTrack = stream.getVideoTracks()[0];
            if (typeof activeMediaSession.publishLocalMedia === 'function') {
              await activeMediaSession.publishLocalMedia(audioTrack, videoTrack);
            }
          }
        } catch (mediaErr) {
          console.warn('Local media access unavailable:', mediaErr);
        }
      }
    };

    connectSession();

    return () => {
      isCancelled = true;
      if (typeof activeMediaSession.disconnect === 'function') {
        activeMediaSession.disconnect();
      }
    };
  }, [activeMediaSession, roomId, userId]);

  // Handle leaving the classroom
  const handleLeave = () => {
    activePersistenceManager?.flush().catch(() => {});
    propOnLeave?.();
    if (typeof activeMediaSession.disconnect === 'function') {
      activeMediaSession.disconnect();
    }
    if (activeWhiteboardAdapter) {
      activeWhiteboardAdapter.disconnect();
    }
    if (router?.push) {
      router.push('/');
    } else if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  };

  if (isRoomExpired) {
    return (
      <main
        data-testid="classroom-expired-page"
        className="relative flex flex-col items-center justify-center w-full h-[100dvh] bg-zinc-950 text-white p-6 select-none"
      >
        <div className="max-w-md w-full bg-stone-900/90 border border-red-500/30 rounded-2xl p-6 text-center shadow-2xl backdrop-blur-xl">
          <div className="w-12 h-12 rounded-full bg-red-500/10 text-red-400 flex items-center justify-center mx-auto mb-4 border border-red-500/20">
            <Lock className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold tracking-tight mb-2">Classroom Session Expired</h2>
          <p className="text-sm text-stone-400 mb-6">
            This classroom link has expired (15-minute time limit exceeded) or was revoked by the teacher.
          </p>
          <button
            type="button"
            onClick={handleLeave}
            className="w-full py-2.5 px-4 rounded-xl bg-amber-500 hover:bg-amber-400 text-stone-950 font-semibold text-sm transition-all shadow-md active:scale-95 cursor-pointer"
          >
            Return to Dashboard
          </button>
        </div>
      </main>
    );
  }

  return (
    <main
      data-testid="classroom-page"
      className="relative w-full h-[100dvh] bg-zinc-950 overflow-hidden select-none"
      style={{ overscrollBehavior: 'none' }}
    >
      {/* Floating Teacher Login Pill if user is in student view */}
      {activeRole === 'student' && (
        <div className="absolute top-3.5 right-4 z-40 flex items-center">
          <button
            type="button"
            data-testid="teacher-login-trigger-btn"
            onClick={() => setIsLoginModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-stone-900/90 hover:bg-stone-800 text-amber-400 border border-amber-500/30 backdrop-blur-md shadow-lg transition-all active:scale-95 cursor-pointer"
            title="Log in with Teacher Passcode"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Teacher Login</span>
          </button>
        </div>
      )}

      <div data-testid="classroom-container" className="w-full h-full">
        <ClassroomWorkspace
          roomId={roomId}
          role={activeRole}
          userName={localName}
          userId={userId}
          mediaSession={activeMediaSession}
          whiteboardAdapter={activeWhiteboardAdapter || undefined}
          persistenceManager={activePersistenceManager || undefined}
          localStream={localStream}
          initialPermissions={loadedPermissions || propInitialPermissions}
          initialPages={loadedPages || propInitialPages}
          initialMode={initialMode}
          onModeChange={onModeChange}
          onLeave={handleLeave}
          onSave={onSave}
          onLoadWorksheet={onLoadWorksheet}
          restoreRoomId={restoreRoomId}
          className="w-full h-full"
        />
      </div>

      <TeacherLoginModal
        isOpen={isLoginModalOpen}
        onClose={() => setIsLoginModalOpen(false)}
        onLoginSuccess={(name) => {
          setActiveRole('teacher');
        }}
      />
    </main>
  );
}
