import React, { act } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhiteboardToolbar } from '../../src/components/whiteboard/WhiteboardToolbar';
import { WhiteboardStage } from '../../src/components/whiteboard/WhiteboardStage';
import { ColorStrokePopover } from '../../src/components/whiteboard/ColorStrokePopover';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';
import { FabricWhiteboardEngine } from '../../src/lib/whiteboard/fabric-engine';

// Extend expect matchers for JSDOM
expect.extend({
  toBeInTheDocument(received) {
    const pass =
      received !== null &&
      received !== undefined &&
      (received.ownerDocument?.body.contains(received) ?? false);
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be in document`,
    };
  },
  toBeDisabled(received) {
    const pass = Boolean(received && received.disabled);
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be disabled`,
    };
  },
});

const createMockContext = () => {
  const ctx: any = {
    clearRect: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    scale: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    quadraticCurveTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    roundRect: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    strokeRect: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 60 })),
    drawImage: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '#000000',
    strokeStyle: '#000000',
    lineWidth: 1,
    globalAlpha: 1.0,
    lineCap: 'round',
    lineJoin: 'round',
  };
  return ctx;
};

describe('Whiteboard UX Perfection & Tool Polish Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId) => {
      if (contextId === '2d') {
        return createMockContext();
      }
      return null;
    });
  });

  describe('Task 1: Dedicated Eraser Tool & Dynamic Canvas Cursors', () => {
    it('renders dedicated eraser tool in toolbar and triggers onSelectTool', () => {
      const handleSelectTool = vi.fn();
      render(
        <WhiteboardToolbar
          activeTool="pen"
          onSelectTool={handleSelectTool}
        />
      );

      const eraserBtn = screen.getByTestId('tool-eraser');
      expect(eraserBtn).toBeInTheDocument();
      expect(eraserBtn.getAttribute('data-active')).toBe('false');

      fireEvent.click(eraserBtn);
      expect(handleSelectTool).toHaveBeenCalledWith('eraser');
    });

    it('highlights eraser tool as active when activeTool is eraser', () => {
      render(
        <WhiteboardToolbar
          activeTool="eraser"
          onSelectTool={vi.fn()}
        />
      );

      const eraserBtn = screen.getByTestId('tool-eraser');
      expect(eraserBtn.getAttribute('data-active')).toBe('true');
    });

    it('applies dynamic cursor class on canvas element according to activeTool', () => {
      const { rerender } = render(
        <WhiteboardStage activeTool="pen" />
      );

      let canvas = screen.getByTestId('whiteboard-canvas');
      expect(canvas.className).toContain('cursor-crosshair');

      rerender(<WhiteboardStage activeTool="select" />);
      canvas = screen.getByTestId('whiteboard-canvas');
      expect(canvas.className).toContain('cursor-default');

      rerender(<WhiteboardStage activeTool="pan" />);
      canvas = screen.getByTestId('whiteboard-canvas');
      expect(canvas.className).toContain('cursor-grab');

      rerender(<WhiteboardStage activeTool="text" />);
      canvas = screen.getByTestId('whiteboard-canvas');
      expect(canvas.className).toContain('cursor-text');

      rerender(<WhiteboardStage activeTool="sticky" />);
      canvas = screen.getByTestId('whiteboard-canvas');
      expect(canvas.className).toContain('cursor-copy');

      rerender(<WhiteboardStage activeTool="eraser" />);
      canvas = screen.getByTestId('whiteboard-canvas');
      expect(canvas.className).toContain('cursor-cell');

      rerender(<WhiteboardStage activeTool="laser" />);
      canvas = screen.getByTestId('whiteboard-canvas');
      expect(canvas.className).toContain('cursor-none');
    });
  });

  describe('Task 2: Operational Collaborative Undo/Redo & Keyboard Shortcuts', () => {
    it('enables undo button when an object is added, and handles undo/redo execution', async () => {
      let workspaceEngine: FabricWhiteboardEngine | null = null;
      render(
        <ClassroomWorkspace
          roomId="room-ux-test"
          role="teacher"
          userId="teacher-1"
          userName="Teacher"
          onEngineReady={(engine) => {
            workspaceEngine = engine;
          }}
        />
      );

      const undoBtn = screen.getByTestId('action-undo');
      const redoBtn = screen.getByTestId('action-redo');

      // Initially disabled
      expect(undoBtn).toBeDisabled();
      expect(redoBtn).toBeDisabled();

      // Add object via engine
      expect(workspaceEngine).not.toBeNull();
      act(() => {
        workspaceEngine!.addObject({
          id: 'obj-test-1',
          type: 'rect',
          left: 50,
          top: 50,
          width: 100,
          height: 100,
        });
      });

      // Undo should now be enabled
      expect(undoBtn).not.toBeDisabled();
      expect(redoBtn).toBeDisabled();
      expect(workspaceEngine!.getObjectById('obj-test-1')).not.toBeNull();

      // Click Undo
      act(() => {
        fireEvent.click(undoBtn);
      });
      expect(workspaceEngine!.getObjectById('obj-test-1')).toBeFalsy();
      expect(undoBtn).toBeDisabled();
      expect(redoBtn).not.toBeDisabled();

      // Click Redo
      act(() => {
        fireEvent.click(redoBtn);
      });
      expect(workspaceEngine!.getObjectById('obj-test-1')).toBeTruthy();
      expect(undoBtn).not.toBeDisabled();
      expect(redoBtn).toBeDisabled();
    });

    it('triggers undo and redo via keyboard shortcuts (Ctrl+Z and Ctrl+Y)', () => {
      let workspaceEngine: FabricWhiteboardEngine | null = null;
      render(
        <ClassroomWorkspace
          roomId="room-ux-test"
          role="teacher"
          userId="teacher-1"
          userName="Teacher"
          onEngineReady={(engine) => {
            workspaceEngine = engine;
          }}
        />
      );

      const undoBtn = screen.getByTestId('action-undo');
      const redoBtn = screen.getByTestId('action-redo');

      act(() => {
        workspaceEngine!.addObject({
          id: 'obj-kb-1',
          type: 'circle',
          left: 100,
          top: 100,
        });
      });

      expect(undoBtn).not.toBeDisabled();

      // Press Ctrl+Z
      act(() => {
        fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      });
      expect(workspaceEngine!.getObjectById('obj-kb-1')).toBeFalsy();
      expect(redoBtn).not.toBeDisabled();

      // Press Ctrl+Y
      act(() => {
        fireEvent.keyDown(window, { key: 'y', ctrlKey: true });
      });
      expect(workspaceEngine!.getObjectById('obj-kb-1')).toBeTruthy();

      // Press Ctrl+Shift+Z (Redo alternative)
      act(() => {
        fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
      });
      expect(workspaceEngine!.getObjectById('obj-kb-1')).toBeFalsy();

      act(() => {
        fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
      });
      expect(workspaceEngine!.getObjectById('obj-kb-1')).toBeTruthy();
    });
  });

  describe('Task 3: Interactive Grid Mode & 1-Click PNG Image Export', () => {
    it('updates canvas grid type when selecting options in ToolsTab and exports canvas PNG image', async () => {
      let workspaceEngine: FabricWhiteboardEngine | null = null;
      render(
        <ClassroomWorkspace
          roomId="room-grid-test"
          role="teacher"
          userId="teacher-1"
          userName="Teacher"
          initialSidePanelCollapsed={false}
          onEngineReady={(engine) => {
            workspaceEngine = engine;
          }}
        />
      );

      // Open Tools Tab
      const toolsTabBtn = screen.getByTestId('tab-tools');
      act(() => {
        fireEvent.click(toolsTabBtn);
      });

      // Default grid is none
      expect(workspaceEngine!.getGridType()).toBe('none');

      // Click Dots grid
      const dotsBtn = screen.getByTestId('grid-option-dots');
      act(() => {
        fireEvent.click(dotsBtn);
      });
      expect(workspaceEngine!.getGridType()).toBe('dots');

      // Click Lined grid
      const linedBtn = screen.getByTestId('grid-option-lined');
      act(() => {
        fireEvent.click(linedBtn);
      });
      expect(workspaceEngine!.getGridType()).toBe('lines');

      // Click Grid pattern
      const gridBtn = screen.getByTestId('grid-option-grid');
      act(() => {
        fireEvent.click(gridBtn);
      });
      expect(workspaceEngine!.getGridType()).toBe('grid');

      // Test 1-click PNG image export
      HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mockpngdata');
      const exportBtn = screen.getByTestId('export-image-btn');
      act(() => {
        fireEvent.click(exportBtn);
      });
      expect(HTMLCanvasElement.prototype.toDataURL).toHaveBeenCalledWith('image/png');
    });

    it('performs guarded clear page preserving background worksheet', async () => {
      let workspaceEngine: FabricWhiteboardEngine | null = null;
      render(
        <ClassroomWorkspace
          roomId="room-clear-test"
          role="teacher"
          userId="teacher-1"
          userName="Teacher"
          onEngineReady={(engine) => {
            workspaceEngine = engine;
          }}
        />
      );

      // Set mock background worksheet image and add an object
      await act(async () => {
        await workspaceEngine!.setBackgroundImage('data:image/svg+xml;utf8,<svg></svg>');
        workspaceEngine!.addObject({
          id: 'obj-to-clear',
          type: 'rect',
          left: 10,
          top: 10,
        });
      });

      expect(workspaceEngine!.getBackgroundImage()).not.toBeNull();
      expect(workspaceEngine!.getObjectById('obj-to-clear')).toBeTruthy();

      // Trigger clear page
      const clearBtn = screen.getByTestId('action-clear');
      act(() => {
        fireEvent.click(clearBtn);
      });

      // Object cleared but background preserved
      expect(workspaceEngine!.getObjectById('obj-to-clear')).toBeFalsy();
      expect(workspaceEngine!.getBackgroundImage()).not.toBeNull();
    });
  });

  describe('Task 4: Tactile Color Swatch Rings & Design Engineering Polish', () => {
    it('renders tactile active specular rings and handles color changes in ColorStrokePopover', () => {
      const handleChange = vi.fn();
      const { rerender } = render(
        <ColorStrokePopover
          isOpen={true}
          strokeProperties={{ color: '#ef4444', width: 4 }}
          onChange={handleChange}
        />
      );

      const redSwatch = screen.getByTestId('color-swatch-ef4444');
      expect(redSwatch).toBeInTheDocument();
      expect(redSwatch.getAttribute('aria-checked')).toBe('true');
      expect(redSwatch.className).toContain('ring-indigo-500');
      expect(redSwatch.className).toContain('scale-110');

      const blueSwatch = screen.getByTestId('color-swatch-3b82f6');
      expect(blueSwatch.getAttribute('aria-checked')).toBe('false');

      fireEvent.click(blueSwatch);
      expect(handleChange).toHaveBeenCalledWith({ color: '#3b82f6' });

      // Stroke width presets test
      const width4Btn = screen.getByTestId('stroke-width-4');
      expect(width4Btn.getAttribute('aria-checked')).toBe('true');

      const width8Btn = screen.getByTestId('stroke-width-8');
      fireEvent.click(width8Btn);
      expect(handleChange).toHaveBeenCalledWith({ width: 8 });
    });
  });
});
