import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';

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

describe('ClassroomWorkspace Component (Dual-Mode Container)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('toggles between Classroom Mode and Whiteboard Mode', () => {
    render(
      <ClassroomWorkspace
        roomId="room-1"
        role="teacher"
        userName="Teacher Inja"
      />
    );

    const modeBtn = screen.getByTestId('mode-toggle-btn');
    expect(screen.getByTestId('classroom-layout')).toBeInTheDocument();

    fireEvent.click(modeBtn);
    expect(screen.getByTestId('whiteboard-layout')).toBeInTheDocument();

    fireEvent.click(modeBtn);
    expect(screen.getByTestId('classroom-layout')).toBeInTheDocument();
  });

  it('calls onModeChange callback when mode toggle button is clicked', () => {
    const handleModeChange = vi.fn();
    render(
      <ClassroomWorkspace
        roomId="room-1"
        role="teacher"
        userName="Teacher Inja"
        onModeChange={handleModeChange}
      />
    );

    const modeBtn = screen.getByTestId('mode-toggle-btn');
    fireEvent.click(modeBtn);

    expect(handleModeChange).toHaveBeenCalledWith('whiteboard');
  });

  it('respects initialMode="whiteboard" prop', () => {
    render(
      <ClassroomWorkspace
        roomId="room-test"
        initialMode="whiteboard"
      />
    );

    expect(screen.getByTestId('whiteboard-layout')).toBeInTheDocument();
    expect(screen.queryByTestId('classroom-layout')).not.toBeInTheDocument();
  });

  it('keeps both local and remote video cards continuously mounted across mode switches', () => {
    render(
      <ClassroomWorkspace
        roomId="room-1"
        role="teacher"
        userName="Teacher Inja"
      />
    );

    // Initial classroom mode
    const localVideoWrapper = screen.getByTestId('local-video-wrapper');
    const remoteVideoWrapper = screen.getByTestId('remote-video-wrapper');
    expect(localVideoWrapper).toBeInTheDocument();
    expect(remoteVideoWrapper).toBeInTheDocument();

    const videoCardsBefore = screen.getAllByTestId('video-card');
    expect(videoCardsBefore).toHaveLength(2);

    // Toggle to Whiteboard Mode
    const modeBtn = screen.getByTestId('mode-toggle-btn');
    fireEvent.click(modeBtn);
    expect(screen.getByTestId('whiteboard-layout')).toBeInTheDocument();

    // Verify video wrappers and video cards are still in the document
    expect(screen.getByTestId('local-video-wrapper')).toBeInTheDocument();
    expect(screen.getByTestId('remote-video-wrapper')).toBeInTheDocument();
    const videoCardsAfter = screen.getAllByTestId('video-card');
    expect(videoCardsAfter).toHaveLength(2);
  });

  it('toggles StudioSidePanel collapse and expand states', () => {
    render(
      <ClassroomWorkspace
        roomId="room-1"
        role="teacher"
        initialSidePanelCollapsed={false}
      />
    );

    const sidePanel = screen.getByTestId('studio-side-panel');
    expect(sidePanel).toBeInTheDocument();
    expect(sidePanel.getAttribute('data-collapsed')).toBe('false');

    // Click collapse button in header or panel
    const collapseBtn = screen.getByTestId('collapse-panel-btn');
    fireEvent.click(collapseBtn);
    expect(sidePanel.getAttribute('data-collapsed')).toBe('true');

    // Expand trigger button is now available
    const expandBtn = screen.getByTestId('expand-panel-btn');
    fireEvent.click(expandBtn);
    expect(sidePanel.getAttribute('data-collapsed')).toBe('false');

    // Toggle via top bar trigger button
    const togglePanelBtn = screen.getByTestId('toggle-studio-panel-btn');
    fireEvent.click(togglePanelBtn);
    expect(sidePanel.getAttribute('data-collapsed')).toBe('true');
  });

  it('renders ControlBar and handles onLeave callback', () => {
    const handleLeave = vi.fn();
    render(
      <ClassroomWorkspace
        roomId="room-1"
        role="teacher"
        onLeave={handleLeave}
      />
    );

    expect(screen.getByTestId('workspace-control-bar')).toBeInTheDocument();
    expect(screen.getByTestId('control-bar')).toBeInTheDocument();

    const leaveBtn = screen.getByTestId('leave-class-btn');
    fireEvent.click(leaveBtn);

    expect(handleLeave).toHaveBeenCalledTimes(1);
  });

  it('renders WhiteboardStage inside workspace container in both modes', () => {
    render(
      <ClassroomWorkspace
        roomId="room-math"
        role="teacher"
      />
    );

    expect(screen.getByTestId('whiteboard-stage')).toBeInTheDocument();
    expect(screen.getByTestId('whiteboard-canvas')).toBeInTheDocument();

    // Switch mode
    fireEvent.click(screen.getByTestId('mode-toggle-btn'));

    expect(screen.getByTestId('whiteboard-stage')).toBeInTheDocument();
    expect(screen.getByTestId('whiteboard-canvas')).toBeInTheDocument();
  });

  it('displays room ID in the header badge', () => {
    render(
      <ClassroomWorkspace
        roomId="advanced-calculus-101"
      />
    );

    const roomBadge = screen.getByTestId('room-id-badge');
    expect(roomBadge).toBeInTheDocument();
    expect(roomBadge.textContent).toBe('advanced-calculus-101');
  });
});
