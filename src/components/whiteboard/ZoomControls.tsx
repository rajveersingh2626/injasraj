import React, { useState, useRef, useEffect } from 'react';
import { Minus, Plus, Maximize2, Eye, ChevronUp } from 'lucide-react';
import { ZOOM_PRESETS } from '../../lib/whiteboard/viewport-transform';

export interface ZoomControlsProps {
  zoom: number; // Scale factor, e.g. 1.0 = 100%
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom?: () => void;
  onFitToScreen?: () => void;
  onFitToWidth?: () => void;
  onSelectPreset?: (preset: number) => void;
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
  onFitToWidth,
  onSelectPreset,
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
  const [isPresetsOpen, setIsPresetsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsPresetsOpen(false);
      }
    };
    if (isPresetsOpen) {
      document.addEventListener('pointerdown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('pointerdown', handleClickOutside);
    };
  }, [isPresetsOpen]);

  const emilSpringEasing = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const buttonStyle: React.CSSProperties = {
    transition: `transform 160ms ${emilSpringEasing}, background 160ms ease, border-color 160ms ease, color 160ms ease`,
    touchAction: 'manipulation',
  };

  const handleFitClick = () => {
    if (onFitToWidth) {
      onFitToWidth();
    } else if (onFitToScreen) {
      onFitToScreen();
    }
  };

  return (
    <div
      ref={containerRef}
      role="toolbar"
      aria-label="Zoom Controls"
      data-testid="zoom-controls"
      className={`absolute bottom-4 left-4 z-30 flex items-center gap-1 p-1.5 rounded-2xl border border-stone-200/90 dark:border-stone-800 bg-white/95 backdrop-blur-[16px] select-none text-stone-700 shadow-xl shadow-stone-900/5 ${className}`}
      style={{
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.8), 0 8px 32px -4px rgba(28, 25, 23, 0.08)',
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
        className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
      >
        <Minus className="w-4 h-4" />
      </button>

      {/* Current Zoom Percentage & Preset Trigger */}
      <div className="relative">
        <button
          type="button"
          onClick={() => {
            if (onResetZoom) {
              onResetZoom();
            }
          }}
          onContextMenu={(e) => {
            e.preventDefault();
            setIsPresetsOpen((prev) => !prev);
          }}
          aria-label="Reset zoom to 100%"
          data-testid="zoom-percentage-btn"
          title="Click to reset zoom to 100%"
          style={buttonStyle}
          className="px-2 h-8 rounded-xl flex items-center justify-center text-xs font-mono font-medium tracking-tight text-stone-800 cursor-pointer active:scale-95 hover:bg-stone-100 hover:text-stone-950"
        >
          <span>{percentage}%</span>
        </button>

        {/* Zoom Presets Floating Menu */}
        {isPresetsOpen && (
          <div
            data-testid="zoom-presets-menu"
            className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 p-1.5 rounded-xl bg-white border border-stone-200 shadow-xl flex flex-col gap-1 min-w-[100px] z-40 text-xs font-medium"
          >
            <button
              type="button"
              onClick={() => {
                handleFitClick();
                setIsPresetsOpen(false);
              }}
              className="px-2.5 py-1.5 rounded-lg text-left hover:bg-stone-100 text-stone-700"
            >
              Fit Width
            </button>
            {ZOOM_PRESETS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => {
                  onSelectPreset?.(p);
                  setIsPresetsOpen(false);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-left hover:bg-stone-100 ${
                  Math.round(zoom * 100) === Math.round(p * 100)
                    ? 'font-semibold text-emerald-600 bg-emerald-50'
                    : 'text-stone-700'
                }`}
              >
                {Math.round(p * 100)}%
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Zoom In Button */}
      <button
        type="button"
        onClick={onZoomIn}
        disabled={!canZoomIn}
        aria-label="Zoom in"
        data-testid="zoom-in-btn"
        style={buttonStyle}
        className="w-8 h-8 rounded-xl flex items-center justify-center cursor-pointer active:scale-95 text-stone-600 hover:bg-stone-100 hover:text-stone-900 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
      >
        <Plus className="w-4 h-4" />
      </button>

      {/* Separator */}
      <div className="w-[1px] h-4 bg-stone-200 mx-0.5" />

      {/* Fit to Width / Screen Button */}
      <button
        type="button"
        onClick={handleFitClick}
        aria-label="Fit to screen"
        data-testid="zoom-fit-btn"
        title="Fit to width"
        style={buttonStyle}
        className="px-2.5 h-8 rounded-xl flex items-center justify-center gap-1 text-xs font-medium cursor-pointer active:scale-[0.97] text-stone-700 hover:bg-stone-100 hover:text-stone-900"
      >
        <Maximize2 className="w-3.5 h-3.5" />
        <span>Fit</span>
      </button>

      {/* Follow Teacher Button (Students only) */}
      {!isTeacher && onToggleFollowTeacher && (
        <>
          <div className="w-[1px] h-4 bg-stone-200 mx-0.5" />
          <button
            type="button"
            onClick={() => onToggleFollowTeacher(!isFollowTeacherEnabled)}
            aria-label="Follow Teacher"
            data-testid="follow-teacher-btn"
            title="Sync zoom & pan with teacher"
            style={buttonStyle}
            className={`px-2.5 h-8 rounded-xl flex items-center justify-center gap-1.5 text-xs font-medium cursor-pointer active:scale-[0.97] transition-all duration-150 ${
              isFollowTeacherEnabled
                ? 'bg-amber-100 text-amber-900 border border-amber-300 shadow-sm active-follow font-semibold'
                : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800'
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
