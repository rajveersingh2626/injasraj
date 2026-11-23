import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { WhiteboardStage } from '../../src/components/whiteboard/WhiteboardStage';
import {
  defaultWhiteboardPermissions,
  WhiteboardPermissions,
} from '../../src/types/whiteboard';

// Extend expect for matchers
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
  toHaveClass(received, className) {
    const pass = Boolean(
      received?.classList?.contains(className) ||
        (received?.className && received.className.includes(className))
    );
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}have class ${className}`,
    };
  },
});

describe('WhiteboardStage Component (LearnCube Portrait Document Stage & Floating Toolbars)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    if (typeof HTMLCanvasElement !== 'undefined') {
      HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue({
        clearRect: vi.fn(),
        beginPath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        stroke: vi.fn(),
        arc: vi.fn(),
        fill: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
      }) as any;
    }
  });

  it('renders stage container, LearnCube portrait document stage wrapper (3:4), fabric canvas, and laser overlay', () => {
    render(<WhiteboardStage />);

    const stage = screen.getByTestId('whiteboard-stage');
    expect(stage).toBeInTheDocument();

    const stageWrapper = screen.getByTestId('canvas-stage-wrapper');
    expect(stageWrapper).toBeInTheDocument();
    expect(stageWrapper.style.aspectRatio).toBe('3 / 4');

    const canvas = screen.getByTestId('whiteboard-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas.getAttribute('width')).toBe('1200');
    expect(canvas.getAttribute('height')).toBe('1600');

    const laserOverlay = screen.getByTestId('laser-overlay');
    expect(laserOverlay).toBeInTheDocument();
    expect(laserOverlay.getAttribute('width')).toBe('1200');
    expect(laserOverlay.getAttribute('height')).toBe('1600');
  });

  it('renders optional 16:9 canvas stage wrapper when stageAspect="16:9"', () => {
    render(<WhiteboardStage stageAspect="16:9" />);

    const stageWrapper = screen.getByTestId('canvas-stage-wrapper');
    expect(stageWrapper).toBeInTheDocument();
    expect(stageWrapper.style.aspectRatio).toBe('16 / 9');

    const canvas = screen.getByTestId('whiteboard-canvas');
    expect(canvas.getAttribute('width')).toBe('1920');
    expect(canvas.getAttribute('height')).toBe('1080');
  });

  it('mounts floating toolbars: WhiteboardToolbar, ZoomControls, and PageNavigationBar', () => {
    render(
      <WhiteboardStage
        currentPage={1}
        totalPages={3}
        zoom={1.2}
        showZoomControls={true}
      />
    );

    // Floating toolbar
    expect(screen.getByTestId('whiteboard-toolbar')).toBeInTheDocument();

    // Zoom controls dock
    expect(screen.getByTestId('zoom-controls')).toBeInTheDocument();
    expect(screen.getByText('120%')).toBeInTheDocument();

    // Page navigation bar
    expect(screen.getByTestId('page-nav-bar')).toBeInTheDocument();
    expect(screen.getByTestId('page-indicator').textContent).toContain('1 of 3');
  });

  it('renders student status banner with "Whiteboard locked by teacher" when student has no drawing permission', () => {
    const lockedPermissions: WhiteboardPermissions = {
      isLockedGlobally: true,
      studentDrawingGranted: {},
      preventDeletingTeacherContent: true,
      allowMovingOnlyOwnObjects: true,
      allowedTools: ['pen', 'select'],
      laserPointerOnly: false,
    };

    render(
      <WhiteboardStage
        role="student"
        userId="student-1"
        permissions={lockedPermissions}
      />
    );

    const banner = screen.getByTestId('student-status-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('Whiteboard locked by teacher');
  });

  it('renders student status banner with "Drawing permission granted" when student is granted drawing access', () => {
    const grantedPermissions: WhiteboardPermissions = {
      isLockedGlobally: true,
      studentDrawingGranted: {
        'student-1': true,
      },
      preventDeletingTeacherContent: true,
      allowMovingOnlyOwnObjects: true,
      allowedTools: ['pen', 'select'],
      laserPointerOnly: false,
    };

    render(
      <WhiteboardStage
        role="student"
        userId="student-1"
        permissions={grantedPermissions}
      />
    );

    const banner = screen.getByTestId('student-status-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('Drawing permission granted');
  });

  it('renders student status banner with "Laser pointer only" when laserPointerOnly is active', () => {
    const laserOnlyPermissions: WhiteboardPermissions = {
      isLockedGlobally: false,
      studentDrawingGranted: {},
      preventDeletingTeacherContent: true,
      allowMovingOnlyOwnObjects: true,
      allowedTools: ['laser'],
      laserPointerOnly: true,
    };

    render(
      <WhiteboardStage
        role="student"
        userId="student-1"
        permissions={laserOnlyPermissions}
      />
    );

    const banner = screen.getByTestId('student-status-banner');
    expect(banner).toBeInTheDocument();
    expect(banner.textContent).toContain('Laser pointer only');
  });

  it('does NOT render student status banner when role is teacher', () => {
    const permissions = defaultWhiteboardPermissions();

    render(
      <WhiteboardStage
        role="teacher"
        userId="teacher-1"
        permissions={permissions}
      />
    );

    expect(screen.queryByTestId('student-status-banner')).not.toBeInTheDocument();
  });

  it('handles tool selection from WhiteboardToolbar', () => {
    const handleSelectTool = vi.fn();
    render(
      <WhiteboardStage
        activeTool="select"
        onSelectTool={handleSelectTool}
        role="teacher"
      />
    );

    const penBtn = screen.getByTestId('tool-pen');
    fireEvent.click(penBtn);

    expect(handleSelectTool).toHaveBeenCalledWith('pen');
  });

  it('handles zoom controls interaction', () => {
    const handleZoomIn = vi.fn();
    const handleZoomOut = vi.fn();
    const handleResetZoom = vi.fn();

    render(
      <WhiteboardStage
        zoom={1.0}
        showZoomControls={true}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
      />
    );

    const zoomInBtn = screen.getByTestId('zoom-in-btn');
    fireEvent.click(zoomInBtn);
    expect(handleZoomIn).toHaveBeenCalledTimes(1);

    const zoomOutBtn = screen.getByTestId('zoom-out-btn');
    fireEvent.click(zoomOutBtn);
    expect(handleZoomOut).toHaveBeenCalledTimes(1);

    const resetBtn = screen.getByTestId('zoom-percentage-btn');
    fireEvent.click(resetBtn);
    expect(handleResetZoom).toHaveBeenCalledTimes(1);
  });

  it('handles page navigation bar interactions', () => {
    const handlePageChange = vi.fn();
    const handleAddPage = vi.fn();

    render(
      <WhiteboardStage
        currentPage={1}
        totalPages={3}
        onPageChange={handlePageChange}
        onAddPage={handleAddPage}
        role="teacher"
      />
    );

    const nextBtn = screen.getByTestId('next-page-btn');
    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);

    const addBtn = screen.getByTestId('add-page-btn');
    fireEvent.click(addBtn);
    expect(handleAddPage).toHaveBeenCalledTimes(1);
  });

  it('tracks laser movement and calls onLaserMove callback', () => {
    const handleLaserMove = vi.fn();
    render(
      <WhiteboardStage
        stageAspect="16:9"
        activeTool="laser"
        onLaserMove={handleLaserMove}
      />
    );

    const canvas = screen.getByTestId('whiteboard-canvas');
    // Mock getBoundingClientRect
    vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
      left: 0,
      top: 0,
      width: 960,
      height: 540,
      right: 960,
      bottom: 540,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    });

    fireEvent.mouseDown(canvas, { clientX: 480, clientY: 270, buttons: 1 });
    expect(handleLaserMove).toHaveBeenCalledWith({ x: 960, y: 540 });
  });

  it('cleans up internal Fabric engine on unmount', () => {
    const onEngineReady = vi.fn();
    const { unmount } = render(<WhiteboardStage onEngineReady={onEngineReady} />);

    expect(onEngineReady).toHaveBeenCalled();
    const engine = onEngineReady.mock.calls[0][0];
    const destroySpy = vi.spyOn(engine, 'destroy');

    unmount();
    expect(destroySpy).toHaveBeenCalled();
  });

  it('handles multi-touch pinch-to-zoom gesture on canvas', () => {
    render(<WhiteboardStage initialZoom={1.0} minZoom={0.5} maxZoom={3.0} />);
    const canvas = screen.getByTestId('whiteboard-canvas');
    const stageWrapper = screen.getByTestId('canvas-stage-wrapper');

    // Initial scale is 1
    expect(stageWrapper.style.transform).toBe('scale(1)');

    // Start 2-touch gesture with distance 100px
    fireEvent.touchStart(canvas, {
      touches: [
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ],
    });

    // Spread fingers apart to distance 150px (scale delta 1.5)
    fireEvent.touchMove(canvas, {
      touches: [
        { clientX: 75, clientY: 100 },
        { clientX: 225, clientY: 100 },
      ],
    });

    // Zoom should update
    expect(stageWrapper.style.transform).toBe('scale(1.5)');

    // End touch gesture
    fireEvent.touchEnd(canvas);
  });

  it('applies safe-area padding insets on stage container for mobile notch hardening', () => {
    render(<WhiteboardStage />);
    const stage = screen.getByTestId('whiteboard-stage');
    expect(stage.className).toContain('safe-area-inset-top');
    expect(stage.className).toContain('safe-area-inset-bottom');
  });

  it('defaults active tool to select/cursor tool on load to prevent accidental stray marks', () => {
    render(<WhiteboardStage />);
    const selectBtn = screen.getByTestId('tool-select');
    expect(selectBtn.getAttribute('data-active')).toBe('true');
    const penBtn = screen.getByTestId('tool-pen');
    expect(penBtn.getAttribute('data-active')).toBe('false');
  });

  it('clamps trackpad/wheel scrolling to prevent over-scrolling into empty void', () => {
    const onViewportChange = vi.fn();
    render(<WhiteboardStage initialZoom={1.0} onViewportChange={onViewportChange} />);
    const stage = screen.getByTestId('whiteboard-stage');

    // Trigger large wheel scroll event past allowable boundary
    fireEvent.wheel(stage, { deltaX: 5000, deltaY: 5000 });

    expect(onViewportChange).toHaveBeenCalled();
    const lastCall = onViewportChange.mock.calls[onViewportChange.mock.calls.length - 1][0];
    expect(Number.isFinite(lastCall.panX)).toBe(true);
    expect(Number.isFinite(lastCall.panY)).toBe(true);
    // Verified clamped values, not unbounded 5000
    expect(Math.abs(lastCall.panX)).toBeLessThan(1000);
    expect(Math.abs(lastCall.panY)).toBeLessThan(1000);
  });
});
