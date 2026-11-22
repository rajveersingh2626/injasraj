import React, { act } from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';
import { FabricWhiteboardEngine } from '../../src/lib/whiteboard/fabric-engine';

// Extend expect for custom matchers
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

// Mock context for canvas
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

// Mock PDF buffer helper
function createMockPdfBuffer(numPages: number = 3): ArrayBuffer {
  let content = '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n';
  content += `2 0 obj\n<< /Type /Pages /Count ${numPages} /Kids [3 0 R] >>\nendobj\n`;
  content += '3 0 obj\n<< /Type /Page >>\nendobj\n';
  content += '%%EOF';
  const encoder = new TextEncoder();
  return encoder.encode(content).buffer;
}

describe('PDF Multi-Page Ingestion, Page Toggling, and Tool Fixes Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLCanvasElement.prototype.getContext = vi.fn().mockImplementation((contextId) => {
      if (contextId === '2d') {
        return createMockContext();
      }
      return null;
    });
  });

  it('renders dedicated eraser tool in toolbar, handles shortcut E, and allows selecting it', async () => {
    render(
      <ClassroomWorkspace
        roomId="room-pdf-test"
        role="teacher"
        userId="teacher-1"
        userName="Teacher Inja"
      />
    );

    const eraserBtn = screen.getByTestId('tool-eraser');
    expect(eraserBtn).toBeInTheDocument();
    expect(eraserBtn.getAttribute('data-active')).toBe('false');

    // Click eraser
    fireEvent.click(eraserBtn);
    expect(eraserBtn.getAttribute('data-active')).toBe('true');

    // Press 'p' to switch back to pen
    fireEvent.keyDown(window, { key: 'p' });
    expect(eraserBtn.getAttribute('data-active')).toBe('false');

    // Press 'e' to switch to eraser via keyboard shortcut
    fireEvent.keyDown(window, { key: 'e' });
    expect(eraserBtn.getAttribute('data-active')).toBe('true');
  });

  it('loads multi-page PDF, creates pages for each page, and allows toggling pages via prev/next buttons', async () => {
    render(
      <ClassroomWorkspace
        roomId="room-pdf-multi"
        role="teacher"
        userId="teacher-1"
        userName="Teacher Inja"
      />
    );

    // Initial page indicator
    const pageIndicator = screen.getByTestId('page-indicator');
    expect(pageIndicator.textContent).toContain('Page 1 of 2');

    // Find file input and simulate uploading a 3-page PDF
    const fileInput = screen.getByTestId('pdf-file-input') as HTMLInputElement;
    const mockPdfBuffer = createMockPdfBuffer(3);
    const mockPdfFile = new File([mockPdfBuffer], 'sample-worksheet.pdf', {
      type: 'application/pdf',
    });

    // Provide arrayBuffer on mock file if jsdom doesn't have it
    if (!mockPdfFile.arrayBuffer) {
      (mockPdfFile as any).arrayBuffer = async () => mockPdfBuffer;
    }

    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [mockPdfFile] } });
    });

    // Page indicator should now reflect at least 3 pages
    await waitFor(() => {
      expect(screen.getByTestId('page-indicator').textContent).toContain('Page 1 of 3');
    });

    // Next page button should now be enabled
    const nextBtn = screen.getByTestId('next-page-btn');
    expect(nextBtn).not.toBeDisabled();

    // Toggle to Page 2
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('page-indicator').textContent).toContain('Page 2 of 3');
    });

    // Toggle to Page 3
    await act(async () => {
      fireEvent.click(nextBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('page-indicator').textContent).toContain('Page 3 of 3');
    });

    // Previous button should now be enabled to go back
    const prevBtn = screen.getByTestId('prev-page-btn');
    expect(prevBtn).not.toBeDisabled();

    // Toggle back to Page 2
    await act(async () => {
      fireEvent.click(prevBtn);
    });

    await waitFor(() => {
      expect(screen.getByTestId('page-indicator').textContent).toContain('Page 2 of 3');
    });
  });

  it('keeps header controls visible without overlap when StudioSidePanel is open', () => {
    render(
      <ClassroomWorkspace
        roomId="room-header-test"
        role="teacher"
        userId="teacher-1"
        userName="Teacher Inja"
      />
    );

    // Studio panel is open by default
    const studioPanel = screen.getByTestId('studio-side-panel');
    expect(studioPanel).toBeInTheDocument();
    // Positioned below top-14 header
    expect(studioPanel.className).toContain('top-14');

    // Header controls are present and accessible
    expect(screen.getByTestId('workspace-header')).toBeInTheDocument();
    expect(screen.getByTestId('mode-toggle-btn')).toBeInTheDocument();
    expect(screen.getByTestId('start-class-btn')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-timer-btn')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-video-sync-btn')).toBeInTheDocument();
    expect(screen.getByTestId('toggle-studio-panel-btn')).toBeInTheDocument();
  });

  it('enables undo button and executes undo with objects on canvas even if user history stack was empty', async () => {
    let workspaceEngine: FabricWhiteboardEngine | null = null;
    render(
      <ClassroomWorkspace
        roomId="room-undo-test"
        role="teacher"
        userId="teacher-1"
        userName="Teacher Inja"
        onEngineReady={(engine) => {
          workspaceEngine = engine;
        }}
      />
    );

    const undoBtn = screen.getByTestId('action-undo');

    // Add object via engine
    await act(async () => {
      workspaceEngine!.addObject({
        id: 'stroke-1',
        type: 'path',
        path: 'M 0 0 L 10 10',
      });
    });

    // Undo should be enabled
    expect(undoBtn).not.toBeDisabled();

    // Click undo
    await act(async () => {
      fireEvent.click(undoBtn);
    });

    // Object should be removed
    expect(workspaceEngine!.getObjectById('stroke-1')).toBeFalsy();
  });
});
