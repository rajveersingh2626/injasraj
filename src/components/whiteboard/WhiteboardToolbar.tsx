import React, { useState, useRef, useEffect } from 'react';
import {
  MousePointer,
  Hand,
  Pen,
  Pencil,
  Highlighter,
  Eraser,
  Shapes,
  Square,
  Circle,
  Triangle,
  Minus,
  ArrowRight,
  Type,
  StickyNote,
  Radio,
  Undo2,
  Redo2,
  Trash2,
  Star,
} from 'lucide-react';
import { WhiteboardToolType, StrokeProperties } from '../../types/whiteboard';
import { ColorStrokePopover } from './ColorStrokePopover';

export interface WhiteboardToolbarProps {
  activeTool: WhiteboardToolType;
  onSelectTool: (tool: WhiteboardToolType) => void;
  strokeProperties?: StrokeProperties;
  onChangeStrokeProperties?: (properties: Partial<StrokeProperties>) => void;
  canUndo?: boolean;
  canRedo?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onClearPage?: () => void;
  onTriggerReward?: (type: 'star' | 'trophy' | 'fire' | 'heart' | 'sparkles') => void;
  allowedTools?: WhiteboardToolType[];
  className?: string;
  isTeacher?: boolean;
  readOnly?: boolean;
}

const SHAPE_TOOLS: { tool: WhiteboardToolType; label: string; icon: React.FC<{ className?: string }> }[] = [
  { tool: 'rect', label: 'Rectangle', icon: Square },
  { tool: 'circle', label: 'Circle', icon: Circle },
  { tool: 'triangle', label: 'Triangle', icon: Triangle },
  { tool: 'line', label: 'Line', icon: Minus },
  { tool: 'arrow', label: 'Arrow', icon: ArrowRight },
];

