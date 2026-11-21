import React from 'react';
import { Minus, Plus, Maximize2, Eye } from 'lucide-react';

export interface ZoomControlsProps {
  zoom: number; // Scale factor, e.g. 1.0 = 100%
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom?: () => void;
  onFitToScreen?: () => void;
  isFollowTeacherEnabled?: boolean;
  onToggleFollowTeacher?: (enabled: boolean) => void;
  isTeacher?: boolean;
  minZoom?: number;
  maxZoom?: number;
  className?: string;
}

export const ZoomControls: React.FC<ZoomControlsProps> = ({
  zoom,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onFitToScreen,
  isFollowTeacherEnabled = false,
  onToggleFollowTeacher,
  isTeacher = false,
  minZoom = 0.1,
  maxZoom = 5.0,
  className = '',
}) => {
  const percentage = Math.round(zoom * 100);
  const canZoomOut = zoom > minZoom;
  const canZoomIn = zoom < maxZoom;

  const emilSpringEasing = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const buttonStyle: React.CSSProperties = {
    transition: `transform 160ms ${emilSpringEasing}, background 160ms ease, border-color 160ms ease, color 160ms ease`,
    touchAction: 'manipulation',
  };

  return (
    <div
      role="toolbar"
      aria-label="Zoom Controls"
      data-testid="zoom-controls"
      className={`absolute bottom-4 left-4 z-30 flex items-center gap-1 p-1.5 rounded-2xl border border-stone-800 bg-stone-900/95 backdrop-blur-[16px] select-none text-stone-200 shadow-xl ${className}`}
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.08), 0 8px 32px -4px rgba(0, 0, 0, 0.48)',
      }}
    >
      {/* Zoom Out Button */}
      <button
        type="button"
        onClick={onZoomOut}
        disabled={!canZoomOut}
        aria-label="Zoom out"
        data-testid="zoom-out-btn"
        style={buttonStyle}
        className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 hover:bg-stone-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
      >
        <Minus className="w-4 h-4" />
      </button>

      {/* Current Zoom Percentage (click to reset) */}
      <button
        type="button"
        onClick={onResetZoom}
        aria-label="Reset zoom to 100%"
        data-testid="zoom-percentage-btn"
        title="Click to reset zoom to 100%"
        style={buttonStyle}
        className="px-2 h-8 rounded-xl flex items-center justify-center text-xs font-mono font-medium tracking-tight text-stone-300 cursor-pointer active:scale-95 hover:bg-stone-800 hover:text-white"
      >
        <span>{percentage}%</span>
      </button>

      {/* Zoom In Button */}
      <button
        type="button"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        data-testid="zoom-in-btn"
        style={buttonStyle}
        className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 hover:bg-stone-800 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Separator */}
      <div className="w-[1px] h-4 bg-white/[0.08] mx-0.5" />

      {/* Fit to Screen Button */}
      <button
        type="button"
        onClick={onFitToScreen}
        aria-label="Fit to screen"
        data-testid="zoom-fit-btn"
        title="Fit to screen"
        style={buttonStyle}
        className="px-2.5 h-8 rounded-xl flex items-center justify-center gap-1 text-xs font-medium cursor-pointer active:scale-[0.97] hover:bg-white/10 hover:text-white"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span>Fit</span>
      </button>

      {/* Follow Teacher Button (Students only) */}
      {!isTeacher && onToggleFollowTeacher && (
        <>
          <div className="w-[1px] h-4 bg-white/[0.08] mx-0.5" />
          <button
            type="button"
            onClick={() => onToggleFollowTeacher(!isFollowTeacherEnabled)}
            aria-label="Follow Teacher"
            data-testid="follow-teacher-btn"
            title="Sync zoom & pan with teacher"
            style={buttonStyle}
            className={`px-2.5 h-8 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer active:scale-[0.97] transition-all duration-150 ${
              isFollowTeacherEnabled
                ? 'bg-amber-600/30 text-amber-300 border border-amber-500/40 active-follow'
                : 'text-zinc-400 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Follow</span>
          </button>
        </>
      )}
    </div>
  );
};

export default ZoomControls;
