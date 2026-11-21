import React from 'react';
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
});
