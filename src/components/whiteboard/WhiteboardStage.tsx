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
  clampZoom,
  ViewportBounds,
} from '../../lib/whiteboard/viewport-transform';
import { TouchGestureHandler } from '../../lib/whiteboard/touch-gesture-handler';
import { WhiteboardToolbar } from './WhiteboardToolbar';
import { ZoomControls } from './ZoomControls';
import { PageNavigationBar } from './PageNavigationBar';

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
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onResetZoom?: () => void;
  onFitToScreen?: () => void;
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

  // Container styling
  className?: string;
  style?: React.CSSProperties;
}

export const WhiteboardStage: React.FC<WhiteboardStageProps> = ({
  engine: propEngine,
  onEngineReady,
  pageManager,
  laserEngine: propLaserEngine,
  // Tool state
  activeTool: controlledTool,
  onSelectTool,
  strokeProperties: controlledStrokeProps,
  onChangeStrokeProperties,
  // Zoom state
  zoom: controlledZoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
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

  // Tool state (controlled vs uncontrolled)
  const isControlledTool = controlledTool !== undefined;
  const [internalTool, setInternalTool] = useState<WhiteboardToolType>(controlledTool || 'pen');
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
  const [internalZoom, setInternalZoom] = useState<number>(1.0);
  const zoom = isControlledZoom ? controlledZoom : internalZoom;

  // Viewport bounds for 16:9 letterbox calculation
  const [viewportBounds, setViewportBounds] = useState<ViewportBounds>({
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    renderedWidth: 0,
    renderedHeight: 0,
    containerWidth: 0,
    containerHeight: 0,
    virtualWidth: 1920,
    virtualHeight: 1080,
  });

  // Calculate and update 16:9 letterbox dimensions
  const updateLetterboxBounds = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;

    const rect = container.getBoundingClientRect();
    const w = rect.width || container.clientWidth || 0;
    const h = rect.height || container.clientHeight || 0;

    if (w > 0 && h > 0) {
      const bounds = calculateViewportTransform(w, h, 1920, 1080);
      setViewportBounds(bounds);
      activeEngine?.requestRender();
    }
  }, [activeEngine]);

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

  // Initialize internal FabricWhiteboardEngine if not provided
  useEffect(() => {
    if (propEngine) return;

    if (canvasRef.current && !internalEngineRef.current) {
      const engine = new FabricWhiteboardEngine(canvasRef.current, {
        virtualWidth: 1920,
        virtualHeight: 1080,
      });
      internalEngineRef.current = engine;
      onEngineReady?.(engine);
    }

    return () => {
      if (internalEngineRef.current) {
        internalEngineRef.current.destroy();
        internalEngineRef.current = null;
      }
    };
  }, [propEngine, onEngineReady]);

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
    if (onResetZoom) {
      onResetZoom();
    } else {
      setInternalZoom(1.0);
    }
  };

  const handleFitToScreen = () => {
    if (onFitToScreen) {
      onFitToScreen();
    } else {
      setInternalZoom(1.0);
    }
  };

  // Follow-Teacher Viewport Synchronization effect
  useEffect(() => {
    if (!isTeacher && isFollowTeacherEnabled && remoteViewport?.zoom) {
      setInternalZoom(remoteViewport.zoom);
    }
  }, [isTeacher, isFollowTeacherEnabled, remoteViewport?.zoom]);

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

  // Pointer & Touch handlers on canvas
  const handlePointerDown = (e: any) => {
    if (activeTool === 'laser') {
      const { clientX, clientY } = getCoordinatesFromEvent(e);
      trackLaserPoint(clientX, clientY);
    }
  };

  const handlePointerMove = (e: any) => {
    if (activeTool === 'laser') {
      const { clientX, clientY } = getCoordinatesFromEvent(e);
      trackLaserPoint(clientX, clientY);
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
    const rectWidth =
      rect && rect.width > 0
        ? rect.width
        : canvas.clientWidth > 0
        ? canvas.clientWidth
        : 1920;
    const rectHeight =
      rect && rect.height > 0
        ? rect.height
        : canvas.clientHeight > 0
        ? canvas.clientHeight
        : 1080;
    const rectLeft =
      rect && typeof rect.left === 'number' && !isNaN(rect.left) ? rect.left : 0;
    const rectTop =
      rect && typeof rect.top === 'number' && !isNaN(rect.top) ? rect.top : 0;

    const scaleX = 1920 / rectWidth;
    const scaleY = 1080 / rectHeight;
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

  // Dynamic canvas cursor mapping based on active tool
  const getToolCursorClass = (tool: WhiteboardToolType) => {
    switch (tool) {
      case 'select':
        return 'cursor-default';
      case 'pan':
        return 'cursor-grab';
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
      className={`relative w-full h-full flex items-center justify-center overflow-hidden select-none bg-[#090a0f] pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] pl-[env(safe-area-inset-left,0px)] pr-[env(safe-area-inset-right,0px)] ${className}`}
      style={style}
    >
      {/* 16:9 Canonical Canvas Stage Wrapper */}
      <div
        data-testid="canvas-stage-wrapper"
        className="relative flex items-center justify-center transition-transform duration-150 ease-out shadow-2xl"
        style={{
          aspectRatio: '16 / 9',
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
          transform: `scale(${zoom})`,
          transformOrigin: 'center center',
        }}
      >
        {/* Fabric Vector Canvas */}
        <canvas
          ref={canvasRef}
          data-testid="whiteboard-canvas"
          width={1920}
          height={1080}
          className={`w-full h-full block bg-white rounded-lg shadow-inner touch-none ${getToolCursorClass(
            activeTool
          )}`}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onMouseDown={handlePointerDown}
          onMouseMove={handlePointerMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchEnd}
        />

        {/* Transient Laser Pointer Decaying Trajectory Overlay */}
        <canvas
          ref={laserCanvasRef}
          data-testid="laser-overlay"
          width={1920}
          height={1080}
          className="absolute inset-0 pointer-events-none w-full h-full z-10 rounded-lg"
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

      {/* Floating Zoom Controls */}
      <ZoomControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitToScreen={handleFitToScreen}
        isFollowTeacherEnabled={isFollowTeacherEnabled}
        onToggleFollowTeacher={onToggleFollowTeacher}
        isTeacher={isTeacher}
        minZoom={minZoom}
        maxZoom={maxZoom}
      />

      {/* Floating Glass Toolset Toolbar */}
      <WhiteboardToolbar
        activeTool={activeTool}
        onSelectTool={handleSelectTool}
        strokeProperties={strokeProperties}
        onChangeStrokeProperties={handleChangeStrokeProperties}
        canUndo={canUndo}
        canRedo={canRedo}
        onUndo={onUndo}
        onRedo={onRedo}
        onClearPage={handleClearPage}
        allowedTools={allowedTools}
        onTriggerReward={onTriggerReward}
        isTeacher={isTeacher}
        readOnly={readOnly}
      />
    </div>
  );
};
