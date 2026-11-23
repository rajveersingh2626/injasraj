import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render } from '@testing-library/react';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';
import { WhiteboardToolbar } from '../../src/components/whiteboard/WhiteboardToolbar';
import { ZoomControls } from '../../src/components/whiteboard/ZoomControls';

describe('Brand Palette & Zero-Glow Emil Polish Audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('verifies WhiteboardToolbar contains zero neon purple/indigo glows and uses stone borders', () => {
    const { container } = render(
      <WhiteboardToolbar
        activeTool="select"
        onSelectTool={vi.fn()}
        strokeProperties={{
          color: '#1c1917',
          width: 3,
        }}
        onChangeStrokeProperties={vi.fn()}
      />
    );

    const html = container.innerHTML;
    // Strictly zero neon glows
    expect(html).not.toContain('shadow-purple-500');
    expect(html).not.toContain('shadow-indigo-500');
    expect(html).not.toContain('from-indigo-500');

    // Uses warm stone palette and subtle tactile borders
    expect(html).toContain('border-stone-800');
  });

  it('verifies ZoomControls uses warm stone background with active press compression', () => {
    const { container } = render(
      <ZoomControls
        zoom={1.0}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
        onResetZoom={vi.fn()}
      />
    );

    const html = container.innerHTML;
    expect(html).not.toContain('shadow-purple-500');
    expect(html).not.toContain('shadow-indigo-500');
    expect(html).toContain('border-stone-800');
    expect(html).toContain('active:scale-95');
  });

  it('verifies ClassroomWorkspace base canvas is warm stone without neon gradients', () => {
    const { container } = render(
      <ClassroomWorkspace
        roomId="audit-room"
        currentUserId="user-1"
        role="teacher"
      />
    );

    const html = container.innerHTML;
    expect(html).not.toContain('shadow-purple-500/50');
    expect(html).not.toContain('from-indigo-500 via-purple-500');
    expect(html).toContain('bg-white');
  });
});
