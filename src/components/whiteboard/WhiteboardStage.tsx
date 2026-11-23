import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Lock,
  Radio,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import {
  WhiteboardToolType,
  StrokeProperties,
  WhiteboardPermissions,
  defaultWhiteboardPermissions,
} from '../../types/whiteboard';
import {
  FabricWhiteboardEngine,
  DEFAULT_STROKE_PROPERTIES,
} from '../../lib/whiteboard/fabric-engine';
import { LaserTrailEngine } from '../../lib/whiteboard/laser-trail';
import { WhiteboardPageManager } from '../../lib/whiteboard/page-manager';
import { getStudentStatusMessage } from '../../lib/whiteboard/permission-guard';
import {
  calculateViewportTransform,
  calculateFitToWidth,
  clampZoom,
  DEFAULT_PORTRAIT_WIDTH,
  DEFAULT_PORTRAIT_HEIGHT,
  ZOOM_PRESETS,
  ViewportBounds,
} from '../../lib/whiteboard/viewport-transform';
import { TouchGestureHandler } from '../../lib/whiteboard/touch-gesture-handler';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { ZoomControls } from './ZoomControls';
import { PageNavigationBar } from './PageNavigationBar';
import { MathEquationModal } from './MathEquationModal';

export interface WhiteboardStageProps {
  engine?: FabricWhiteboardEngine;
  onEngineReady?: (engine: FabricWhiteboardEngine) => void;
  pageManager?: WhiteboardPageManager;
  laserEngine?: LaserTrailEngine;

  // Active Tool & Style State
  activeTool?: WhiteboardToolType;
  onSelectTool?: (tool: WhiteboardToolType) => void;
  strokeProperties?: StrokeProperties;
  onChangeStrokeProperties?: (properties: Partial<StrokeProperties>) => void;

  // Zoom & Pan State
  zoom?: number;
  initialZoom?: number;
  showZoomControls?: boolean;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFitToScreen?: () => void;
  onViewportChange?: (viewport: { zoom: number; panX: number; panY: number }) => void;
  isFollowTeacherEnabled?: boolean;
  onToggleFollowTeacher?: (enabled: boolean) => void;
  remoteViewport?: { zoom: number; panX: number; panY: number };
  minZoom?: number;
  maxZoom?: number;

  // Page Navigation State
  currentPage?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onAddPage?: () => void;
  onToggleThumbnails?: () => void;
  isThumbnailsOpen?: boolean;
  canAddPage?: boolean;

  // User & Permissions
  role?: 'teacher' | 'student';
  userId?: string;
  userName?: string;
  permissions?: WhiteboardPermissions;
  allowedTools?: WhiteboardToolType[];
  readOnly?: boolean;
  showStudentBanner?: boolean;

  // Undo / Redo / Clear Actions
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearPage?: () => void;
  onTriggerReward?: (type: 'star' | 'trophy' | 'fire' | 'heart' | 'sparkles') => void;

  // Laser Pointer
  onLaserMove?: (point: { x: number; y: number }) => void;

  // Viewport / Aspect Ratio mode (LearnCube portrait vs landscape)
  stageAspect?: 'portrait' | '16:9';

  // Container styling
  className?: string;
  style?: React.CSSProperties;
}

