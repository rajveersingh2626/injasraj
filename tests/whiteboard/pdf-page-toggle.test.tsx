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
  const content = `%PDF-1.7
1 0 obj <</Type /Catalog /Pages 2 0 R>> endobj
2 0 obj <</Type /Pages /Kids [3 0 R 4 0 R 5 0 R] /Count ${numPages}>> endobj
3 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
4 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
5 0 obj <</Type /Page /Parent 2 0 R /MediaBox [0 0 612 792]>> endobj
xref
trailer <</Size 6 /Root 1 0 R /Info <</Title (Sample Geometry Worksheet)>>>>
%%EOF`;
  const encoder = new TextEncoder();
  return encoder.encode(content).buffer;
}

describe('PDF Multi-Page Ingestion, Page Toggling, and Tool Fixes Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    HTMLCanvasElement.prototype.toDataURL = vi.fn().mockReturnValue('data:image/png;base64,mock');
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
        initialSidePanelCollapsed={false}
      />
    );

    // Initial single page default (page indicator hidden until multi-page)
    expect(screen.queryByTestId('page-indicator')).toBeNull();

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

    // In-tab PDF sub-page navigator should now be displayed
    await waitFor(() => {
      expect(screen.getByTestId('pdf-subpage-navigator')).toBeInTheDocument();
      expect(screen.getByText('Page 1 of 3')).toBeInTheDocument();
    }, { timeout: 20000 });

    // Next PDF page button should now be enabled
    const nextPdfBtn = screen.getByLabelText('Next PDF Page');
    expect(nextPdfBtn).not.toBeDisabled();

    // Toggle to Page 2 of the PDF on the same tab
    await act(async () => {
      fireEvent.click(nextPdfBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    }, { timeout: 20000 });

    // Toggle to Page 3
    await act(async () => {
      fireEvent.click(nextPdfBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Page 3 of 3')).toBeInTheDocument();
    }, { timeout: 20000 });

    // Previous PDF button should now be enabled to go back
    const prevPdfBtn = screen.getByLabelText('Previous PDF Page');
    expect(prevPdfBtn).not.toBeDisabled();

    // Toggle back to Page 2
    await act(async () => {
      fireEvent.click(prevPdfBtn);
    });

    await waitFor(() => {
      expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    }, { timeout: 15000 });
  }, 30000);

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
  }, 30000);

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
  }, 30000);
});
