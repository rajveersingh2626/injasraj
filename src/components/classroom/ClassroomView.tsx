'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { ClassroomWorkspace, WorkspaceMode } from './ClassroomWorkspace';
import { P2PWebRTCMediaSession } from '../../lib/webrtc/p2p-session';
import { LiveKitMediaSession } from '../../lib/webrtc/livekit-session';
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
import { StudentNameModal, STUDENT_NAME_STORAGE_KEY } from './StudentNameModal';
import { Participant } from '../whiteboard/tabs/PeopleTab';
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

  const [activeRole, setActiveRole] = useState<'teacher' | 'student'>(role);
  const [resolvedStudentName, setResolvedStudentName] = useState<string>(() => {
    if (userName && userName.trim() !== '') return userName.trim();
    return '';
  });
  const [isNameModalOpen, setIsNameModalOpen] = useState<boolean>(false);
  const [remoteParticipants, setRemoteParticipants] = useState<Participant[]>([]);
  const [isRoomExpired, setIsRoomExpired] = useState<boolean>(false);

  // Client-side hydration sync for storage-based auth and user profile
  useEffect(() => {
    const resolved = resolveUserClassroomRole(role);
    setActiveRole(resolved);

    if (resolved === 'student') {
      try {
        const stored = localStorage.getItem(STUDENT_NAME_STORAGE_KEY);
        if (stored && stored.trim() !== '') {
          setResolvedStudentName(stored.trim());
        } else if (!userName || userName.trim() === '') {
          setIsNameModalOpen(true);
        }
      } catch {
        if (!userName || userName.trim() === '') {
          setIsNameModalOpen(true);
        }
      }
    }
  }, [role, userName]);

  // Track room join & stamp 15m instant timer on direct entry
  useEffect(() => {
    const joined = recordRoomJoin(roomId);
    if (joined?.status === 'expired') {
      setIsRoomExpired(true);
    }
  }, [roomId]);

  const teacherSession = getTeacherSession();
  const localName: string =
    userName ||
    (activeRole === 'teacher'
      ? teacherSession?.teacherName || 'Teacher'
      : resolvedStudentName || 'Student');

  // Persistent User ID for this session
  const userIdRef = useRef<string>(
    propUserId || `peer_${activeRole}_${Math.random().toString(36).substring(2, 9)}`
  );
  const userId = userIdRef.current;

  // Instantiate or reuse WebRTC / LiveKit media session
  const internalMediaSession = useMemo(() => {
    if (injectedMediaSession) return injectedMediaSession;

    // Primary: Always use LiveKit Cloud SFU in browser for reliable multi-party video
    if (typeof window !== 'undefined') {
      try {
        return new LiveKitMediaSession();
      } catch (err) {
        console.warn('LiveKit init fallback to P2P:', err);
      }
    }

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
      // Connect signaling & WebRTC / LiveKit
      try {
        if (activeMediaSession instanceof LiveKitMediaSession) {
          const origin =
            typeof window !== 'undefined' && window.location?.origin
              ? window.location.origin
              : 'http://localhost:3000';
          const tokenUrl = `${origin}/api/livekit/token?room=${encodeURIComponent(roomId)}&username=${encodeURIComponent(
            localName || userId
          )}&role=${activeRole}`;
          const res = await fetch(tokenUrl);
          if (res.ok) {
            const data = await res.json();
            await (activeMediaSession as any).connect(roomId, data.token, data.url);
          }
        } else if (typeof activeMediaSession.connect === 'function') {
          await activeMediaSession.connect(roomId, userId);
        }
      } catch (err) {
        console.warn('WebRTC/LiveKit session connect notice:', err);
      }

      // Wire LiveKit participant changes to classroom state
      if (typeof (activeMediaSession as any).onParticipantsChange === 'function') {
        (activeMediaSession as any).onParticipantsChange((lkParticipants: any[]) => {
          if (!isCancelled && Array.isArray(lkParticipants) && lkParticipants.length > 0) {
            setRemoteParticipants((prev) => {
              const updated = [...prev];
              lkParticipants.forEach((p) => {
                if (p.id !== userId && !updated.some((u) => u.id === p.id)) {
                  updated.push({
                    id: p.id,
                    name: p.name || 'Participant',
                    role: p.role || 'student',
                    isMicOn: p.isMicOn ?? true,
                    isCameraOn: p.isCameraOn ?? true,
                    isSelf: false,
                    isDrawingAllowed: p.role === 'teacher',
                  });
                }
              });
              return updated;
            });
          }
        });
      }

      // Check if LiveKit already acquired a local stream
      if (typeof (activeMediaSession as any).getLocalStream === 'function') {
        const lkStream = (activeMediaSession as any).getLocalStream();
        if (lkStream && !isCancelled) {
          setLocalStream(lkStream);
        }
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
            setLocalStream((curr) => curr || stream);
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

  // Broadcast and listen to participant presence across all students and teacher
  useEffect(() => {
    if (!activeWhiteboardAdapter) return;

    const unsubscribe = activeWhiteboardAdapter.onCustomEvent(
      'participant-presence',
      (payload: any) => {
        if (!payload?.id || payload.id === userId) return;

        if (payload.action === 'leave' || payload.isOnline === false) {
          setRemoteParticipants((prev) => prev.filter((p) => p.id !== payload.id));
          return;
        }

        setRemoteParticipants((prev) => {
          const exists = prev.find((p) => p.id === payload.id);
          const updated: Participant = {
            id: payload.id,
            name: payload.name || (payload.role === 'teacher' ? 'Teacher' : 'Student'),
            role: payload.role || 'student',
            isMicOn: !payload.isAudioMuted,
            isCameraOn: !payload.isVideoOff,
            isDrawingAllowed: Boolean(payload.hasDrawingPermission),
          };
          if (exists) {
            return prev.map((p) => (p.id === payload.id ? updated : p));
          }
          return [...prev, updated];
        });

        // Acknowledge new arrivals
        if (payload.action === 'join') {
          activeWhiteboardAdapter
            .broadcastCustomEvent('participant-presence', {
              id: userId,
              name: localName,
              role: activeRole,
              isOnline: true,
              action: 'acknowledge',
            })
            .catch(() => {});
        }
      }
    );

    // Broadcast our presence on join
    activeWhiteboardAdapter
      .broadcastCustomEvent('participant-presence', {
        id: userId,
        name: localName,
        role: activeRole,
        isOnline: true,
        action: 'join',
      })
      .catch(() => {});

    return () => {
      unsubscribe();
      activeWhiteboardAdapter
        .broadcastCustomEvent('participant-presence', {
          id: userId,
          name: localName,
          role: activeRole,
          isOnline: false,
          action: 'leave',
        })
        .catch(() => {});
    };
  }, [activeWhiteboardAdapter, userId, localName, activeRole]);

  // Combined participant list
  const allParticipants: Participant[] = useMemo(() => {
    const localParticipant: Participant = {
      id: userId,
      name: localName,
      role: activeRole,
      isMicOn: true,
      isCameraOn: true,
      isSelf: true,
      isDrawingAllowed: activeRole === 'teacher',
    };
    return [localParticipant, ...remoteParticipants];
  }, [userId, localName, activeRole, remoteParticipants]);

  return (
    <main
      data-testid="classroom-page"
      className="relative w-full h-[100dvh] bg-zinc-950 overflow-hidden select-none"
      style={{ overscrollBehavior: 'none' }}
    >
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
          participants={allParticipants}
          className="w-full h-full"
        />
      </div>

      <StudentNameModal
        isOpen={isNameModalOpen}
        initialName={resolvedStudentName}
        onJoin={(name) => {
          setResolvedStudentName(name);
          setIsNameModalOpen(false);
        }}
      />
    </main>
  );
}
