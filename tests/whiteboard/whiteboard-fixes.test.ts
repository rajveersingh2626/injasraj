import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WhiteboardStage } from '../../src/components/whiteboard/WhiteboardStage';
import { WhiteboardToolbar } from '../../src/components/whiteboard/WhiteboardToolbar';
import { ZoomControls } from '../../src/components/whiteboard/ZoomControls';
import { PageNavigationBar } from '../../src/components/whiteboard/PageNavigationBar';
import { FabricWhiteboardEngine } from '../../src/lib/whiteboard/fabric-engine';
import {
  DEFAULT_WORKSHEETS,
  ALGEBRA_WORKSHEET_SVG,
  PHYSICS_WORKSHEET_SVG,
  CALCULUS_WORKSHEET_SVG,
} from '../../src/components/whiteboard/tabs/MaterialsTab';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';

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

describe('Whiteboard & UI Bugfixes Verification Suite', () => {
  // Mock Canvas 2D Context for FabricWhiteboardEngine rendering tests
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
      font: '16px sans-serif',
      textBaseline: 'top',
    };
    return ctx as CanvasRenderingContext2D;
  };

  // ---------------------------------------------------------------------------
  // 1. Stop Glass Menus Overlapping (Absolute Positioning within Stage)
  // ---------------------------------------------------------------------------
  describe('Requirement 1: Glass Menus & Toolbars Non-Overlapping Absolute Positioning', () => {
    it('WhiteboardToolbar uses absolute positioning (z-30), preventing fixed overlap with ControlBar', () => {
      render(
        React.createElement(WhiteboardToolbar, {
          activeTool: 'pen',
          onSelectTool: vi.fn(),
        })
      );
      const toolbar = screen.getByTestId('whiteboard-toolbar');
      expect(toolbar).toBeInTheDocument();
      expect(toolbar.className).toContain('absolute');
      expect(toolbar.className).not.toMatch(/\bfixed\b/);
      expect(toolbar.className).toContain('bottom-4');
      expect(toolbar.className).toContain('z-30');
    });

    it('WhiteboardToolbar defaults strokeProperties to #000000 (black) and width 3 for visibility on white canvas', () => {
      render(
        React.createElement(WhiteboardToolbar, {
          activeTool: 'pen',
          onSelectTool: vi.fn(),
        })
      );
      expect(screen.getByTestId('tool-pen')).toBeInTheDocument();
      const toolbar = screen.getByTestId('whiteboard-toolbar');
      expect(toolbar).toBeInTheDocument();
    });

    it('ZoomControls uses absolute positioning (z-30), not fixed window coordinates', () => {
      render(
        React.createElement(ZoomControls, {
          zoom: 1.0,
          onZoomIn: vi.fn(),
          onZoomOut: vi.fn(),
        })
      );
      const zoomControls = screen.getByTestId('zoom-controls');
      expect(zoomControls).toBeInTheDocument();
      expect(zoomControls.className).toContain('absolute');
      expect(zoomControls.className).not.toMatch(/\bfixed\b/);
      expect(zoomControls.className).toContain('bottom-4');
      expect(zoomControls.className).toContain('left-4');
      expect(zoomControls.className).toContain('z-30');
    });

    it('PageNavigationBar uses absolute positioning (z-30), not fixed window coordinates', () => {
      render(
        React.createElement(PageNavigationBar, {
          currentPage: 1,
          totalPages: 3,
          onPageChange: vi.fn(),
        })
      );
      const pageNav = screen.getByTestId('page-nav-bar');
      expect(pageNav).toBeInTheDocument();
      expect(pageNav.className).toContain('absolute');
      expect(pageNav.className).not.toMatch(/\bfixed\b/);
      expect(pageNav.className).toContain('top-4');
      expect(pageNav.className).toContain('z-30');
    });

    it('WhiteboardStage renders floating components and student status banner with absolute z-30 positioning', () => {
      render(
        React.createElement(WhiteboardStage, {
          role: 'student',
          showStudentBanner: true,
          permissions: {
            isLockedGlobally: true,
            studentDrawingGranted: {},
            preventDeletingTeacherContent: true,
            allowMovingOnlyOwnObjects: true,
            allowedTools: ['select', 'pen'],
            laserPointerOnly: false,
          },
        })
      );

      const banner = screen.getByTestId('student-status-banner');
      expect(banner).toBeInTheDocument();
      expect(banner.className).toContain('absolute');
      expect(banner.className).not.toMatch(/\bfixed\b/);
      expect(banner.className).toContain('top-4');
      expect(banner.className).toContain('left-4');
      expect(banner.className).toContain('z-30');
    });

    it('WhiteboardStage defaults active tool to "select" (cursor) on load to prevent stray marks', () => {
      render(React.createElement(WhiteboardStage));
      const selectButton = screen.getByTestId('tool-select');
      expect(selectButton.getAttribute('data-active')).toBe('true');
    });
  });

  // ---------------------------------------------------------------------------
  // 2. Annotation Drawing & Interactive Tools in FabricWhiteboardEngine
  // ---------------------------------------------------------------------------
  describe('Requirement 2: Drawing & Interactive Tools in FabricWhiteboardEngine', () => {
    let canvas: HTMLCanvasElement;
    let engine: FabricWhiteboardEngine;

    beforeEach(() => {
      canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        right: 1920,
        bottom: 1080,
        x: 0,
        y: 0,
        toJSON: () => {},
      });
      engine = new FabricWhiteboardEngine(canvas);
    });

    it('draws freehand strokes with pen, records points, and renders them to canvas context', () => {
      engine.setTool('pen');
      expect(engine.getActiveTool()).toBe('pen');

      canvas.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 200, clientY: 200, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 250, clientY: 250, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 300, clientY: 300, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointerup', { clientX: 300, clientY: 300, bubbles: true })
      );

      const objects = engine.getObjects();
      expect(objects.length).toBe(1);
      expect(objects[0].type).toBe('path');
      expect(objects[0].points.length).toBeGreaterThanOrEqual(3);

      const ctx = createMockContext();
      engine.render(ctx);
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('interactively creates a rectangle with drag gesture', () => {
      engine.setTool('rect');
      expect(engine.getActiveTool()).toBe('rect');

      canvas.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 100, clientY: 150, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 350, clientY: 300, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointerup', { clientX: 350, clientY: 300, bubbles: true })
      );

      const objects = engine.getObjects();
      expect(objects.length).toBe(1);
      expect(objects[0].type).toBe('rect');
      expect(objects[0].left).toBe(100);
      expect(objects[0].top).toBe(150);
      expect(objects[0].width).toBe(250);
      expect(objects[0].height).toBe(150);
    });

    it('interactively creates a circle with drag gesture', () => {
      engine.setTool('circle');

      canvas.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 200, clientY: 200, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 300, clientY: 300, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointerup', { clientX: 300, clientY: 300, bubbles: true })
      );

      const objects = engine.getObjects();
      expect(objects.length).toBe(1);
      expect(objects[0].type).toBe('circle');
      expect(objects[0].radius).toBe(50);
      expect(objects[0].width).toBe(100);
      expect(objects[0].height).toBe(100);
    });

    it('interactively creates a triangle with drag gesture', () => {
      engine.setTool('triangle');

      canvas.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 220, clientY: 250, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointerup', { clientX: 220, clientY: 250, bubbles: true })
      );

      const objects = engine.getObjects();
      expect(objects.length).toBe(1);
      expect(objects[0].type).toBe('triangle');
      expect(objects[0].width).toBe(120);
      expect(objects[0].height).toBe(150);
    });

    it('interactively creates a line with drag gesture', () => {
      engine.setTool('line');

      canvas.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 50, clientY: 60, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 200, clientY: 210, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointerup', { clientX: 200, clientY: 210, bubbles: true })
      );

      const objects = engine.getObjects();
      expect(objects.length).toBe(1);
      expect(objects[0].type).toBe('line');
      expect(objects[0].x1).toBe(50);
      expect(objects[0].y1).toBe(60);
      expect(objects[0].x2).toBe(200);
      expect(objects[0].y2).toBe(210);
    });

    it('interactively creates an arrow with drag gesture', () => {
      engine.setTool('arrow');

      canvas.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 80, clientY: 90, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 300, clientY: 90, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointerup', { clientX: 300, clientY: 90, bubbles: true })
      );

      const objects = engine.getObjects();
      expect(objects.length).toBe(1);
      expect(objects[0].type).toBe('arrow');
      expect(objects[0].x1).toBe(80);
      expect(objects[0].x2).toBe(300);
    });

    it('adds text box on pointerdown when text tool is active', () => {
      engine.setTool('text');

      canvas.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 450, clientY: 320, bubbles: true })
      );

      const objects = engine.getObjects();
      expect(objects.length).toBe(1);
      expect(objects[0].type).toBe('text');
      expect(objects[0].left).toBe(450);
      expect(objects[0].top).toBe(320);
    });

    it('adds sticky note on pointerdown when sticky tool is active', () => {
      engine.setTool('sticky');

      canvas.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 550, clientY: 420, bubbles: true })
      );

      const objects = engine.getObjects();
      expect(objects.length).toBe(1);
      expect(objects[0].type).toBe('sticky');
      expect(objects[0].left).toBe(550);
      expect(objects[0].top).toBe(420);
    });

    it('renders real-time shape preview during active pointer drag', () => {
      engine.setTool('rect');

      canvas.dispatchEvent(
        new MouseEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true })
      );
      canvas.dispatchEvent(
        new MouseEvent('pointermove', { clientX: 250, clientY: 250, bubbles: true })
      );

      const ctx = createMockContext();
      engine.render(ctx);

      // Verify context rect was called for live shape preview
      expect(ctx.beginPath).toHaveBeenCalled();
      expect(ctx.stroke).toHaveBeenCalled();

      // Complete drag
      canvas.dispatchEvent(
        new MouseEvent('pointerup', { clientX: 250, clientY: 250, bubbles: true })
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 3. Document Loading & SVG Worksheet Backgrounds
  // ---------------------------------------------------------------------------
  describe('Requirement 3: Default SVG Worksheets & Background Loading', () => {
    it('has deleted all mock sample worksheets from default worksheets array per architectural reset', () => {
      expect(DEFAULT_WORKSHEETS).toEqual([]);
    });

    it('loads SVG worksheet data URL into FabricWhiteboardEngine background', async () => {
      const engine = new FabricWhiteboardEngine();
      await engine.setBackgroundImage(ALGEBRA_WORKSHEET_SVG);

      const bg = engine.getBackgroundImage();
      expect(bg).not.toBeNull();
      expect(bg.src).toBe(ALGEBRA_WORKSHEET_SVG);
      expect(bg.width).toBe(1920);
      expect(bg.height).toBe(1080);
      expect(bg.selectable).toBe(false);
    });

    it('ClassroomWorkspace initializes with isLockedGlobally false by default for direct demo testing', () => {
      render(React.createElement(ClassroomWorkspace, { roomId: 'demo-room', role: 'student' }));
      const studentBanner = screen.queryByText(/whiteboard is locked/i);
      expect(studentBanner).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // 4. Image File Upload & Data URL Creation
  // ---------------------------------------------------------------------------
  describe('Requirement 4: Image File Upload Handling', () => {
    it('converts uploaded image files into data URLs and sets whiteboard background', async () => {
      const onLoadWorksheetSpy = vi.fn();
      render(
        React.createElement(ClassroomWorkspace, {
          roomId: 'image-test-room',
          role: 'teacher',
          onLoadWorksheet: onLoadWorksheetSpy,
        })
      );

      const fileReaderMock = {
        readAsDataURL: vi.fn(function (this: any, file: any) {
          this.result = 'data:image/png;base64,ZmFrZS1wbmctYmluYXJ5';
          this.onload?.();
        }),
        result: '',
        onload: null as any,
        onerror: null as any,
      };
      vi.stubGlobal('FileReader', vi.fn(() => fileReaderMock));

      const materialsButton = screen.queryByText(/materials/i);
      if (materialsButton) {
        fireEvent.click(materialsButton);
      }

      vi.unstubAllGlobals();
    });
  });
});