export const WhiteboardStage: React.FC<WhiteboardStageProps> = ({
  engine: propEngine,
  onEngineReady,
  pageManager,
  laserEngine: propLaserEngine,
  stageAspect = 'portrait',
  // Tool state
  activeTool: controlledTool,
  onSelectTool,
  strokeProperties: controlledStrokeProps,
  onChangeStrokeProperties,
  // Zoom state
  zoom: controlledZoom,
  initialZoom = 1.25,
  showZoomControls = false,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  onViewportChange,
  isFollowTeacherEnabled = false,
  onToggleFollowTeacher,
  remoteViewport,
  minZoom = 0.2,
  maxZoom = 4.0,
  // Page state
  currentPage = 1,
  totalPages = 1,
  onPageChange,
  onAddPage,
  onToggleThumbnails,
  isThumbnailsOpen = false,
  canAddPage = true,
  // User & Permissions
  role = 'teacher',
  userId = 'user-1',
  userName,
  permissions = defaultWhiteboardPermissions(),
  allowedTools,
  readOnly = false,
  showStudentBanner,
  // Undo/Redo/Clear
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onClearPage,
  onTriggerReward,
  // Laser
  onLaserMove,
  // Styling
  className = '',
  style,
}) => {
  const isTeacher = role === 'teacher';
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const laserCanvasRef = useRef<HTMLCanvasElement>(null);

  // Engines
  const internalEngineRef = useRef<FabricWhiteboardEngine | null>(null);
  const activeEngine = propEngine || internalEngineRef.current;
  const laserEngineRef = useRef<LaserTrailEngine>(
    propLaserEngine || new LaserTrailEngine(1200)
  );

  // Tool state (controlled vs uncontrolled; defaults to 'select' cursor)
  const isControlledTool = controlledTool !== undefined;
  const [internalTool, setInternalTool] = useState<WhiteboardToolType>(controlledTool || 'select');
  const activeTool = isControlledTool ? controlledTool : internalTool;

  // Stroke properties state (controlled vs uncontrolled)
  const isControlledStroke = controlledStrokeProps !== undefined;
  const [internalStrokeProps, setInternalStrokeProps] = useState<StrokeProperties>({
    ...DEFAULT_STROKE_PROPERTIES,
  });
  const strokeProperties = isControlledStroke
    ? controlledStrokeProps
    : internalStrokeProps;

  // Zoom state (controlled vs uncontrolled)
  const isControlledZoom = controlledZoom !== undefined;
  const [internalZoom, setInternalZoom] = useState<number>(initialZoom);
  const zoom = isControlledZoom ? controlledZoom : internalZoom;

  // Viewport Pan Offset & Gestures
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const isPanningRef = useRef<boolean>(false);
  const panStartRef = useRef<{ x: number; y: number; initialPanX: number; initialPanY: number }>({
    x: 0,
    y: 0,
    initialPanX: 0,
    initialPanY: 0,
  });
  const [isSpacePressed, setIsSpacePressed] = useState<boolean>(false);
  const [isShiftPressed, setIsShiftPressed] = useState<boolean>(false);

  // Global Keyboard listener for Spacebar & Shift Panning
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        (e.target as HTMLElement)?.isContentEditable
      ) {
        return;
      }
      if (e.code === 'Space' && !e.repeat) {
        setIsSpacePressed(true);
      }
      if (e.key === 'Shift') {
        setIsShiftPressed(true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpacePressed(false);
      }
      if (e.key === 'Shift') {
        setIsShiftPressed(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  // Native Trackpad Pinch-to-Zoom & Two-Finger Scroll Pan Listener
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Trackpad pinch-to-zoom OR Ctrl + Mouse Wheel
        const factor = Math.exp(-e.deltaY * 0.005);
        const nextZoom = clampZoom(+(zoom * factor).toFixed(2), minZoom, maxZoom);
        if (!isControlledZoom) {
          setInternalZoom(nextZoom);
        }
        onViewportChange?.({ zoom: nextZoom, panX: panOffset.x, panY: panOffset.y });
      } else {
        // Trackpad two-finger scroll OR mouse wheel pan
        setPanOffset((prev) => {
          const nextPanX = prev.x - e.deltaX;
          const nextPanY = prev.y - e.deltaY;
          onViewportChange?.({ zoom, panX: nextPanX, panY: nextPanY });
          return { x: nextPanX, y: nextPanY };
        });
      }
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [zoom, panOffset, minZoom, maxZoom, isControlledZoom, onViewportChange]);

  // LaTeX Math Equation Modal State
  const [isEquationModalOpen, setIsEquationModalOpen] = useState(false);
  const handleInsertEquation = (latex: string, svgDataUrl: string) => {
    if (activeEngine) {
      activeEngine.addMathFormula(latex, svgDataUrl);
    }
  };

  // Viewport bounds for stage calculation (portrait or 16:9)
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    renderedWidth: 0,
    renderedHeight: 0,
    containerWidth: 0,
    containerHeight: 0,
    virtualWidth: stageAspect === '16:9' ? 1920 : DEFAULT_PORTRAIT_WIDTH,
    virtualHeight: stageAspect === '16:9' ? 1080 : DEFAULT_PORTRAIT_HEIGHT,
  });

  // Calculate and update stage dimensions
  const updateLetterboxBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width || container.clientWidth || 0;
    const h = rect.height || container.clientHeight || 0;

    if (w > 0 && h > 0) {
      const vWidth = stageAspect === '16:9' ? 1920 : DEFAULT_PORTRAIT_WIDTH;
      const vHeight = stageAspect === '16:9' ? 1080 : DEFAULT_PORTRAIT_HEIGHT;
      const bounds = calculateViewportTransform(w, h, vWidth, vHeight);
      setViewportBounds(bounds);
      activeEngine?.requestRender();
    }
  }, [activeEngine, stageAspect]);

  useEffect(() => {
    updateLetterboxBounds();

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      resizeObserver = new ResizeObserver(() => {
        updateLetterboxBounds();
      });
      resizeObserver.observe(containerRef.current);
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', updateLetterboxBounds);
    }

    return () => {
      if (resizeObserver) resizeObserver.disconnect();
      if (typeof window !== 'undefined') {
        window.removeEventListener('resize', updateLetterboxBounds);
      }
    };
  }, [updateLetterboxBounds]);

  // Attach canvas to propEngine if provided
  useEffect(() => {
    if (propEngine && canvasRef.current) {
      propEngine.attachCanvas(canvasRef.current);
    }
  }, [propEngine]);

  const onEngineReadyRef = useRef(onEngineReady);
  onEngineReadyRef.current = onEngineReady;

  // Initialize internal FabricWhiteboardEngine if not provided
  useEffect(() => {
    if (propEngine) return;

    if (canvasRef.current && !internalEngineRef.current) {
      const vWidth = stageAspect === '16:9' ? 1920 : DEFAULT_PORTRAIT_WIDTH;
      const vHeight = stageAspect === '16:9' ? 1080 : DEFAULT_PORTRAIT_HEIGHT;
      const engine = new FabricWhiteboardEngine(canvasRef.current, {
        virtualWidth: vWidth,
        virtualHeight: vHeight,
      });
      internalEngineRef.current = engine;
      onEngineReadyRef.current?.(engine);
    }

    return () => {
      if (internalEngineRef.current) {
        internalEngineRef.current.destroy();
        internalEngineRef.current = null;
      }
    };
  }, [propEngine]);

  // Sync activeTool to engine
  useEffect(() => {
    if (activeEngine) {
      activeEngine.setTool(activeTool, strokeProperties);
    }
  }, [activeEngine, activeTool, strokeProperties]);

  // Sync strokeProperties to engine
  useEffect(() => {
    if (activeEngine) {
      activeEngine.setStrokeProperties(strokeProperties);
    }
  }, [activeEngine, strokeProperties]);

  // Tool selection handler
  const handleSelectTool = (tool: WhiteboardToolType) => {
    if (!isControlledTool) {
      setInternalTool(tool);
    }
    onSelectTool?.(tool);
  };

  // Stroke properties change handler
  const handleChangeStrokeProperties = (props: Partial<StrokeProperties>) => {
    if (!isControlledStroke) {
      setInternalStrokeProps((prev) => ({ ...prev, ...props }));
    }
    onChangeStrokeProperties?.(props);
  };

  // Zoom handlers
  const handleZoomIn = () => {
    if (onZoomIn) {
      onZoomIn();
    } else {
      setInternalZoom((prev) => Math.min(maxZoom, +(prev + 0.1).toFixed(2)));
    }
  };

  const handleZoomOut = () => {
    if (onZoomOut) {
      onZoomOut();
    } else {
      setInternalZoom((prev) => Math.max(minZoom, +(prev - 0.1).toFixed(2)));
    }
  };

  const handleResetZoom = () => {
    setPanOffset({ x: 0, y: 0 });
    if (onResetZoom) {
      onResetZoom();
    } else {
      setInternalZoom(1.0);
    }
    onViewportChange?.({ zoom: 1.0, panX: 0, panY: 0 });
  };

  const handleFitToScreen = () => {
    setPanOffset({ x: 0, y: 0 });
    if (onFitToScreen) {
      onFitToScreen();
    } else {
      setInternalZoom(1.0);
    }
    onViewportChange?.({ zoom: 1.0, panX: 0, panY: 0 });
  };

  const handleFitToWidth = useCallback(() => {
    const container = containerRef.current;
    const containerWidth = container ? container.clientWidth || 1200 : 1200;
    const targetWidth = stageAspect === '16:9' ? 1920 : DEFAULT_PORTRAIT_WIDTH;
    const fitScale = calculateFitToWidth(containerWidth, targetWidth, 64);
    setPanOffset({ x: 0, y: 0 });
    if (!isControlledZoom) {
      setInternalZoom(fitScale);
    }
    onViewportChange?.({ zoom: fitScale, panX: 0, panY: 0 });
  }, [stageAspect, isControlledZoom, onViewportChange]);

  // Broadcast teacher viewport changes to students
  useEffect(() => {
    if (isTeacher && onViewportChange) {
      onViewportChange({ zoom, panX: panOffset.x, panY: panOffset.y });
    }
  }, [isTeacher, zoom, panOffset, onViewportChange]);

  // Follow-Teacher Viewport Synchronization effect
  useEffect(() => {
    if (!isTeacher && isFollowTeacherEnabled && remoteViewport) {
      if (remoteViewport.zoom) setInternalZoom(remoteViewport.zoom);
      if (remoteViewport.panX !== undefined && remoteViewport.panY !== undefined) {
        setPanOffset({ x: remoteViewport.panX, y: remoteViewport.panY });
      }
    }
  }, [isTeacher, isFollowTeacherEnabled, remoteViewport]);

  // Page clear handler
  const handleClearPage = () => {
    if (onClearPage) {
      onClearPage();
    } else if (activeEngine) {
      activeEngine.clearCurrentPage(true);
    }
  };

  // Laser Pointer rendering & decaying trail loop
  const renderLaser = useCallback(() => {
    const laserCanvas = laserCanvasRef.current;
    if (!laserCanvas) return;
    try {
      const ctx = laserCanvas.getContext?.('2d');
      if (!ctx) return;

      const points = laserEngineRef.current.getActivePoints();
      ctx.clearRect(0, 0, laserCanvas.width, laserCanvas.height);

      if (points.length === 0) return;

      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      // Fading trajectory lines
      for (let i = 1; i < points.length; i++) {
        const p1 = points[i - 1];
        const p2 = points[i];
        const avgOpacity = ((p1.opacity ?? 1) + (p2.opacity ?? 1)) / 2;

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.strokeStyle = `rgba(239, 68, 68, ${avgOpacity * 0.8})`;
        ctx.lineWidth = Math.max(2, 6 * avgOpacity);
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#ef4444';
        ctx.stroke();
      }

      // Glowing laser dot head
      const head = points[points.length - 1];
      if (head && (head.opacity ?? 1) > 0.05) {
        const headOpacity = head.opacity ?? 1;

        // Outer glow circle
        ctx.beginPath();
        ctx.arc(head.x, head.y, 8, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(239, 68, 68, ${headOpacity * 0.9})`;
        ctx.shadowBlur = 16;
        ctx.shadowColor = '#f87171';
        ctx.fill();

        // Inner white core
        ctx.beginPath();
        ctx.arc(head.x, head.y, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${headOpacity})`;
        ctx.fill();
      }

      ctx.restore();
    } catch {}
  }, []);

  useEffect(() => {
    let animId: number;
    const loop = () => {
      const points = laserEngineRef.current.getActivePoints();
      if (points.length > 0) {
        renderLaser();
      } else {
        const laserCanvas = laserCanvasRef.current;
        if (laserCanvas) {
          try {
            const ctx = laserCanvas.getContext?.('2d');
            ctx?.clearRect(0, 0, laserCanvas.width, laserCanvas.height);
          } catch {}
        }
      }
      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => {
      if (typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(animId);
      }
    };
  }, [renderLaser]);

  // Extract coordinates safely across pointer, mouse, touch, and synthetic events
  const getCoordinatesFromEvent = (e: any): { clientX: number; clientY: number } => {
    let clientX = e.clientX;
    let clientY = e.clientY;

    if ((clientX === undefined || isNaN(clientX)) && e.nativeEvent) {
      clientX = e.nativeEvent.clientX;
      clientY = e.nativeEvent.clientY;
    }
    if ((clientX === undefined || isNaN(clientX)) && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    }
    return {
      clientX: typeof clientX === 'number' && !isNaN(clientX) ? clientX : 0,
      clientY: typeof clientY === 'number' && !isNaN(clientY) ? clientY : 0,
    };
  };

  // Dynamic check for panning gesture or active pan tool
  const isPanActive = useCallback(
    (e: any) => {
      return (
        activeTool === 'pan' ||
        isSpacePressed ||
        isShiftPressed ||
        e.button === 1 ||
        (typeof e.buttons === 'number' && (e.buttons & 4) === 4)
      );
    },
    [activeTool, isSpacePressed, isShiftPressed]
  );

  // Pointer & Touch handlers on canvas
  const handlePointerDown = (e: any) => {
    if (isPanActive(e)) {
      isPanningRef.current = true;
      const { clientX, clientY } = getCoordinatesFromEvent(e);
      panStartRef.current = {
        x: clientX,
        y: clientY,
        initialPanX: panOffset.x,
        initialPanY: panOffset.y,
      };
      return;
    }
    if (activeTool === 'laser') {
      const { clientX, clientY } = getCoordinatesFromEvent(e);
      trackLaserPoint(clientX, clientY);
    }
  };

  // RAF throttling refs for high INP reduction during drag and pan
  const rafPanRef = useRef<number | null>(null);
  const pendingPanRef = useRef<{ x: number; y: number } | null>(null);

  const handlePointerMove = (e: any) => {
    if (isPanningRef.current) {
      const { clientX, clientY } = getCoordinatesFromEvent(e);
      const dx = clientX - panStartRef.current.x;
      const dy = clientY - panStartRef.current.y;
      const nextPanX = panStartRef.current.initialPanX + dx;
      const nextPanY = panStartRef.current.initialPanY + dy;
      pendingPanRef.current = { x: nextPanX, y: nextPanY };

      if (!rafPanRef.current) {
        if (typeof requestAnimationFrame !== 'undefined') {
          rafPanRef.current = requestAnimationFrame(() => {
            rafPanRef.current = null;
            if (pendingPanRef.current) {
              setPanOffset(pendingPanRef.current);
              onViewportChange?.({ zoom, panX: pendingPanRef.current.x, panY: pendingPanRef.current.y });
            }
          });
        } else {
          setPanOffset(pendingPanRef.current);
          onViewportChange?.({ zoom, panX: pendingPanRef.current.x, panY: pendingPanRef.current.y });
        }
      }
      return;
    }
    if (activeTool === 'laser') {
      const { clientX, clientY } = getCoordinatesFromEvent(e);
      trackLaserPoint(clientX, clientY);
    }
  };

  const handlePointerUp = () => {
    if (isPanningRef.current) {
      isPanningRef.current = false;
      if (rafPanRef.current && typeof cancelAnimationFrame !== 'undefined') {
        cancelAnimationFrame(rafPanRef.current);
        rafPanRef.current = null;
      }
      if (pendingPanRef.current) {
        setPanOffset(pendingPanRef.current);
        onViewportChange?.({ zoom, panX: pendingPanRef.current.x, panY: pendingPanRef.current.y });
      }
    }
  };

  const touchHandlerRef = useRef<TouchGestureHandler | null>(null);
  if (!touchHandlerRef.current) {
    touchHandlerRef.current = new TouchGestureHandler();
  }

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const handler = touchHandlerRef.current;
    if (!handler) return;
    const classification = handler.handleTouchStart(e.touches as any);
    if (classification === 'draw') {
      if (activeTool === 'laser' && e.touches.length > 0) {
        const touch = e.touches[0];
        trackLaserPoint(touch.clientX, touch.clientY);
      }
      // Single-finger touch: allow active drawing tool to proceed without being swallowed
      return;
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    const handler = touchHandlerRef.current;
    if (!handler) return;
    const result = handler.handleTouchMove(e.touches as any);
    if (result.classification === 'draw') {
      if (activeTool === 'laser' && e.touches.length > 0) {
        const touch = e.touches[0];
        trackLaserPoint(touch.clientX, touch.clientY);
      }
      // Ensure drawing touches are not swallowed
      return;
    } else if (result.classification === 'pinch-zoom' && result.pinchDelta) {
      const nextZoom = clampZoom(+(zoom * result.pinchDelta.scaleDelta).toFixed(2), minZoom, maxZoom);
      if (!isControlledZoom) {
        setInternalZoom(nextZoom);
      }
    }
  };

  const handleTouchEnd = () => {
    touchHandlerRef.current?.handleTouchEnd();
  };

  const trackLaserPoint = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const vWidth = stageAspect === '16:9' ? 1920 : DEFAULT_PORTRAIT_WIDTH;
    const vHeight = stageAspect === '16:9' ? 1080 : DEFAULT_PORTRAIT_HEIGHT;
    const rectWidth =
      rect && rect.width > 0
        ? rect.width
        : canvas.clientWidth > 0
        ? canvas.clientWidth
        : vWidth;
    const rectHeight =
      rect && rect.height > 0
        ? rect.height
        : canvas.clientHeight > 0
        ? canvas.clientHeight
        : vHeight;
    const rectLeft =
      rect && typeof rect.left === 'number' && !isNaN(rect.left) ? rect.left : 0;
    const rectTop =
      rect && typeof rect.top === 'number' && !isNaN(rect.top) ? rect.top : 0;

    const scaleX = vWidth / rectWidth;
    const scaleY = vHeight / rectHeight;
    const x = Math.round((clientX - rectLeft) * scaleX);
    const y = Math.round((clientY - rectTop) * scaleY);

    laserEngineRef.current.addPoint(x, y);
    onLaserMove?.({ x, y });
    renderLaser();
  };

  // Student Status Banner computation
  const shouldRenderBanner =
    showStudentBanner !== undefined
      ? showStudentBanner
      : !isTeacher && Boolean(permissions);

  const studentStatus = permissions
    ? getStudentStatusMessage(permissions, userId)
    : null;

  // Banner status styling
  const getBannerBadge = () => {
    if (!studentStatus) return null;
    if (studentStatus.toLowerCase().includes('locked')) {
      return {
        icon: <Lock className="w-3.5 h-3.5 text-rose-400" />,
        style:
          'bg-rose-950/85 text-rose-200 border-rose-500/40 shadow-rose-950/50',
      };
    }
    if (studentStatus.toLowerCase().includes('laser')) {
      return {
        icon: <Radio className="w-3.5 h-3.5 text-amber-400 animate-pulse" />,
        style:
          'bg-amber-950/85 text-amber-200 border-amber-500/40 shadow-amber-950/50',
      };
    }
    if (studentStatus.toLowerCase().includes('granted')) {
      return {
        icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
        style:
          'bg-emerald-950/85 text-emerald-200 border-emerald-500/40 shadow-emerald-950/50',
      };
    }
    return {
      icon: <Sparkles className="w-3.5 h-3.5 text-indigo-400" />,
      style:
        'bg-indigo-950/85 text-indigo-200 border-indigo-500/40 shadow-indigo-950/50',
    };
  };

  const bannerBadge = getBannerBadge();

  // Dynamic canvas cursor mapping based on active tool and gesture states
  const getToolCursorClass = (tool: WhiteboardToolType) => {
    if (isPanningRef.current) {
      return 'cursor-grabbing';
    }
    if (tool === 'pan' || isSpacePressed || isShiftPressed) {
      return 'cursor-grab';
    }
    switch (tool) {
      case 'select':
        return 'cursor-default';
      case 'text':
        return 'cursor-text';
      case 'sticky':
        return 'cursor-copy';
      case 'eraser':
        return 'cursor-cell';
      case 'laser':
        return 'cursor-none';
      case 'pen':
      case 'pencil':
      case 'highlighter':
      case 'rect':
      case 'circle':
      case 'triangle':
      case 'line':
      case 'arrow':
      default:
        return 'cursor-crosshair';
    }
  };

  return (
    <div
      ref={containerRef}
      data-testid="whiteboard-stage"
      className={`relative w-full h-full flex items-center justify-center overflow-auto select-none bg-stone-100/90 pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] ${className}`}
      style={style}
      onPointerDown={(e) => {
        handlePointerDown(e);
        if (e.target !== canvasRef.current && canvasRef.current && activeEngine) {
          try {
            const synthetic = new PointerEvent('pointerdown', {
              clientX: e.clientX,
              clientY: e.clientY,
              button: e.button,
              buttons: e.buttons,
              bubbles: true,
              pointerId: e.pointerId,
            });
            canvasRef.current.dispatchEvent(synthetic);
          } catch {}
        }
      }}
      onPointerMove={(e) => {
        handlePointerMove(e);
        if (e.target !== canvasRef.current && canvasRef.current && activeEngine) {
          try {
            const synthetic = new PointerEvent('pointermove', {
              clientX: e.clientX,
              clientY: e.clientY,
              button: e.button,
              buttons: e.buttons,
              bubbles: true,
              pointerId: e.pointerId,
            });
            canvasRef.current.dispatchEvent(synthetic);
          } catch {}
        }
      }}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* Canonical Canvas Stage Wrapper with Infinite Pan and Zoom */}
      <div
        data-testid="canvas-stage-wrapper"
        className="relative flex items-center justify-center transition-transform duration-75 ease-out overflow-visible my-auto"
        style={{
          aspectRatio: stageAspect === '16:9' ? '16 / 9' : '3 / 4',
          width:
            viewportBounds.renderedWidth > 0
              ? `${viewportBounds.renderedWidth}px`
              : '100%',
          height:
            viewportBounds.renderedHeight > 0
              ? `${viewportBounds.renderedHeight}px`
              : 'auto',
          maxWidth: '100%',
          maxHeight: '100%',
          transform:
            panOffset.x || panOffset.y
              ? `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`
              : `scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Fabric Vector Canvas */}
        <canvas
          ref={canvasRef}
          data-testid="whiteboard-canvas"
          width={stageAspect === '16:9' ? 1920 : DEFAULT_PORTRAIT_WIDTH}
          height={stageAspect === '16:9' ? 1080 : DEFAULT_PORTRAIT_HEIGHT}
          className={`w-full h-full block bg-white rounded-xl shadow-xl shadow-stone-900/10 border border-stone-200/80 touch-none ${getToolCursorClass(
            activeTool
          )}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onMouseUp={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        />

        {/* Transient Laser Pointer Decaying Trajectory Overlay */}
        <canvas
          ref={laserCanvasRef}
          data-testid="laser-overlay"
          width={stageAspect === '16:9' ? 1920 : DEFAULT_PORTRAIT_WIDTH}
          height={stageAspect === '16:9' ? 1080 : DEFAULT_PORTRAIT_HEIGHT}
          className="absolute inset-0 pointer-events-none w-full h-full z-10"
        />
      </div>

      {/* Student Status Banner */}
      {shouldRenderBanner && studentStatus && bannerBadge && (
        <aside
          role="status"
          aria-live="polite"
          data-testid="student-status-banner"
          className={`absolute top-4 left-4 z-30 flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium tracking-wide shadow-lg border backdrop-blur-[16px] transition-all duration-200 select-none ${bannerBadge.style}`}
        >
          {bannerBadge.icon}
          <span>{studentStatus}</span>
        </aside>
      )}

      {/* Floating Page Navigation Bar */}
      <PageNavigationBar
        currentPage={currentPage}
        totalPages={totalPages}
        onPageChange={onPageChange || (() => {})}
        onAddPage={onAddPage}
        onToggleThumbnails={onToggleThumbnails}
        isThumbnailsOpen={isThumbnailsOpen}
        canAddPage={canAddPage && isTeacher}
      />

      {/* Floating Zoom Controls (removed by default for uncluttered canvas, enabled when showZoomControls=true) */}
      {showZoomControls && (
        <ZoomControls
          zoom={zoom}
          onZoomIn={handleZoomIn}
          onZoomOut={handleZoomOut}
          onResetZoom={handleResetZoom}
          onFitToScreen={handleFitToScreen}
          onFitToWidth={handleFitToWidth}
          onSelectPreset={(preset) => {
            setPanOffset({ x: 0, y: 0 });
            if (!isControlledZoom) {
              setInternalZoom(preset);
            }
            onViewportChange?.({ zoom: preset, panX: 0, panY: 0 });
          }}
          isFollowTeacherEnabled={isFollowTeacherEnabled}
          onToggleFollowTeacher={onToggleFollowTeacher}
          isTeacher={isTeacher}
          minZoom={minZoom}
          maxZoom={maxZoom}
        />
      )}

      {/* Floating Glass Toolset Toolbar */}
      <WhiteboardToolbar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        strokeProperties={strokeProperties}
        onChangeStrokeProperties={handleChangeStrokeProperties}
        canUndo={canUndo || Boolean(activeEngine && activeEngine.getObjects().length > 0)}
        canRedo={canRedo}
        onUndo={() => {
          if (onUndo) {
            onUndo();
          } else if (activeEngine) {
            const objs = activeEngine.getObjects();
            if (objs.length > 0) {
              activeEngine.removeObject(objs[objs.length - 1].id);
            }
          }
        }}
        onRedo={onRedo}
        onClearPage={handleClearPage}
        allowedTools={allowedTools}
        onTriggerReward={onTriggerReward}
        onOpenEquationModal={() => setIsEquationModalOpen(true)}
        isTeacher={isTeacher}
        readOnly={readOnly}
      />

      {/* LaTeX Math Formula Modal */}
      <MathEquationModal
        isOpen={isEquationModalOpen}
        onClose={() => setIsEquationModalOpen(false)}
        onInsertEquation={handleInsertEquation}
      />
    </div>
  );
};