export const WhiteboardToolbar: React.FC<WhiteboardToolbarProps> = ({
  activeTool,
  onSelectTool,
  strokeProperties = { color: '#000000', width: 3 },
  onChangeStrokeProperties,
  canUndo = false,
  canRedo = false,
  onUndo,
  onRedo,
  onClearPage,
  onTriggerReward,
  allowedTools,
  className = '',
  readOnly = false,
}) => {
  const [isColorPopoverOpen, setIsColorPopoverOpen] = useState(false);
  const [isShapesMenuOpen, setIsShapesMenuOpen] = useState(false);
  const shapesMenuRef = useRef<HTMLDivElement>(null);
  const colorContainerRef = useRef<HTMLDivElement>(null);

  // Close shapes menu when clicking outside
  useEffect(() => {
    if (!isShapesMenuOpen) return;

    const handlePointerDown = (e: MouseEvent | TouchEvent) => {
      if (shapesMenuRef.current && !shapesMenuRef.current.contains(e.target as Node)) {
        setIsShapesMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
    };
  }, [isShapesMenuOpen]);

  const isToolAllowed = (tool: WhiteboardToolType) => {
    if (readOnly) return tool === 'select' || tool === 'pan';
    if (!allowedTools) return true;
    return allowedTools.includes(tool);
  };

  const isShapeActive = SHAPE_TOOLS.some((s) => s.tool === activeTool);
  const activeShape = SHAPE_TOOLS.find((s) => s.tool === activeTool);
  const ActiveShapeIcon = activeShape ? activeShape.icon : Shapes;

  const emilSpringEasing = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const baseButtonStyle: React.CSSProperties = {
    transition: `transform 160ms ${emilSpringEasing}, background 160ms ease, border-color 160ms ease, color 160ms ease`,
    touchAction: 'manipulation',
  };

  const getToolButtonClass = (tool: WhiteboardToolType) => {
    const isActive = activeTool === tool;
    const isAllowed = isToolAllowed(tool);

    if (!isAllowed) {
      return 'opacity-30 cursor-not-allowed pointer-events-none text-zinc-500';
    }

    if (isActive) {
      return 'bg-white/20 text-white border-white/30 shadow-inner font-semibold';
    }

    return 'text-zinc-300 hover:bg-white/10 hover:text-white border-transparent';
  };

  return (
    <div
      role="toolbar"
      aria-label="Whiteboard Toolbar"
      data-testid="whiteboard-toolbar"
      className={`absolute bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1 p-1.5 rounded-2xl border border-[rgba(255,255,255,0.08)] backdrop-blur-[16px] select-none text-zinc-200 ${className}`}
      style={{
        background: 'rgba(18, 18, 24, 0.78)',
        boxShadow:
          'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 32px -4px rgba(0, 0, 0, 0.48)',
      }}
    >
      {/* 1. Select Tool */}
      <button
        type="button"
        onClick={() => onSelectTool('select')}
        disabled={!isToolAllowed('select')}
        aria-label="Select tool"
        data-testid="tool-select"
        data-active={activeTool === 'select'}
        title="Select (V)"
        style={baseButtonStyle}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
          'select'
        )}`}
      >
        <MousePointer className="w-4 h-4" />
      </button>

      {/* 2. Pan Tool */}
      <button
        type="button"
        onClick={() => onSelectTool('pan')}
        disabled={!isToolAllowed('pan')}
        aria-label="Pan tool"
        data-testid="tool-pan"
        data-active={activeTool === 'pan'}
        title="Pan (H)"
        style={baseButtonStyle}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
          'pan'
        )}`}
      >
        <Hand className="w-4 h-4" />
      </button>

      {/* Separator */}
      <div className="w-[1px] h-5 bg-white/[0.08] mx-0.5" />

      {/* 3. Pen Tool */}
      <button
        type="button"
        onClick={() => onSelectTool('pen')}
        disabled={!isToolAllowed('pen')}
        aria-label="Pen tool"
        data-testid="tool-pen"
        data-active={activeTool === 'pen'}
        title="Pen (P)"
        style={baseButtonStyle}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
          'pen'
        )}`}
      >
        <Pen className="w-4 h-4" />
      </button>

      {/* 4. Pencil Tool */}
      <button
        type="button"
        onClick={() => onSelectTool('pencil')}
        disabled={!isToolAllowed('pencil')}
        aria-label="Pencil tool"
        data-testid="tool-pencil"
        data-active={activeTool === 'pencil'}
        title="Pencil"
        style={baseButtonStyle}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
          'pencil'
        )}`}
      >
        <Pencil className="w-4 h-4" />
      </button>

      {/* 5. Highlighter Tool */}
      <button
        type="button"
        onClick={() => onSelectTool('highlighter')}
        disabled={!isToolAllowed('highlighter')}
        aria-label="Highlighter tool"
        data-testid="tool-highlighter"
        data-active={activeTool === 'highlighter'}
        title="Highlighter"
        style={baseButtonStyle}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
          'highlighter'
        )}`}
      >
        <Highlighter className="w-4 h-4" />
      </button>

      {/* 5b. Dedicated Eraser Tool */}
      <button
        type="button"
        onClick={() => onSelectTool('eraser')}
        disabled={!isToolAllowed('eraser')}
        aria-label="Eraser tool"
        data-testid="tool-eraser"
        data-active={activeTool === 'eraser'}
        title="Eraser (E)"
        style={baseButtonStyle}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
          'eraser'
        )}`}
      >
        <Eraser className="w-4 h-4" />
      </button>

      {/* 6. Shapes Menu Anchor */}
      <div className="relative" ref={shapesMenuRef}>
        <button
          type="button"
          onClick={() => setIsShapesMenuOpen((prev) => !prev)}
          aria-label="Shapes menu"
          aria-haspopup="true"
          aria-expanded={isShapesMenuOpen}
          data-testid="tool-shapes"
          data-active={isShapeActive}
          title="Shapes"
          style={baseButtonStyle}
          className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${
            isShapeActive
              ? 'bg-white/20 text-white border-white/30 shadow-inner font-semibold'
              : 'text-zinc-300 hover:bg-white/10 hover:text-white border-transparent'
          }`}
        >
          <ActiveShapeIcon className="w-4 h-4" />
        </button>

        {/* Shapes Dropdown / Mini-dock Popover */}
        {isShapesMenuOpen && (
          <div
            role="menu"
            aria-label="Shapes Options"
            data-testid="shapes-menu"
            className="absolute bottom-full mb-3 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 rounded-2xl border border-[rgba(255,255,255,0.08)] backdrop-blur-[16px] z-50"
            style={{
              background: 'rgba(18, 18, 24, 0.85)',
              boxShadow:
                'inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 12px 36px -4px rgba(0, 0, 0, 0.6)',
              animation:
                'colorStrokePopoverEnter 160ms cubic-bezier(0.23, 1, 0.32, 1) forwards',
              transformOrigin: 'bottom center',
            }}
          >
            {SHAPE_TOOLS.map(({ tool, label, icon: Icon }) => {
              const isActive = activeTool === tool;
              const isAllowed = isToolAllowed(tool);
              return (
                <button
                  key={tool}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    onSelectTool(tool);
                    setIsShapesMenuOpen(false);
                  }}
                  disabled={!isAllowed}
                  aria-label={label}
                  data-testid={`tool-${tool}`}
                  data-active={isActive}
                  title={label}
                  style={baseButtonStyle}
                  className={`w-8 h-8 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
                    tool
                  )}`}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 7. Text Tool */}
      <button
        type="button"
        onClick={() => onSelectTool('text')}
        disabled={!isToolAllowed('text')}
        aria-label="Text tool"
        data-testid="tool-text"
        data-active={activeTool === 'text'}
        title="Text (T)"
        style={baseButtonStyle}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
          'text'
        )}`}
      >
        <Type className="w-4 h-4" />
      </button>

      {/* 8. Sticky Note Tool */}
      <button
        type="button"
        onClick={() => onSelectTool('sticky')}
        disabled={!isToolAllowed('sticky')}
        aria-label="Sticky note tool"
        data-testid="tool-sticky"
        data-active={activeTool === 'sticky'}
        title="Sticky Note (S)"
        style={baseButtonStyle}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
          'sticky'
        )}`}
      >
        <StickyNote className="w-4 h-4" />
      </button>

      {/* 9. Laser Pointer Tool */}
      <button
        type="button"
        onClick={() => onSelectTool('laser')}
        disabled={!isToolAllowed('laser')}
        aria-label="Laser pointer tool"
        data-testid="tool-laser"
        data-active={activeTool === 'laser'}
        title="Laser Pointer (L)"
        style={baseButtonStyle}
        className={`w-9 h-9 rounded-xl flex items-center justify-center border cursor-pointer active:scale-[0.97] ${getToolButtonClass(
          'laser'
        )}`}
      >
        <Radio className="w-4 h-4 text-red-400" />
      </button>

      {/* Separator */}
      <div className="w-[1px] h-5 bg-white/[0.08] mx-0.5" />

      {/* 10. Color Indicator Dot & Stroke Popover Anchor */}
      <div className="relative" ref={colorContainerRef}>
        <button
          type="button"
          onClick={() => setIsColorPopoverOpen((prev) => !prev)}
          aria-label="Color and stroke settings"
          aria-haspopup="dialog"
          aria-expanded={isColorPopoverOpen}
          data-testid="color-indicator-btn"
          title="Color & Stroke Width"
          style={baseButtonStyle}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-transparent hover:bg-white/10 hover:border-white/10 cursor-pointer active:scale-[0.97]"
        >
          <span
            data-testid="color-indicator-dot"
            className="w-5 h-5 rounded-full border border-white/40 shadow-sm transition-transform"
            style={{
              backgroundColor: strokeProperties.color,
            }}
          />
        </button>

        {/* Color Stroke Popover */}
        <ColorStrokePopover
          isOpen={isColorPopoverOpen}
          onClose={() => setIsColorPopoverOpen(false)}
          strokeProperties={strokeProperties}
          onChange={(newProps) => {
            onChangeStrokeProperties?.(newProps);
          }}
          position="top"
          align="center"
        />
      </div>

      {/* Separator */}
      <div className="w-[1px] h-5 bg-white/[0.08] mx-0.5" />

      {/* 11. Undo Action */}
      <button
        type="button"
        onClick={onUndo}
        disabled={!canUndo}
        aria-label="Undo"
        data-testid="action-undo"
        title="Undo (Ctrl+Z)"
        style={baseButtonStyle}
        className="w-9 h-9 rounded-xl flex items-center justify-center border border-transparent text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none"
      >
        <Undo2 className="w-4 h-4" />
      </button>

      {/* 12. Redo Action */}
      <button
        type="button"
        onClick={onRedo}
        disabled={!canRedo}
        aria-label="Redo"
        data-testid="action-redo"
        title="Redo (Ctrl+Y)"
        style={baseButtonStyle}
        className="w-9 h-9 rounded-xl flex items-center justify-center border border-transparent text-zinc-300 hover:bg-white/10 hover:text-white cursor-pointer active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none"
      >
        <Redo2 className="w-4 h-4" />
      </button>

      {/* 13. Student Reward Trigger */}
      {onTriggerReward && (
        <button
          type="button"
          onClick={() => onTriggerReward('star')}
          aria-label="Award Star to Student"
          data-testid="action-reward"
          title="Award Star (Reward Student)"
          style={baseButtonStyle}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-amber-500/30 text-amber-400 hover:bg-amber-500/20 hover:text-amber-300 cursor-pointer active:scale-[0.97]"
        >
          <Star className="w-4 h-4 fill-amber-400/20" />
        </button>
      )}

      {/* 14. Clear Page Action */}
      {onClearPage && (
        <button
          type="button"
          onClick={onClearPage}
          disabled={readOnly}
          aria-label="Clear page"
          data-testid="action-clear"
          title="Clear Entire Page"
          style={baseButtonStyle}
          className="w-9 h-9 rounded-xl flex items-center justify-center border border-transparent text-red-400 hover:bg-red-500/20 hover:text-red-300 hover:border-red-500/30 cursor-pointer active:scale-[0.97] disabled:opacity-30 disabled:cursor-not-allowed disabled:pointer-events-none"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  );
};

export default WhiteboardToolbar;
