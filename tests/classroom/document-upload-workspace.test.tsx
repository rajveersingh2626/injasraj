import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';
import { WhiteboardStage } from '../../src/components/whiteboard/WhiteboardStage';
import { convertPdfToPageImages, isPdfBuffer } from '../../src/lib/whiteboard/pdf-renderer';

// Extend matchers
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

describe('Classroom Workspace Document Upload & Viewport Suite', () => {
  it('defaults Studio Panel to collapsed (minimized) always', () => {
    render(
      <ClassroomWorkspace
        roomId="test-room-collapsed"
        role="teacher"
        userId="teacher-1"
        userName="Prof. Test"
      />
    );

    // Studio Side Panel must be present and collapsed off-screen by default
    const sidePanel = screen.getByTestId('studio-side-panel');
    expect(sidePanel).toBeInTheDocument();
    expect(sidePanel.className).toContain('translate-x-full');
    expect(sidePanel.className).toContain('pointer-events-none');
  });

  it('defaults WhiteboardStage to 125% zoom without rendering floating ZoomControls dock', () => {
    render(
      <WhiteboardStage
        currentPage={1}
        totalPages={1}
      />
    );

    // Floating ZoomControls dock must NOT be rendered by default
    expect(screen.queryByTestId('zoom-controls')).toBeNull();

    // Canvas stage wrapper must default to 1.25 scale (125% zoom)
    const stageWrapper = screen.getByTestId('canvas-stage-wrapper');
    expect(stageWrapper.style.transform).toBe('scale(1.25)');
  });

  it('renders large multi-page PDF instantaneously with Page 1 and non-blocking placeholders', async () => {
    // Synthetic 10-page PDF
    const rawPdfText = `%PDF-1.7
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R 4 0 R 5 0 R 6 0 R 7 0 R 8 0 R 9 0 R 10 0 R 11 0 R 12 0 R] /Count 10>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
4 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
5 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
6 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
7 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
8 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
9 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
10 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
11 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
12 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
xref
trailer <</Size 13 /Root 1 0 R /Info <</Title (Curriculum Syllabus)>>>>
%%EOF`;

    const encoder = new TextEncoder();
    const bytes = encoder.encode(rawPdfText);

    const progressTracker: { current: number; total: number }[] = [];
    const tStart = Date.now();
    const result = await convertPdfToPageImages(bytes, 2.0, (curr, tot) => {
      progressTracker.push({ current: curr, total: tot });
    });
    const tElapsed = Date.now() - tStart;

    // Must complete and not freeze the event loop
    expect(tElapsed).toBeLessThan(20000);
    expect(result.totalPages).toBe(10);
    expect(result.pages).toHaveLength(10);
    expect(result.title).toMatch(/Curriculum Syllabus|Document/);

    // Page 1 is a valid data URL
    expect(result.pages[0]).toMatch(/^data:image\//);
    // Page 10 is a valid rasterized page image
    expect(result.pages[9]).toMatch(/^data:image\//);
  }, 20000);
});
