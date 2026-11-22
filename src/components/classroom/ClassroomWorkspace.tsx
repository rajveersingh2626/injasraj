'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Presentation,
  LayoutGrid,
  Sidebar,
  Timer as TimerIcon,
  Play,
  Square,
  Clock,
  Video as VideoIcon,
} from 'lucide-react';
import {
  IMediaSession,
  ConnectionQuality,
  createDefaultQuality,
  TimerState,
  ClassSessionStatus,
} from '../../types/media';
import {
  WhiteboardPermissions,
  WhiteboardPage,
  WhiteboardToolType,
  defaultWhiteboardPermissions,
  createDefaultWhiteboardPage,
} from '../../types/whiteboard';
import { VideoCard } from './VideoCard';
import { ControlBar } from './ControlBar';
import { ClassroomTimerWidget } from './ClassroomTimerWidget';
import { EndClassSummaryModal, formatDuration } from './EndClassSummaryModal';
import { ClassroomVideoSync, VideoSyncState } from './ClassroomVideoSync';
import {
  RewardCelebrationOverlay,
  RewardEvent,
  RewardType,
} from './RewardCelebrationOverlay';
import { WhiteboardStage } from '../whiteboard/WhiteboardStage';
import { BrowserTabBar } from '../whiteboard/BrowserTabBar';
import { StudioSidePanel } from '../whiteboard/StudioSidePanel';
import { WhiteboardPageManager } from '../../lib/whiteboard/page-manager';
import { WhiteboardRealtimeAdapter } from '../../lib/whiteboard/whiteboard-signaling';
import {
  DebouncedPersistenceManager,
  serializeWhiteboardSession,
  WhiteboardSessionRecord,
} from '../../lib/whiteboard/whiteboard-persistence';
import { FabricWhiteboardEngine } from '../../lib/whiteboard/fabric-engine';
import { LaserTrailEngine } from '../../lib/whiteboard/laser-trail';
import { UserUndoRedoStack } from '../../lib/whiteboard/undo-redo-stack';
import {
  renderPdfPageToDataUrl,
  convertPdfToPageImages,
  downloadMultiPagePdf,
} from '../../lib/whiteboard/pdf-renderer';
import { PdfSubPageNavigator } from '../whiteboard/PdfSubPageNavigator';
import { WorksheetMaterial } from '../whiteboard/tabs/MaterialsTab';
import { Participant } from '../whiteboard/tabs/PeopleTab';
import { ChatMessage } from '../whiteboard/tabs/ChatTab';
import { GridPatternType } from '../whiteboard/tabs/ToolsTab';
import {
  archiveClassToHistory,
  getPastClasses,
  getPastClassWhiteboard,
  PastClassRecord,
} from '../../lib/classroom/past-classes';

export type WorkspaceMode = 'classroom' | 'whiteboard';

export interface ClassroomWorkspaceProps {
  roomId?: string;
  role?: 'teacher' | 'student';
  userName?: string;
  userId?: string;
  mediaSession?: IMediaSession;
  whiteboardAdapter?: WhiteboardRealtimeAdapter;
  persistenceManager?: DebouncedPersistenceManager;
  initialMode?: WorkspaceMode;
  onModeChange?: (mode: WorkspaceMode) => void;
  localStream?: MediaStream | null;
  remoteStream?: MediaStream | null;
  initialQuality?: ConnectionQuality;
  audioDevices?: MediaDeviceInfo[];
  videoDevices?: MediaDeviceInfo[];
  onLeave?: () => void;
  initialPermissions?: WhiteboardPermissions;
  onPermissionsChange?: (permissions: WhiteboardPermissions) => void;
  initialPages?: WhiteboardPage[];
  onPagesChange?: (pages: WhiteboardPage[]) => void;
  onPageChange?: (pageIndex: number, pageId: string) => void;
  onEngineReady?: (engine: FabricWhiteboardEngine) => void;
  onLoadWorksheet?: (fileOrUrl: File | string) => void;
  worksheets?: WorksheetMaterial[];
  onSave?: (session: WhiteboardSessionRecord) => void;
  participants?: Participant[];
  initialSidePanelCollapsed?: boolean;
  restoreRoomId?: string;
  className?: string;
}

