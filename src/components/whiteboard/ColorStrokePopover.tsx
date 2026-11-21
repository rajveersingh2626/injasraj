import React, { useEffect, useRef } from 'react';
import { StrokeProperties } from '../../types/whiteboard';

export interface ColorStrokePopoverProps {
  isOpen: boolean;
  onClose?: () => void;
  strokeProperties: StrokeProperties;
  onChange: (properties: Partial<StrokeProperties>) => void;
  className?: string;
  position?: 'top' | 'bottom';
  align?: 'center' | 'left' | 'right';
}

export const COLOR_SWATCHES = [
  { hex: '#000000', name: 'Black' },
  { hex: '#3b82f6', name: 'Blue' },
  { hex: '#ef4444', name: 'Red' },
  { hex: '#10b981', name: 'Emerald' },
  { hex: '#f59e0b', name: 'Amber' },
  { hex: '#8b5cf6', name: 'Purple' },
  { hex: '#ffffff', name: 'White' },
];

export const STROKE_WIDTH_PRESETS = [
  { width: 2, label: 'Fine', px: '2px' },
  { width: 4, label: 'Medium', px: '4px' },
  { width: 8, label: 'Bold', px: '8px' },
  { width: 16, label: 'Highlighter', px: '16px' },
];

export const ColorStrokePopover: React.FC<ColorStrokePopoverProps> = ({
  isOpen,
  onClose,
  strokeProperties,
  onChange,
  className = '',
  position = 'top',
  align = 'center',
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose?.();
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose?.();
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const currentColor = strokeProperties.color.toLowerCase();
  const currentWidth = strokeProperties.width;

  // Origin-aware transform origin based on positioning
  const originClass =
    position === 'top'
      ? align === 'left'
        ? 'origin-bottom-left'
        : align === 'right'
        ? 'origin-bottom-right'
        : 'origin-bottom'
      : align === 'left'
      ? 'origin-top-left'
      : align === 'right'
      ? 'origin-top-right'
      : 'origin-top';

  const positionClass =
    position === 'top' ? 'bottom-full mb-3' : 'top-full mt-3';

  const alignClass =
    align === 'left'
      ? 'left-0'
      : align === 'right'
      ? 'right-0'
      : 'left-1/2 -translate-x-1/2';

  const emilSpringEasing = 'cubic-bezier(0.23, 1, 0.32, 1)';

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="Color and Stroke Properties"
      data-testid="color-stroke-popover"
      className={`absolute z-50 ${positionClass} ${alignClass} ${originClass} select-none ${className}`}
      style={{
        animation: 'colorStrokePopoverEnter 160ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
        transformOrigin: position === 'top' ? 'bottom center' : 'top center',
      }}
    >
      <style>{`
        @keyframes colorStrokePopoverEnter {
          from {
            opacity: 0;
            transform: scale(0.95);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
      <div
        className="rounded-2xl p-3 border border-[rgba(255,255,255,0.08)] backdrop-blur-[16px] text-zinc-100 flex flex-col gap-3 min-w-[220px]"
        style={{
          background: 'rgba(18, 18, 24, 0.85)',
          boxShadow:
            'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 12px 36px -4px rgba(0, 0, 0, 0.6)',
        }}
      >
        {/* Color Palette Section */}
        <div>
          <div className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase mb-2 px-0.5">
            Color
          </div>
          <div className="grid grid-cols-7 gap-1.5" role="radiogroup" aria-label="Color Swatches">
            {COLOR_SWATCHES.map((swatch) => {
              const isSelected = currentColor === swatch.hex.toLowerCase();
              return (
                <button
                  key={swatch.hex}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${swatch.name} (${swatch.hex})`}
                  data-testid={`color-swatch-${swatch.hex.replace('#', '')}`}
                  onClick={() => onChange({ color: swatch.hex })}
                  style={{
                    backgroundColor: swatch.hex,
                    transition: `transform 160ms ${emilSpringEasing}, box-shadow 160ms ease, ring 160ms ease`,
                    touchAction: 'manipulation',
                  }}
                  className={`w-7 h-7 rounded-full relative cursor-pointer active:scale-[0.95] border border-white/20 transition-all flex items-center justify-center ${
                    isSelected
                      ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-[#121218] scale-110 shadow-[0_0_12px_rgba(99,102,241,0.5)]'
                      : 'hover:scale-110 opacity-90 hover:opacity-100'
                  }`}
                >
                  {isSelected && (
                    <span
                      className={`w-2 h-2 rounded-full ${
                        swatch.hex.toLowerCase() === '#ffffff' ? 'bg-zinc-900' : 'bg-white'
                      } shadow-sm`}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Separator */}
        <div className="h-[1px] bg-white/[0.08] w-full" />

        {/* Stroke Width Section */}
        <div>
          <div className="text-[11px] font-medium tracking-wider text-zinc-400 uppercase mb-2 px-0.5">
            Stroke Width
          </div>
          <div className="grid grid-cols-4 gap-1.5" role="radiogroup" aria-label="Stroke Width Presets">
            {STROKE_WIDTH_PRESETS.map((preset) => {
              const isSelected = currentWidth === preset.width;
              return (
                <button
                  key={preset.width}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  aria-label={`${preset.label} (${preset.px})`}
                  data-testid={`stroke-width-${preset.width}`}
                  onClick={() => onChange({ width: preset.width })}
                  style={{
                    transition: `transform 160ms ${emilSpringEasing}, background 160ms ease, border-color 160ms ease`,
                    touchAction: 'manipulation',
                  }}
                  className={`py-1.5 px-2 rounded-lg flex flex-col items-center justify-center gap-1.5 border text-xs cursor-pointer active:scale-[0.97] ${
                    isSelected
                      ? 'bg-white/15 border-white/30 text-white font-medium shadow-sm'
                      : 'bg-white/5 border-transparent text-zinc-400 hover:bg-white/10 hover:text-zinc-200'
                  }`}
                >
                  <span
                    className="rounded-full bg-current transition-all"
                    style={{
                      width: Math.min(Math.max(preset.width, 2), 12),
                      height: Math.min(Math.max(preset.width, 2), 12),
                    }}
                  />
                  <span className="text-[10px] leading-none">{preset.px}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ColorStrokePopover;
