'use client';

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Presentation,
  LayoutGrid,
  Sidebar,
} from 'lucide-react';
import {
  IMediaSession,
  ConnectionQuality,
  createDefaultQuality,
} from '../../types/media';
import {
  WhiteboardPermissions,
  WhiteboardPage,
  defaultWhiteboardPermissions,
  createDefaultWhiteboardPage,
} from '../../types/whiteboard';
import { VideoCard } from './VideoCard';
import { ControlBar } from './ControlBar';
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
import { renderPdfPageToDataUrl } from '../../lib/whiteboard/pdf-renderer';
import { WorksheetMaterial } from '../whiteboard/tabs/MaterialsTab';
import { Participant } from '../whiteboard/tabs/PeopleTab';
import { ChatMessage } from '../whiteboard/tabs/ChatTab';
import { GridPatternType } from '../whiteboard/tabs/ToolsTab';

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

  // User-scoped Undo and Redo Execution Handlers
  const handleUndo = useCallback(() => {
    if (!undoRedoStackRef.current.canUndo(userId)) return;
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

    setCanUndo(undoRedoStackRef.current.canUndo(userId));
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

    setCanUndo(undoRedoStackRef.current.canUndo(userId));
    setCanRedo(undoRedoStackRef.current.canRedo(userId));
  }, [userId, whiteboardAdapter, schedulePersist]);

  // Global Keyboard Shortcuts (Ctrl+Z, Ctrl+Y, Cmd+Z, Cmd+Shift+Z)
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

      if (!modKey) return;

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

  // Guarded Page Clear Handler (Preserves Locked Worksheet Background)
  const handleClearPage = useCallback(() => {
    if (!engineRef.current) return;
    engineRef.current.clearCurrentPage(true);
    const activeId = pageManagerRef.current.getActivePageId();
    pageManagerRef.current.updatePageCanvas(activeId, engineRef.current.exportJson());
    undoRedoStackRef.current.clearUserHistory(userId);
    setCanUndo(false);
    setCanRedo(false);
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
        if (target.canvasJson) {
          engineRef.current.loadJson(target.canvasJson);
        }
        if (target.thumbnailUrl) {
          engineRef.current.setBackgroundImage(target.thumbnailUrl).catch(() => {});
        }
      }
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
    const page = pageManagerRef.current.getPage(pageId);
    if (page) {
      page.title = newTitle;
      setPages([...pageManagerRef.current.getAllPages()]);
      schedulePersist();
      propOnPagesChange?.(pageManagerRef.current.getAllPages());
    }
  };

  const handleSelectPage = (pageId: string) => {
    pageManagerRef.current.setActivePage(pageId);
    const idx = pageManagerRef.current.getActivePageIndex();
    if (idx >= 0) {
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

  // Worksheet Material Loader
  const handleLoadWorksheet = async (fileOrUrl: File | string) => {
    try {
      let backgroundUrl: string;
      if (typeof fileOrUrl === 'string') {
        backgroundUrl = fileOrUrl;
      } else {
        if (fileOrUrl.type === 'application/pdf' || fileOrUrl.name?.endsWith('.pdf')) {
          const buffer = await fileOrUrl.arrayBuffer();
          const renderResult = await renderPdfPageToDataUrl(buffer, 1);
          backgroundUrl = renderResult.dataUrl;
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
        }
      }

      const activeId = pageManagerRef.current.getActivePageId();
      pageManagerRef.current.updatePageBackground(
        activeId,
        typeof fileOrUrl === 'string' ? fileOrUrl : undefined,
        1,
        backgroundUrl
      );
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
      className={`relative w-full h-full flex flex-col bg-[#07080c] text-zinc-100 overflow-hidden select-none ${className}`}
    >
      {/* Top Navigation & Mode Switcher Bar */}
      <header
        data-testid="workspace-header"
        className="relative z-30 h-14 px-4 flex items-center justify-between border-b border-white/[0.08] bg-[#0c0d14]/90 backdrop-blur-md text-white select-none shrink-0"
      >
        {/* Left: Branding & Room Badge */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-semibold text-sm tracking-tight text-white">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="font-medium">Classroom</span>
            <span className="text-zinc-600 text-xs">/</span>
            <span
              data-testid="room-id-badge"
              className="text-xs px-2 py-0.5 rounded-md bg-white/[0.06] text-zinc-300 font-mono"
            >
              {roomId}
            </span>
          </div>
        </div>

        {/* Center: Dual Mode Switcher Button */}
        <div
          data-testid="mode-switcher-container"
          className="flex items-center p-1 rounded-xl bg-white/[0.05] border border-white/[0.08] shadow-inner"
        >
          <button
            type="button"
            data-testid="mode-toggle-btn"
            aria-label={`Toggle to ${
              mode === 'classroom' ? 'Whiteboard' : 'Classroom'
            } Mode`}
            onClick={handleToggleMode}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-all duration-200 cursor-pointer hover:bg-white/[0.08] active:scale-95"
          >
            {mode === 'classroom' ? (
              <>
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-400" />
                <span>Classroom Mode</span>
              </>
            ) : (
              <>
                <Presentation className="w-3.5 h-3.5 text-indigo-400" />
                <span>Whiteboard Mode</span>
              </>
            )}
          </button>
        </div>

        {/* Right: Studio Side Panel Trigger */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            data-testid="toggle-studio-panel-btn"
            aria-label="Toggle Studio Side Panel"
            onClick={handleToggleSidePanel}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all duration-200 cursor-pointer ${
              !isSidePanelCollapsed
                ? 'bg-indigo-600/30 text-indigo-200 border-indigo-500/40'
                : 'bg-white/[0.06] text-zinc-300 border-white/[0.08] hover:bg-white/[0.1]'
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
              ? 'w-full md:w-[340px] lg:w-[400px] xl:w-[440px] h-auto md:h-full flex flex-col gap-3 p-3 bg-[#0d0e14]/90 border-r border-white/[0.08] shrink-0 z-20 overflow-y-auto'
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
            currentPage={currentPageIndex}
            totalPages={pages.length}
            onPageChange={handlePageChange}
            onAddPage={handleAddPage}
            permissions={permissions}
            laserEngine={laserEngineRef.current}
            onLaserMove={handleLaserMove}
            onEngineReady={handleEngineReady}
            canUndo={canUndo}
            canRedo={canRedo}
            onUndo={handleUndo}
            onRedo={handleRedo}
            onClearPage={handleClearPage}
            className="w-full h-full"
          />
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
          currentGrid={currentGrid}
          onChangeGrid={handleChangeGrid}
          onExportImage={handleExportImage}
        />
      </div>

      {/* Persistent Bottom Classroom Control Bar */}
      <footer
        data-testid="workspace-control-bar"
        className="relative z-30 flex items-center justify-center py-2 px-4 bg-[#0a0b10]/95 backdrop-blur-md border-t border-white/[0.08] shrink-0"
      >
        <ControlBar
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
    </div>
  );
};