export const ClassroomWorkspace: React.FC<ClassroomWorkspaceProps> = ({
  roomId = 'room-1',
  role = 'teacher',
  userName,
  userId = `user_${role}_${Math.random().toString(36).substring(2, 7)}`,
  mediaSession,
  whiteboardAdapter,
  persistenceManager,
  initialMode = 'classroom',
  onModeChange,
  localStream: propLocalStream,
  remoteStream: propRemoteStream,
  initialQuality,
  audioDevices: propAudioDevices,
  videoDevices: propVideoDevices,
  onLeave,
  initialPermissions,
  onPermissionsChange: propOnPermissionsChange,
  initialPages,
  onPagesChange: propOnPagesChange,
  onPageChange: propOnPageChange,
  onEngineReady: propOnEngineReady,
  onLoadWorksheet: propOnLoadWorksheet,
  worksheets,
  onSave,
  participants: propParticipants,
  initialSidePanelCollapsed = false,
  restoreRoomId,
  className = '',
}) => {
  // Mode State: 'classroom' (balanced grid) vs 'whiteboard' (maximized canvas)
  const [mode, setMode] = useState<WorkspaceMode>(initialMode);

  // Participant Names & Badges
  const localName = userName || (role === 'teacher' ? 'Teacher' : 'Student');
  const remoteName = role === 'teacher' ? 'Student' : 'Teacher';
  const localRoleBadge = role === 'teacher' ? 'Teacher' : 'Student';
  const remoteRoleBadge = role === 'teacher' ? 'Student' : 'Teacher';

  // Media Streams & Devices State
  const [localStream, setLocalStream] = useState<MediaStream | null>(
    propLocalStream || null
  );
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(
    propRemoteStream || null
  );
  const [quality, setQuality] = useState<ConnectionQuality>(
    initialQuality || createDefaultQuality()
  );

  const [isMicMuted, setIsMicMuted] = useState(false);
  const [isCameraOff, setIsCameraOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteAudioMuted] = useState(false);
  const [isRemoteCameraOff] = useState(false);

  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>(
    propAudioDevices || []
  );
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>(
    propVideoDevices || []
  );
  const [selectedAudioDeviceId, setSelectedAudioDeviceId] = useState<string>('');
  const [selectedVideoDeviceId, setSelectedVideoDeviceId] = useState<string>('');

  // Side Panel State
  const [isSidePanelCollapsed, setIsSidePanelCollapsed] = useState<boolean>(
    initialSidePanelCollapsed
  );

  // Canvas Engine, Laser, & Realtime Delta Guards
  const isApplyingRemoteDeltaRef = useRef<boolean>(false);
  const engineRef = useRef<FabricWhiteboardEngine | null>(null);
  const laserEngineRef = useRef<LaserTrailEngine>(new LaserTrailEngine(1200));

  // User-scoped Undo/Redo Engine
  const undoRedoStackRef = useRef<UserUndoRedoStack>(new UserUndoRedoStack());
  const isExecutingUndoRedoRef = useRef<boolean>(false);
  const [canUndo, setCanUndo] = useState<boolean>(false);
  const [canRedo, setCanRedo] = useState<boolean>(false);

  // Background Canvas Grid Pattern State
  const [currentGrid, setCurrentGrid] = useState<GridPatternType>('blank');
  const [activeTool, setActiveTool] = useState<WhiteboardToolType>('pen');

  // Classroom Timer HUD State
  const [isTimerOpen, setIsTimerOpen] = useState<boolean>(false);
  const [remoteTimerState, setRemoteTimerState] = useState<TimerState | undefined>(undefined);
  const [pastClasses, setPastClasses] = useState<PastClassRecord[]>(() => getPastClasses());

  // Session Lifecycle State
  const [sessionStatus, setSessionStatus] = useState<ClassSessionStatus>('waiting');
  const [lessonDurationSeconds, setLessonDurationSeconds] = useState<number>(0);
  const [starsAwarded, setStarsAwarded] = useState<number>(0);
  const [isEndClassModalOpen, setIsEndClassModalOpen] = useState<boolean>(false);

  // Synchronized Lesson Video State
  const [isVideoSyncOpen, setIsVideoSyncOpen] = useState<boolean>(false);
  const [remoteVideoState, setRemoteVideoState] = useState<VideoSyncState | undefined>(undefined);

  useEffect(() => {
    if (sessionStatus !== 'in_progress') return;
    const interval = setInterval(() => {
      setLessonDurationSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStatus]);

  const handleStartClass = () => {
    setSessionStatus('in_progress');
    whiteboardAdapter?.broadcastCustomEvent?.('session-status-update', { status: 'in_progress' });
  };

  const handleEndClass = () => {
    setSessionStatus('completed');
    setIsEndClassModalOpen(true);
    whiteboardAdapter?.broadcastCustomEvent?.('session-status-update', { status: 'completed' });

    // Save full snapshot to Past Classes record
    try {
      const activeId = pageManagerRef.current.getActivePageId();
      if (engineRef.current) {
        pageManagerRef.current.updatePageCanvas(activeId, engineRef.current.exportJson());
      }
      const allPages = pageManagerRef.current.getAllPages();
      const snapshot = serializeWhiteboardSession(roomId, allPages, activeId, permissions);
      archiveClassToHistory(roomId, `Classroom Session (${roomId})`, lessonDurationSeconds, snapshot);
    } catch (err) {
      console.warn('Failed to archive class to past classes:', err);
    }
  };

  // Student Reward Celebration Overlay State
  const [activeReward, setActiveReward] = useState<RewardEvent | null>(null);

  const handleTriggerReward = (type: RewardType = 'star') => {
    const reward: RewardEvent = {
      id: `reward-${Date.now()}`,
      type,
      teacherName: localName || 'Teacher',
      message: type === 'star' ? 'Star Awarded! Outstanding!' : 'Great Work!',
      timestamp: Date.now(),
    };
    setActiveReward(reward);
    setStarsAwarded((prev) => prev + 1);
    whiteboardAdapter?.broadcastCustomEvent?.('student-reward', reward);
  };

  // Follow-Teacher Viewport Synchronization State
  const [isFollowTeacherEnabled, setIsFollowTeacherEnabled] = useState<boolean>(false);
  const [remoteViewport, setRemoteViewport] = useState<{ zoom: number; panX: number; panY: number } | undefined>(undefined);

  // Whiteboard Pages & Navigation
  const defaultInitialPages = useMemo(
    () =>
      initialPages && initialPages.length > 0
        ? initialPages
        : [
            createDefaultWhiteboardPage('page-1', 1, 'Lesson Intro'),
            createDefaultWhiteboardPage('page-2', 2, 'Worksheet Exercises'),
          ],
    [initialPages]
  );

  const pageManagerRef = useRef<WhiteboardPageManager>(
    new WhiteboardPageManager(defaultInitialPages)
  );
  const [pages, setPages] = useState<WhiteboardPage[]>(() =>
    pageManagerRef.current.getAllPages()
  );
  const [currentPageIndex, setCurrentPageIndex] = useState<number>(1);

  // Authoritative Permissions
  const [permissions, setPermissions] = useState<WhiteboardPermissions>(() =>
    initialPermissions || { ...defaultWhiteboardPermissions(), isLockedGlobally: false }
  );

  // Sync prop changes for initialPermissions and initialPages
  useEffect(() => {
    if (initialPermissions) {
      setPermissions(initialPermissions);
    }
  }, [initialPermissions]);

  useEffect(() => {
    if (initialPages && initialPages.length > 0) {
      pageManagerRef.current = new WhiteboardPageManager(initialPages);
      setPages(pageManagerRef.current.getAllPages());
      setCurrentPageIndex(pageManagerRef.current.getActivePageIndex() + 1);

      if (engineRef.current) {
        const activePage = pageManagerRef.current.getActivePage();
        if (activePage) {
          if (activePage.canvasJson) {
            engineRef.current.loadJson(activePage.canvasJson).catch(() => {});
          }
          if (activePage.thumbnailUrl) {
            engineRef.current.setBackgroundImage(activePage.thumbnailUrl).catch(() => {});
          }
        }
      }
    }
  }, [initialPages]);

  // Persistence Helper
  const schedulePersist = useCallback(
    (updatedPermissions?: WhiteboardPermissions) => {
      if (!persistenceManager) return;
      const currentPerms = updatedPermissions || permissions;
      const activeId = pageManagerRef.current.getActivePageId();
      const currentPages = pageManagerRef.current.getAllPages();
      const sessionRecord = serializeWhiteboardSession(
        roomId,
        currentPages,
        activeId,
        currentPerms
      );
      persistenceManager.scheduleSave(sessionRecord);
      onSave?.(sessionRecord);
    },
    [persistenceManager, permissions, roomId, onSave]
  );

  // Subscribe to real-time adapter deltas
  useEffect(() => {
    if (!whiteboardAdapter) return;

    const unsubscribe = whiteboardAdapter.onDelta((delta) => {
      if (delta.type === 'object-added') {
        const activeId = pageManagerRef.current.getActivePageId();
        if (delta.pageId === activeId && engineRef.current && delta.objectJson) {
          isApplyingRemoteDeltaRef.current = true;
          try {
            if (!engineRef.current.getObjectById(delta.objectJson.id)) {
              engineRef.current.addObject(delta.objectJson);
            }
          } finally {
            isApplyingRemoteDeltaRef.current = false;
          }
        }
      } else if (delta.type === 'object-modified') {
        const activeId = pageManagerRef.current.getActivePageId();
        if (delta.pageId === activeId && engineRef.current && delta.objectId) {
          isApplyingRemoteDeltaRef.current = true;
          try {
            if (
              delta.objectId === '__page_background__' &&
              delta.properties?.backgroundImageUrl
            ) {
              engineRef.current.setBackgroundImage(delta.properties.backgroundImageUrl);
              pageManagerRef.current.updatePageBackground(
                activeId,
                delta.properties.backgroundPdfUrl,
                1,
                delta.properties.backgroundImageUrl
              );
              setPages(pageManagerRef.current.getAllPages());
            } else {
              engineRef.current.modifyObject(delta.objectId, delta.properties);
            }
          } finally {
            isApplyingRemoteDeltaRef.current = false;
          }
        }
      } else if (delta.type === 'object-removed') {
        const activeId = pageManagerRef.current.getActivePageId();
        if (delta.pageId === activeId && engineRef.current && delta.objectId) {
          isApplyingRemoteDeltaRef.current = true;
          try {
            engineRef.current.removeObject(delta.objectId);
          } finally {
            isApplyingRemoteDeltaRef.current = false;
          }
        }
      } else if (delta.type === 'laser-move') {
        if (delta.laserPoint) {
          laserEngineRef.current.addPoint(delta.laserPoint.x, delta.laserPoint.y);
        }
      } else if (delta.type === 'page-switch') {
        if (delta.pageId) {
          pageManagerRef.current.setActivePage(delta.pageId);
          const idx = pageManagerRef.current.getActivePageIndex();
          setCurrentPageIndex(idx + 1);
          const target = pageManagerRef.current.getActivePage();
          if (engineRef.current && target) {
            if (target.canvasJson) {
              engineRef.current.loadJson(target.canvasJson);
            }
            if (target.thumbnailUrl) {
              engineRef.current.setBackgroundImage(target.thumbnailUrl).catch(() => {});
            }
          }
        }
      } else if (delta.type === 'permissions-update') {
        if (delta.permissions) {
          setPermissions(delta.permissions);
          propOnPermissionsChange?.(delta.permissions);
        }
      } else if (delta.type === 'page-added') {
        if (delta.pageId && !pageManagerRef.current.getPageById(delta.pageId)) {
          pageManagerRef.current.addPage(delta.properties?.title);
          setPages(pageManagerRef.current.getAllPages());
          propOnPagesChange?.(pageManagerRef.current.getAllPages());
        }
      } else if (delta.type === 'page-deleted') {
        if (delta.pageId) {
          pageManagerRef.current.deletePage(delta.pageId);
          setPages(pageManagerRef.current.getAllPages());
          setCurrentPageIndex(pageManagerRef.current.getActivePageIndex() + 1);
          propOnPagesChange?.(pageManagerRef.current.getAllPages());
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [whiteboardAdapter, propOnPermissionsChange, propOnPagesChange]);

  // Subscribe to real-time adapter custom events (rewards, timer, lifecycle, viewport)
  useEffect(() => {
    if (!whiteboardAdapter || typeof (whiteboardAdapter as any).onCustomEvent !== 'function') return;
    const unsubscribe = (whiteboardAdapter as any).onCustomEvent((eventName: string, payload: any) => {
      if (eventName === 'student-reward') {
        setActiveReward(payload);
        setStarsAwarded((prev) => prev + 1);
      } else if (eventName === 'timer-state') {
        setRemoteTimerState(payload);
      } else if (eventName === 'viewport-change') {
        setRemoteViewport(payload);
      } else if (eventName === 'session-status-update') {
        if (payload?.status) {
          setSessionStatus(payload.status);
          if (payload.status === 'completed') {
            setIsEndClassModalOpen(true);
          }
        }
      } else if (eventName === 'video-sync-state') {
        setRemoteVideoState(payload);
        if (payload?.url) {
          setIsVideoSyncOpen(true);
        }
      } else if (eventName === 'restore-whiteboard-session') {
        if (payload?.pages && Array.isArray(payload.pages)) {
          pageManagerRef.current = new WhiteboardPageManager(payload.pages);
          setPages([...payload.pages]);
          const target = pageManagerRef.current.getPageById(payload.activePageId) || payload.pages[0];
          if (target) {
            pageManagerRef.current.setActivePage(target.id);
            const idx = pageManagerRef.current.getActivePageIndex();
            setCurrentPageIndex(idx + 1);
            if (engineRef.current) {
              if (target.canvasJson) {
                engineRef.current.loadJson(target.canvasJson);
              } else {
                engineRef.current.clearCurrentPage(true);
              }
              const bgUrl = target.backgroundImageUrl || target.thumbnailUrl;
              if (bgUrl) {
                engineRef.current.setBackgroundImage(bgUrl).catch(() => {});
              } else {
                engineRef.current.clearBackgroundImage();
              }
            }
          }
        }
      }
    });
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, [whiteboardAdapter]);

  // Whiteboard Restoration Handler from Past Classes
  const handleRestoreWhiteboard = useCallback(
    (pastClass: PastClassRecord) => {
      const snapshot = pastClass.whiteboardSnapshot;
      if (!snapshot || !snapshot.pages || snapshot.pages.length === 0) return;

      pageManagerRef.current = new WhiteboardPageManager(snapshot.pages);
      setPages([...snapshot.pages]);
      const initialIdx = snapshot.pages.findIndex((p) => p.id === snapshot.active_page_id);
      const targetIdx = initialIdx >= 0 ? initialIdx : 0;
      setCurrentPageIndex(targetIdx + 1);

      const activePage = snapshot.pages[targetIdx];
      if (engineRef.current && activePage) {
        if (activePage.canvasJson && activePage.canvasJson.objects && activePage.canvasJson.objects.length > 0) {
          engineRef.current.loadJson(activePage.canvasJson);
        } else {
          engineRef.current.clearCurrentPage(true);
        }
        const bgUrl = activePage.backgroundImageUrl || activePage.thumbnailUrl;
        if (bgUrl) {
          engineRef.current.setBackgroundImage(bgUrl).catch(() => {});
        } else {
          engineRef.current.clearBackgroundImage();
        }
      }

      whiteboardAdapter?.broadcastCustomEvent?.('restore-whiteboard-session', {
        pages: snapshot.pages,
        activePageId: activePage?.id || snapshot.pages[0].id,
      });
      schedulePersist();
    },
    [schedulePersist, whiteboardAdapter]
  );

  // Load restoreRoomId if specified on initial mount
  useEffect(() => {
    if (!restoreRoomId) return;
    let isCancelled = false;
    getPastClassWhiteboard(restoreRoomId).then((snapshot) => {
      if (!isCancelled && snapshot && snapshot.pages && snapshot.pages.length > 0) {
        handleRestoreWhiteboard({
          id: `restored-${restoreRoomId}`,
          roomId: restoreRoomId,
          title: `Restored ${restoreRoomId}`,
          date: new Date().toISOString(),
          durationSeconds: 0,
          pageCount: snapshot.pages.length,
          whiteboardSnapshot: snapshot,
        });
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [restoreRoomId, handleRestoreWhiteboard]);

  // User-scoped Undo and Redo Execution Handlers
  const handleUndo = useCallback(() => {
    if (!undoRedoStackRef.current.canUndo(userId)) {
      if (engineRef.current) {
        const objs = engineRef.current.getObjects();
        if (objs.length > 0) {
          const lastObj = objs[objs.length - 1];
          engineRef.current.removeObject(lastObj.id);
          const activeId = pageManagerRef.current.getActivePageId();
          pageManagerRef.current.updatePageCanvas(activeId, engineRef.current.exportJson());
          whiteboardAdapter?.broadcastDelete(activeId, lastObj.id).catch(() => {});
          schedulePersist();
          setCanUndo(objs.length - 1 > 0);
          return;
        }
      }
      return;
    }
    const cmd = undoRedoStackRef.current.undo(userId);
    if (!cmd || !engineRef.current) return;

    isExecutingUndoRedoRef.current = true;
    try {
      const activeId = pageManagerRef.current.getActivePageId();
      if (cmd.action === 'add') {
        engineRef.current.removeObject(cmd.objectId);
        whiteboardAdapter?.broadcastDelete(activeId, cmd.objectId).catch(() => {});
      } else if (cmd.action === 'delete') {
        if (cmd.beforeState) {
          engineRef.current.addObject(cmd.beforeState);
          whiteboardAdapter?.broadcastAdd(activeId, cmd.beforeState).catch(() => {});
        }
      } else if (cmd.action === 'modify') {
        if (cmd.beforeState) {
          engineRef.current.modifyObject(cmd.objectId, cmd.beforeState);
          whiteboardAdapter?.broadcastModify(activeId, cmd.objectId, cmd.beforeState).catch(() => {});
        }
      }
      pageManagerRef.current.updatePageCanvas(activeId, engineRef.current.exportJson());
      schedulePersist();
    } finally {
      isExecutingUndoRedoRef.current = false;
    }

    setCanUndo(undoRedoStackRef.current.canUndo(userId) || (engineRef.current ? engineRef.current.getObjects().length > 0 : false));
    setCanRedo(undoRedoStackRef.current.canRedo(userId));
  }, [userId, whiteboardAdapter, schedulePersist]);

  const handleRedo = useCallback(() => {
    if (!undoRedoStackRef.current.canRedo(userId)) return;
    const cmd = undoRedoStackRef.current.redo(userId);
    if (!cmd || !engineRef.current) return;

    isExecutingUndoRedoRef.current = true;
    try {
      const activeId = pageManagerRef.current.getActivePageId();
      if (cmd.action === 'add') {
        if (cmd.afterState) {
          engineRef.current.addObject(cmd.afterState);
          whiteboardAdapter?.broadcastAdd(activeId, cmd.afterState).catch(() => {});
        }
      } else if (cmd.action === 'delete') {
        engineRef.current.removeObject(cmd.objectId);
        whiteboardAdapter?.broadcastDelete(activeId, cmd.objectId).catch(() => {});
      } else if (cmd.action === 'modify') {
        if (cmd.afterState) {
          engineRef.current.modifyObject(cmd.objectId, cmd.afterState);
          whiteboardAdapter?.broadcastModify(activeId, cmd.objectId, cmd.afterState).catch(() => {});
        }
      }
      pageManagerRef.current.updatePageCanvas(activeId, engineRef.current.exportJson());
      schedulePersist();
    } finally {
      isExecutingUndoRedoRef.current = false;
    }

    setCanUndo(undoRedoStackRef.current.canUndo(userId) || (engineRef.current ? engineRef.current.getObjects().length > 0 : false));
    setCanRedo(undoRedoStackRef.current.canRedo(userId));
  }, [userId, whiteboardAdapter, schedulePersist]);

  // Teacher Viewport Broadcast Handler
  const handleViewportChange = useCallback(
    (viewport: { zoom: number; panX: number; panY: number }) => {
      if (
        role === 'teacher' &&
        whiteboardAdapter &&
        typeof (whiteboardAdapter as any).broadcastCustomEvent === 'function'
      ) {
        (whiteboardAdapter as any).broadcastCustomEvent('viewport-change', viewport);
      }
    },
    [role, whiteboardAdapter]
  );

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z, Lock, Z-Order)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.isContentEditable)
      ) {
        return;
      }

      const isMac =
        typeof navigator !== 'undefined' &&
        /Mac|iPod|iPhone|iPad/.test(navigator.platform);
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (!modKey) {
        if (e.key === 'v' || e.key === 'V') {
          setActiveTool('select');
        } else if (e.key === 'h' || e.key === 'H') {
          setActiveTool('pan');
        } else if (e.key === 'p' || e.key === 'P') {
          setActiveTool('pen');
        } else if (e.key === 'b' || e.key === 'B') {
          setActiveTool('pencil');
        } else if (e.key === 'e' || e.key === 'E') {
          setActiveTool('eraser');
        } else if (e.key === 't' || e.key === 'T') {
          setActiveTool('text');
        } else if (e.key === 's' || e.key === 'S') {
          setActiveTool('sticky');
        } else if (e.key === 'l' || e.key === 'L') {
          setActiveTool('laser');
        }
        return;
      }

      if (e.key === 'z' || e.key === 'Z') {
        if (e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else {
          e.preventDefault();
          handleUndo();
        }
      } else if (e.key === 'y' || e.key === 'Y') {
        e.preventDefault();
        handleRedo();
      } else if (e.shiftKey && (e.key === 'l' || e.key === 'L')) {
        // Excalidraw Lock / Unlock Selected Objects
        const selected = engineRef.current?.getSelectedObjects() || [];
        if (selected.length > 0) {
          e.preventDefault();
          selected.forEach((obj: any) => {
            if (engineRef.current?.isObjectLocked(obj.id)) {
              engineRef.current?.unlockObject(obj.id);
            } else {
              engineRef.current?.lockObject(obj.id);
            }
          });
        }
      } else if (e.key === ']') {
        // Excalidraw Bring Forward / Bring to Front
        const selected = engineRef.current?.getSelectedObjects() || [];
        if (selected.length > 0) {
          e.preventDefault();
          selected.forEach((obj: any) => {
            if (e.shiftKey) {
              engineRef.current?.bringToFront(obj.id);
            } else {
              engineRef.current?.bringForward(obj.id);
            }
          });
        }
      } else if (e.key === '[') {
        // Excalidraw Send Backward / Send to Back
        const selected = engineRef.current?.getSelectedObjects() || [];
        if (selected.length > 0) {
          e.preventDefault();
          selected.forEach((obj: any) => {
            if (e.shiftKey) {
              engineRef.current?.sendToBack(obj.id);
            } else {
              engineRef.current?.sendBackward(obj.id);
            }
          });
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleUndo, handleRedo]);

  // Engine Ready Callback & Object Mutation Listeners
  const handleEngineReady = useCallback(
    (engine: FabricWhiteboardEngine) => {
      engineRef.current = engine;

      // Hydrate state from active page
      const activePage = pageManagerRef.current.getActivePage();
      if (activePage) {
        if (activePage.canvasJson) {
          engine.loadJson(activePage.canvasJson).catch(() => {});
        }
        if (activePage.thumbnailUrl) {
          engine.setBackgroundImage(activePage.thumbnailUrl).catch(() => {});
        }
      }

      engine.onObjectAdded((obj) => {
        if (isApplyingRemoteDeltaRef.current) return;
        if (!isExecutingUndoRedoRef.current) {
          undoRedoStackRef.current.recordAdd(obj.id, obj, userId);
          setCanUndo(undoRedoStackRef.current.canUndo(userId));
          setCanRedo(undoRedoStackRef.current.canRedo(userId));
        }
        const activeId = pageManagerRef.current.getActivePageId();
        pageManagerRef.current.updatePageCanvas(activeId, engine.exportJson());
        whiteboardAdapter?.broadcastAdd(activeId, obj).catch(() => {});
        schedulePersist();
      });

      engine.onObjectModified((obj) => {
        if (isApplyingRemoteDeltaRef.current) return;
        const activeId = pageManagerRef.current.getActivePageId();
        pageManagerRef.current.updatePageCanvas(activeId, engine.exportJson());
        whiteboardAdapter?.broadcastModify(activeId, obj.id, obj).catch(() => {});
        schedulePersist();
      });

      engine.onObjectRemoved((objId) => {
        if (isApplyingRemoteDeltaRef.current) return;
        if (!isExecutingUndoRedoRef.current) {
          const removedObj = engine.getLastRemovedObject();
          if (removedObj) {
            undoRedoStackRef.current.recordDelete(objId, removedObj, userId);
            setCanUndo(undoRedoStackRef.current.canUndo(userId));
            setCanRedo(undoRedoStackRef.current.canRedo(userId));
          }
        }
        const activeId = pageManagerRef.current.getActivePageId();
        pageManagerRef.current.updatePageCanvas(activeId, engine.exportJson());
        whiteboardAdapter?.broadcastDelete(activeId, objId).catch(() => {});
        schedulePersist();
      });

      propOnEngineReady?.(engine);
    },
    [userId, whiteboardAdapter, schedulePersist, propOnEngineReady]
  );

  // Background Grid Mode Handler
  const handleChangeGrid = useCallback((grid: GridPatternType) => {
    setCurrentGrid(grid);
    const engineGrid =
      grid === 'blank' ? 'none' : grid === 'lined' ? 'lines' : grid;
    engineRef.current?.setGridType(engineGrid);
  }, []);

  // 1-Click PNG Image Export
  const handleExportImage = useCallback(() => {
    if (typeof document === 'undefined') return;
    const canvas = document.querySelector(
      'canvas[data-testid="whiteboard-canvas"]'
    ) as HTMLCanvasElement | null;
    if (!canvas) return;
    try {
      const dataUrl = canvas.toDataURL('image/png');
      const activePage = pageManagerRef.current.getActivePage();
      const filename = `lesson-${roomId}-page-${
        activePage?.pageNumber || currentPageIndex
      }.png`;
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error('Failed to export canvas image:', err);
    }
  }, [roomId, currentPageIndex]);

  const handleExportPdf = useCallback(() => {
    downloadMultiPagePdf(pages, roomId).catch((err) => {
      console.error('Failed to export lesson PDF:', err);
    });
  }, [pages, roomId]);

  // Guarded Page Clear Handler (Preserves Locked Worksheet Background)
  const handleClearPage = useCallback(() => {
    if (!engineRef.current) return;
    const currentObjs = engineRef.current.getObjects();
    if (currentObjs.length > 0) {
      currentObjs.forEach((obj: any) => {
        undoRedoStackRef.current.recordDelete(obj.id, obj, userId);
      });
      setCanUndo(true);
    }
    engineRef.current.clearCurrentPage(true);
    const activeId = pageManagerRef.current.getActivePageId();
    pageManagerRef.current.updatePageCanvas(activeId, engineRef.current.exportJson());
    whiteboardAdapter?.broadcastDelete(activeId, '__all__').catch(() => {});
    schedulePersist();
  }, [userId, whiteboardAdapter, schedulePersist]);

  // Laser move handler
  const handleLaserMove = useCallback(
    (pt: { x: number; y: number }) => {
      const activeId = pageManagerRef.current.getActivePageId();
      whiteboardAdapter
        ?.broadcastLaser(activeId, {
          x: pt.x,
          y: pt.y,
          timestamp: Date.now(),
        })
        .catch(() => {});
    },
    [whiteboardAdapter]
  );

  // Chat Messages
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-1',
      senderId: 'system',
      senderName: 'Classroom',
      text: `Welcome to classroom ${roomId}!`,
      timestamp: Date.now(),
    },
  ]);

  // Sync prop changes
  useEffect(() => {
    if (propLocalStream !== undefined) setLocalStream(propLocalStream);
  }, [propLocalStream]);

  useEffect(() => {
    if (propRemoteStream !== undefined) setRemoteStream(propRemoteStream);
  }, [propRemoteStream]);

  useEffect(() => {
    if (initialQuality) setQuality(initialQuality);
  }, [initialQuality]);

  useEffect(() => {
    if (propAudioDevices) setAudioDevices(propAudioDevices);
    if (propVideoDevices) setVideoDevices(propVideoDevices);
  }, [propAudioDevices, propVideoDevices]);

  // Wire media session callbacks
  useEffect(() => {
    if (!mediaSession) return;

    mediaSession.onRemoteTrack?.((track, stream) => {
      setRemoteStream(stream);
    });

    mediaSession.onQualityMetrics?.((metrics) => {
      setQuality(metrics);
    });
  }, [mediaSession]);

  // Mode Toggle Handler
  const handleToggleMode = () => {
    const nextMode: WorkspaceMode =
      mode === 'classroom' ? 'whiteboard' : 'classroom';
    setMode(nextMode);
    onModeChange?.(nextMode);
  };

  // Side Panel Toggle
  const handleToggleSidePanel = () => {
    setIsSidePanelCollapsed((prev) => !prev);
  };

  // Media Controls
  const handleToggleMic = () => {
    if (mediaSession && typeof mediaSession.toggleMic === 'function') {
      const result = mediaSession.toggleMic();
      if (typeof result === 'boolean') {
        setIsMicMuted(!result);
      } else {
        setIsMicMuted((prev) => !prev);
      }
    } else {
      setIsMicMuted((prev) => !prev);
    }
  };

  const handleToggleCamera = () => {
    if (mediaSession && typeof mediaSession.toggleCamera === 'function') {
      const result = mediaSession.toggleCamera();
      if (typeof result === 'boolean') {
        setIsCameraOff(!result);
      } else {
        setIsCameraOff((prev) => !prev);
      }
    } else {
      setIsCameraOff((prev) => !prev);
    }
  };

  const handleToggleScreenShare = () => {
    if (mediaSession) {
      if (typeof (mediaSession as any).toggleScreenShare === 'function') {
        (mediaSession as any).toggleScreenShare().catch(() => {});
      } else if (isScreenSharing && typeof mediaSession.stopScreenShare === 'function') {
        mediaSession.stopScreenShare().catch(() => {});
      }
    }
    setIsScreenSharing((prev) => !prev);
  };

  // Page Navigation Handlers
  const handlePageChange = (pageNum: number) => {
    const target = pageManagerRef.current.getPageByIndex(pageNum - 1);
    if (target) {
      if (engineRef.current) {
        const curId = pageManagerRef.current.getActivePageId();
        pageManagerRef.current.updatePageCanvas(curId, engineRef.current.exportJson());
      }
      pageManagerRef.current.setActivePage(target.id);
      setCurrentPageIndex(pageNum);
      if (engineRef.current) {
        if (target.canvasJson && target.canvasJson.objects && target.canvasJson.objects.length > 0) {
          engineRef.current.loadJson(target.canvasJson);
        } else {
          engineRef.current.clearCurrentPage(true);
        }
        if (target.thumbnailUrl) {
          engineRef.current.setBackgroundImage(target.thumbnailUrl).catch(() => {});
        } else {
          engineRef.current.clearBackgroundImage();
        }
      }
      setCanUndo(undoRedoStackRef.current.canUndo(userId) || (engineRef.current ? engineRef.current.getObjects().length > 0 : false));
      setCanRedo(undoRedoStackRef.current.canRedo(userId));
      whiteboardAdapter?.broadcastPageSwitch(target.id).catch(() => {});
      schedulePersist();
      propOnPageChange?.(pageNum, target.id);
    }
  };

  const handleAddPage = () => {
    const newPage = pageManagerRef.current.addPage();
    setPages(pageManagerRef.current.getAllPages());
    const nextIdx = pageManagerRef.current.getPageCount();
    setCurrentPageIndex(nextIdx);
    whiteboardAdapter
      ?.broadcastPageAdd(newPage.id, newPage.pageNumber, newPage.title)
      .catch(() => {});
    schedulePersist();
    propOnPagesChange?.(pageManagerRef.current.getAllPages());
  };

  const handleDeletePage = (pageId: string) => {
    pageManagerRef.current.deletePage(pageId);
    setPages(pageManagerRef.current.getAllPages());
    setCurrentPageIndex(pageManagerRef.current.getActivePageIndex() + 1);
    whiteboardAdapter?.broadcastPageDelete(pageId).catch(() => {});
    schedulePersist();
    propOnPagesChange?.(pageManagerRef.current.getAllPages());
  };

  const handleClonePage = (pageId: string) => {
    pageManagerRef.current.duplicatePage(pageId);
    setPages(pageManagerRef.current.getAllPages());
    schedulePersist();
    propOnPagesChange?.(pageManagerRef.current.getAllPages());
  };

  const handleRenamePage = (pageId: string, newTitle: string) => {
    pageManagerRef.current.renamePage(pageId, newTitle);
    setPages([...pageManagerRef.current.getAllPages()]);
    schedulePersist();
    propOnPagesChange?.(pageManagerRef.current.getAllPages());
  };

  const handleSelectPage = (pageId: string) => {
    if (engineRef.current) {
      const curId = pageManagerRef.current.getActivePageId();
      pageManagerRef.current.updatePageCanvas(curId, engineRef.current.exportJson());
    }
    pageManagerRef.current.setActivePage(pageId);
    const idx = pageManagerRef.current.getActivePageIndex();
    if (idx >= 0) {
      setCurrentPageIndex(idx + 1);
      const target = pageManagerRef.current.getActivePage();
      if (engineRef.current && target) {
        if (target.canvasJson && target.canvasJson.objects && target.canvasJson.objects.length > 0) {
          engineRef.current.loadJson(target.canvasJson);
        } else {
          engineRef.current.clearCurrentPage(true);
        }
        if (target.thumbnailUrl) {
          engineRef.current.setBackgroundImage(target.thumbnailUrl).catch(() => {});
        } else {
          engineRef.current.clearBackgroundImage();
        }
      }
      setCanUndo(undoRedoStackRef.current.canUndo(userId) || (engineRef.current ? engineRef.current.getObjects().length > 0 : false));
      setCanRedo(undoRedoStackRef.current.canRedo(userId));
      whiteboardAdapter?.broadcastPageSwitch(pageId).catch(() => {});
      schedulePersist();
      propOnPageChange?.(idx + 1, pageId);
    }
  };

  // Permission Handlers (Authoritative Teacher)
  const handleToggleGlobalLock = (locked: boolean) => {
    const nextPerms = { ...permissions, isLockedGlobally: locked };
    setPermissions(nextPerms);
    whiteboardAdapter?.broadcastPermissions(nextPerms).catch(() => {});
    schedulePersist(nextPerms);
    propOnPermissionsChange?.(nextPerms);
  };

  const handleToggleStudentDrawing = (studentId: string, allowed: boolean) => {
    const nextPerms = {
      ...permissions,
      studentDrawingGranted: {
        ...permissions.studentDrawingGranted,
        [studentId]: allowed,
      },
    };
    setPermissions(nextPerms);
    whiteboardAdapter?.broadcastPermissions(nextPerms).catch(() => {});
    schedulePersist(nextPerms);
    propOnPermissionsChange?.(nextPerms);
  };

  const handleToggleLaserOnly = (laserOnly: boolean) => {
    const nextPerms = { ...permissions, laserPointerOnly: laserOnly };
    setPermissions(nextPerms);
    whiteboardAdapter?.broadcastPermissions(nextPerms).catch(() => {});
    schedulePersist(nextPerms);
    propOnPermissionsChange?.(nextPerms);
  };

  // Handle in-tab PDF sub-page flipping
  const handlePdfSubPageChange = (targetPage: number) => {
    const activePage = pageManagerRef.current.getActivePage();
    if (!activePage || !activePage.pdfDocument) return;

    const doc = activePage.pdfDocument;
    if (targetPage < 1 || targetPage > doc.totalPages) return;

    // Save current strokes into pageStrokes
    if (engineRef.current) {
      if (!doc.pageStrokes) doc.pageStrokes = {};
      doc.pageStrokes[doc.currentPage] = engineRef.current.exportJson();
    }

    doc.currentPage = targetPage;
    const newBg = doc.pages[targetPage - 1];

    if (engineRef.current) {
      if (newBg) {
        engineRef.current.setBackgroundImage(newBg).catch(() => {});
      } else {
        engineRef.current.clearBackgroundImage();
      }

      const nextStrokes = doc.pageStrokes?.[targetPage];
      if (nextStrokes && nextStrokes.objects && nextStrokes.objects.length > 0) {
        engineRef.current.loadJson(nextStrokes);
      } else {
        engineRef.current.clearCurrentPage(true);
      }
    }

    setPages([...pageManagerRef.current.getAllPages()]);
    schedulePersist();
  };

  // Worksheet Material Loader
  const handleLoadWorksheet = async (fileOrUrl: File | string) => {
    try {
      let backgroundUrl: string;
      let totalPdfPages = 1;
      const pdfPageDataUrls: string[] = [];

      if (typeof fileOrUrl === 'string') {
        backgroundUrl = fileOrUrl;
        pdfPageDataUrls.push(fileOrUrl);
      } else {
        if (fileOrUrl.type === 'application/pdf' || fileOrUrl.name?.endsWith('.pdf')) {
          const doc = await convertPdfToPageImages(fileOrUrl);
          totalPdfPages = doc.totalPages;
          backgroundUrl = doc.pages[0];
          pdfPageDataUrls.push(...doc.pages);
        } else if (
          fileOrUrl.type?.startsWith('image/') ||
          /\.(png|jpe?g|webp|svg)$/i.test(fileOrUrl.name || '')
        ) {
          backgroundUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsDataURL(fileOrUrl);
          });
          pdfPageDataUrls.push(backgroundUrl);
        } else {
          backgroundUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = () => {
              try {
                resolve(URL.createObjectURL(fileOrUrl));
              } catch (e) {
                reject(e);
              }
            };
            reader.readAsDataURL(fileOrUrl);
          });
          pdfPageDataUrls.push(backgroundUrl);
        }
      }

      const docTitle =
        typeof fileOrUrl === 'string'
          ? 'Worksheet'
          : fileOrUrl.name
          ? fileOrUrl.name.replace(/\.[^/.]+$/, '')
          : 'Lesson Document';

      const activePage = pageManagerRef.current.getActivePage();
      const activeId = pageManagerRef.current.getActivePageId();

      if (activePage) {
        if (totalPdfPages > 1) {
          activePage.pdfDocument = {
            title: docTitle,
            pages: pdfPageDataUrls,
            currentPage: 1,
            totalPages: totalPdfPages,
            pageStrokes: {},
          };
        } else {
          delete activePage.pdfDocument;
        }
      }

      pageManagerRef.current.updatePageBackground(
        activeId,
        typeof fileOrUrl === 'string' ? fileOrUrl : undefined,
        1,
        backgroundUrl
      );
      pageManagerRef.current.renamePage(activeId, docTitle);

      for (let p = 2; p <= totalPdfPages; p++) {
        const pageBg = pdfPageDataUrls[p - 1];
        const existing = pageManagerRef.current.getPageByIndex(p - 1);
        if (existing) {
          pageManagerRef.current.updatePageBackground(
            existing.id,
            typeof fileOrUrl === 'string' ? fileOrUrl : undefined,
            p,
            pageBg
          );
          pageManagerRef.current.renamePage(existing.id, `${docTitle} (Page ${p})`);
        } else {
          const newP = pageManagerRef.current.addPage(`${docTitle} (Page ${p})`);
          pageManagerRef.current.updatePageBackground(
            newP.id,
            typeof fileOrUrl === 'string' ? fileOrUrl : undefined,
            p,
            pageBg
          );
        }
      }

      setPages(pageManagerRef.current.getAllPages());

      if (engineRef.current) {
        await engineRef.current.setBackgroundImage(backgroundUrl);
      }

      whiteboardAdapter
        ?.broadcastModify(activeId, '__page_background__', {
          backgroundPdfUrl: typeof fileOrUrl === 'string' ? fileOrUrl : undefined,
          backgroundImageUrl: backgroundUrl,
        })
        .catch(() => {});

      schedulePersist();
      propOnLoadWorksheet?.(fileOrUrl);
    } catch (err) {
      console.warn('Error loading worksheet:', err);
    }
  };

  const handleLeaveClass = () => {
    persistenceManager?.flush().catch(() => {});
    onLeave?.();
  };

  // Chat Handler
  const handleSendMessage = (text: string) => {
    if (!text.trim()) return;
    const newMsg: ChatMessage = {
      id: `m-${Date.now()}`,
      senderId: userId,
      senderName: localName,
      text: text.trim(),
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, newMsg]);
  };

  // Participants list for PeopleTab
  const participants: Participant[] = useMemo(
    () => [
      {
        id: userId,
        name: localName,
        role: role,
        isOnline: true,
        hasDrawingPermission:
          role === 'teacher' ||
          Boolean(permissions.studentDrawingGranted?.[userId]),
        isAudioMuted: isMicMuted,
        isVideoOff: isCameraOff,
      },
      {
        id: role === 'teacher' ? 'student-peer' : 'teacher-peer',
        name: remoteName,
        role: role === 'teacher' ? 'student' : 'teacher',
        isOnline: true,
        hasDrawingPermission:
          role === 'student' ||
          Boolean(
            permissions.studentDrawingGranted?.[
              role === 'teacher' ? 'student-peer' : 'teacher-peer'
            ]
          ),
        isAudioMuted: isRemoteAudioMuted,
        isVideoOff: isRemoteCameraOff,
      },
    ],
    [
      userId,
      localName,
      remoteName,
      role,
      permissions,
      isMicMuted,
      isCameraOff,
      isRemoteAudioMuted,
      isRemoteCameraOff,
    ]
  );

  return (
    <div
      data-testid="classroom-workspace"
      data-bg="bg-[#121110]"
      className={`relative w-full h-full flex flex-col bg-[#f8f9fb] text-zinc-900 overflow-hidden select-none ${className}`}
    >
      {/* Top Navigation & Mode Switcher Bar */}
      <header
        data-testid="workspace-header"
        className="relative z-30 h-14 px-4 flex items-center justify-between border-b border-zinc-200/90 bg-white/90 backdrop-blur-md text-zinc-900 select-none shrink-0 shadow-sm"
      >
        {/* Left: Branding & Room Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-sm tracking-tight text-zinc-900">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">Classroom</span>
            <span className="text-zinc-400 text-xs">/</span>
            <span
              data-testid="room-id-badge"
              className="text-xs px-2 py-0.5 rounded-md bg-zinc-100 text-zinc-700 font-mono border border-zinc-200/80"
            >
              {roomId}
            </span>
          </div>
        </div>

        {/* Center: Dual Mode Switcher Button */}
        <div
          data-testid="mode-switcher-container"
          className="flex items-center p-1 rounded-xl bg-zinc-100 border border-zinc-200 shadow-inner"
        >
          <button
            type="button"
            data-testid="mode-toggle-btn"
            aria-label={`Toggle to ${
              mode === 'classroom' ? 'Whiteboard' : 'Classroom'
            } Mode`}
            onClick={handleToggleMode}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-zinc-800 transition-all duration-200 cursor-pointer hover:bg-white active:scale-95 shadow-sm"
          >
            {mode === 'classroom' ? (
              <>
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                <span>Classroom Mode</span>
              </>
            ) : (
              <>
                <Presentation className="w-3.5 h-3.5 text-indigo-600" />
                <span>Whiteboard Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Session Lifecycle, Timer & Studio Side Panel Trigger */}
        <div className="flex items-center gap-2">
          {role === 'teacher' ? (
            sessionStatus === 'waiting' ? (
              <button
                type="button"
                data-testid="start-class-btn"
                onClick={handleStartClass}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-zinc-950 transition-all active:scale-95 shadow-sm"
              >
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Start Class</span>
              </button>
            ) : sessionStatus === 'in_progress' ? (
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-medium px-2 py-1 rounded bg-zinc-100 text-amber-700 border border-zinc-200">
                  {formatDuration(lessonDurationSeconds)}
                </span>
                <button
                  type="button"
                  data-testid="end-class-btn"
                  onClick={handleEndClass}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-all active:scale-95"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                  <span>End Class</span>
                </button>
              </div>
            ) : null
          ) : sessionStatus === 'in_progress' ? (
            <span className="text-xs font-mono font-medium px-2 py-1 rounded bg-zinc-100 text-amber-700 border border-zinc-200">
              {formatDuration(lessonDurationSeconds)}
            </span>
          ) : null}

          <button
            type="button"
            data-testid="toggle-timer-btn"
            aria-label="Toggle Classroom Timer"
            onClick={() => setIsTimerOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer active:scale-95 ${
              isTimerOpen
                ? 'bg-amber-500/20 text-amber-700 border-amber-400/40'
                : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200/60'
            }`}
          >
            <TimerIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Timer</span>
          </button>

          <button
            type="button"
            data-testid="toggle-video-sync-btn"
            aria-label="Toggle Synchronized Video Player"
            onClick={() => setIsVideoSyncOpen((prev) => !prev)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-150 cursor-pointer active:scale-95 ${
              isVideoSyncOpen
                ? 'bg-amber-500/20 text-amber-700 border-amber-400/40'
                : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200/60'
            }`}
          >
            <VideoIcon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Video</span>
          </button>

          <button
            type="button"
            data-testid="toggle-studio-panel-btn"
            aria-label="Toggle Studio Side Panel"
            onClick={handleToggleSidePanel}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer ${
              !isSidePanelCollapsed
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-zinc-100 text-zinc-700 border-zinc-200 hover:bg-zinc-200/60'
            }`}
          >
            <Sidebar className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Studio Panel</span>
          </button>
        </div>
      </header>

      {/* Main Dual-Mode Layout Container */}
      <div
        data-testid={
          mode === 'classroom' ? 'classroom-layout' : 'whiteboard-layout'
        }
        className="relative flex-1 flex flex-col md:flex-row w-full h-full min-h-0 overflow-hidden"
      >
        {/* Video Tiles Dock:
            In Classroom Mode: Balanced vertical column on left.
            In Whiteboard Mode: Compact floating PiP tile stack in corner.
            Maintains continuous mounting of VideoCard elements without re-negotiation.
        */}
        <div
          data-testid="video-tiles-dock"
          className={`transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)] ${
            mode === 'classroom'
              ? 'w-full md:w-[340px] lg:w-[400px] xl:w-[440px] h-auto md:h-full flex flex-col gap-3 p-3 bg-white/80 border-r border-zinc-200/80 shrink-0 z-20 overflow-y-auto'
              : 'fixed bottom-20 right-4 z-30 flex flex-row gap-2 max-w-sm pointer-events-auto bg-transparent border-0 p-0'
          }`}
        >
          {/* Local Participant Video Tile */}
          <div
            data-testid="local-video-wrapper"
            className={`transition-all duration-300 ease-out overflow-hidden rounded-xl ${
              mode === 'classroom'
                ? 'w-full aspect-video shadow-lg border border-white/[0.08]'
                : 'w-36 md:w-44 aspect-video shadow-2xl border border-white/20 backdrop-blur-md'
            }`}
          >
            <VideoCard
              participantName={localName}
              roleBadge={localRoleBadge}
              stream={localStream}
              isLocal={true}
              isCameraOff={isCameraOff}
              isAudioMuted={isMicMuted}
            />
          </div>

          {/* Remote Participant Video Tile */}
          <div
            data-testid="remote-video-wrapper"
            className={`transition-all duration-300 ease-out overflow-hidden rounded-xl ${
              mode === 'classroom'
                ? 'w-full aspect-video shadow-lg border border-white/[0.08]'
                : 'w-36 md:w-44 aspect-video shadow-2xl border border-white/20 backdrop-blur-md'
            }`}
          >
            <VideoCard
              participantName={remoteName}
              roleBadge={remoteRoleBadge}
              stream={remoteStream}
              isLocal={false}
              isCameraOff={isRemoteCameraOff}
              isAudioMuted={isRemoteAudioMuted}
            />
          </div>
        </div>

        {/* Whiteboard Interactive Canvas Stage */}
        <main
          data-testid="workspace-canvas-container"
          className="relative flex-1 w-full h-full min-w-0 min-h-0 overflow-hidden flex flex-col"
        >
          {role === 'student' && sessionStatus === 'waiting' && (
            <div
              data-testid="student-waiting-room"
              className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-stone-950/85 backdrop-blur-md text-stone-200"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 animate-pulse mb-3">
                <Clock className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-semibold text-stone-100">
                Waiting for tutor to start the class...
              </h3>
              <p className="text-sm text-stone-400 mt-1">
                Please sit tight. Your lesson will begin shortly.
              </p>
            </div>
          )}
          <BrowserTabBar
            pages={pages}
            activePageId={pages[currentPageIndex - 1]?.id || pages[0]?.id || 'page-1'}
            onSelectTab={handleSelectPage}
            onAddTab={handleAddPage}
            onCloseTab={handleDeletePage}
            onRenameTab={handleRenamePage}
            isTeacher={role === 'teacher'}
          />
          <WhiteboardStage
            role={role}
            userId={userId}
            userName={localName}
            activeTool={activeTool}
            onSelectTool={setActiveTool}
            currentPage={currentPageIndex}
            totalPages={pages.length}
            onPageChange={handlePageChange}
            onAddPage={handleAddPage}
            permissions={permissions}
            laserEngine={laserEngineRef.current}
            onLaserMove={handleLaserMove}
            onEngineReady={handleEngineReady}
            canUndo={canUndo || Boolean(engineRef.current && engineRef.current.getObjects().length > 0)}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClearPage={handleClearPage}
            onTriggerReward={role === 'teacher' ? handleTriggerReward : undefined}
            isFollowTeacherEnabled={isFollowTeacherEnabled}
            onToggleFollowTeacher={setIsFollowTeacherEnabled}
            onViewportChange={handleViewportChange}
            remoteViewport={remoteViewport}
            className="w-full flex-1 min-h-0"
          />

          {/* In-Tab PDF Sub-Page Navigation */}
          {pages[currentPageIndex - 1]?.pdfDocument && (
            <PdfSubPageNavigator
              currentPage={pages[currentPageIndex - 1].pdfDocument!.currentPage}
              totalPages={pages[currentPageIndex - 1].pdfDocument!.totalPages}
              documentTitle={pages[currentPageIndex - 1].pdfDocument!.title}
              onPageChange={handlePdfSubPageChange}
            />
          )}
        </main>

        {/* Collapsible Studio Side Panel (Tabs: People, Chat, Materials, Tools) */}
        <StudioSidePanel
          isCollapsed={isSidePanelCollapsed}
          onToggleCollapse={handleToggleSidePanel}
          participants={propParticipants || participants}
          currentUserRole={role}
          permissions={permissions}
          onToggleGlobalLock={handleToggleGlobalLock}
          onToggleStudentDrawing={handleToggleStudentDrawing}
          onToggleLaserOnly={handleToggleLaserOnly}
          messages={messages}
          onSendMessage={handleSendMessage}
          currentUserId={userId}
          currentUserName={localName}
          pages={pages}
          currentPageId={pageManagerRef.current.getActivePageId()}
          onSelectPage={handleSelectPage}
          onClonePage={handleClonePage}
          onDeletePage={handleDeletePage}
          onAddPage={handleAddPage}
          onLoadWorksheet={handleLoadWorksheet}
          worksheets={worksheets}
          pastClasses={pastClasses}
          onRestoreWhiteboard={handleRestoreWhiteboard}
          currentGrid={currentGrid}
          onChangeGrid={handleChangeGrid}
          onExportImage={handleExportImage}
          onExportPdf={handleExportPdf}
        />
      </div>

      {/* Floating Left Vertical Control Bar */}
      <footer
        data-testid="workspace-control-bar"
        className="pointer-events-none"
      >
        <ControlBar
          orientation="vertical"
          isMicMuted={isMicMuted}
          isCameraOff={isCameraOff}
          isScreenSharing={isScreenSharing}
          onToggleMic={handleToggleMic}
          onToggleCamera={handleToggleCamera}
          onToggleScreenShare={handleToggleScreenShare}
          onLeaveClass={handleLeaveClass}
          audioDevices={audioDevices}
          videoDevices={videoDevices}
          selectedAudioDeviceId={selectedAudioDeviceId}
          selectedVideoDeviceId={selectedVideoDeviceId}
          onSelectAudioDevice={setSelectedAudioDeviceId}
          onSelectVideoDevice={setSelectedVideoDeviceId}
        />
      </footer>

      {/* Floating Classroom Timer HUD */}
      <ClassroomTimerWidget
        isOpen={isTimerOpen}
        onClose={() => setIsTimerOpen(false)}
        isTeacher={role === 'teacher'}
        onBroadcastTimerState={(state) => {
          whiteboardAdapter?.broadcastCustomEvent?.('timer-state', state);
        }}
        remoteTimerState={remoteTimerState}
      />

      {/* Synchronized Lesson Media Player */}
      <ClassroomVideoSync
        isOpen={isVideoSyncOpen}
        onClose={() => setIsVideoSyncOpen(false)}
        isTeacher={role === 'teacher'}
        onBroadcastVideoState={(state) => {
          whiteboardAdapter?.broadcastCustomEvent?.('video-sync-state', state);
        }}
        remoteVideoState={remoteVideoState}
      />

      {/* Student Celebratory Reward & Confetti Overlay */}
      <RewardCelebrationOverlay
        activeReward={activeReward}
        onDismiss={() => setActiveReward(null)}
      />

      {/* Post-Class Summary Modal */}
      <EndClassSummaryModal
        isOpen={isEndClassModalOpen}
        durationSeconds={lessonDurationSeconds}
        pagesCount={pages.length}
        starsAwarded={starsAwarded}
        onDownloadPdf={handleExportPdf}
        onClose={() => setIsEndClassModalOpen(false)}
      />
    </div>
  );
};
