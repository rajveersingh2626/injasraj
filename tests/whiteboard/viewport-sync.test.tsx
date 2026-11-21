import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ZoomControls } from '../../src/components/whiteboard/ZoomControls';

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

describe('Follow-Teacher Viewport Synchronization', () => {
  it('renders Follow Teacher toggle for students', () => {
    const onToggle = vi.fn();
    render(
      <ZoomControls
        zoom={1.0}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        isFollowTeacherEnabled={false}
        onToggleFollowTeacher={onToggle}
        isTeacher={false}
      />
    );

    const followBtn = screen.getByRole('button', { name: /follow teacher/i });
    expect(followBtn).toBeInTheDocument();
    fireEvent.click(followBtn);
    expect(onToggle).toHaveBeenCalledWith(true);
  });

  it('indicates active follow state with distinctive styling', () => {
    const onToggle = vi.fn();
    render(
      <ZoomControls
        zoom={1.5}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        isFollowTeacherEnabled={true}
        onToggleFollowTeacher={onToggle}
        isTeacher={false}
      />
    );

    const followBtn = screen.getByRole('button', { name: /follow teacher/i });
    expect(followBtn).toHaveClass('active-follow');

    fireEvent.click(followBtn);
    expect(onToggle).toHaveBeenCalledWith(false);
  });

  it('does not render follow teacher button for teachers', () => {
    render(
      <ZoomControls
        zoom={1.0}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        isTeacher={true}
      />
    );

    expect(screen.queryByRole('button', { name: /follow teacher/i })).not.toBeInTheDocument();
  });
});
