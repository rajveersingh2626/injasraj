import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ToolsTab } from '../../src/components/whiteboard/tabs/ToolsTab';
import { createDefaultWhiteboardPage } from '../../src/types/whiteboard';

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
  toBeDisabled(received) {
    const pass = Boolean(received?.disabled || received?.hasAttribute('disabled'));
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be disabled`,
    };
  },
});

describe('ToolsTab Component (Grid Modes, Multi-Page Strip & Exports)', () => {
  const mockPages = [
    createDefaultWhiteboardPage('p1', 1, 'Intro Page'),
    createDefaultWhiteboardPage('p2', 2, 'Worksheet Page'),
    createDefaultWhiteboardPage('p3', 3, 'Scratchpad'),
  ];

  it('renders all grid options and highlights active grid', () => {
    const handleChangeGrid = vi.fn();
    render(<ToolsTab currentGrid="lined" onChangeGrid={handleChangeGrid} />);

    expect(screen.getByTestId('grid-option-blank')).toBeInTheDocument();
    expect(screen.getByTestId('grid-option-dots')).toBeInTheDocument();
    expect(screen.getByTestId('grid-option-lined')).toBeInTheDocument();
    expect(screen.getByTestId('grid-option-grid')).toBeInTheDocument();

    expect(screen.getByTestId('grid-option-lined').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByTestId('grid-option-blank').getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(screen.getByTestId('grid-option-grid'));
    expect(handleChangeGrid).toHaveBeenCalledWith('grid');
  });

  it('renders multi-page thumbnails and invokes jump, clone, and delete callbacks', () => {
    const handleSelectPage = vi.fn();
    const handleClonePage = vi.fn();
    const handleDeletePage = vi.fn();
    const handleAddPage = vi.fn();

    render(
      <ToolsTab
        pages={mockPages}
        currentPageId="p2"
        onSelectPage={handleSelectPage}
        onClonePage={handleClonePage}
        onDeletePage={handleDeletePage}
        onAddPage={handleAddPage}
      />
    );

    // Jump
    fireEvent.click(screen.getByTestId('jump-page-p3'));
    expect(handleSelectPage).toHaveBeenCalledWith('p3');

    // Clone
    fireEvent.click(screen.getByTestId('clone-page-p2'));
    expect(handleClonePage).toHaveBeenCalledWith('p2');

    // Delete
    fireEvent.click(screen.getByTestId('delete-page-p1'));
    expect(handleDeletePage).toHaveBeenCalledWith('p1');

    // Add Page
    fireEvent.click(screen.getByTestId('add-page-btn'));
    expect(handleAddPage).toHaveBeenCalledTimes(1);
  });

  it('disables delete button when only 1 page remains', () => {
    const singlePage = [createDefaultWhiteboardPage('p1', 1, 'Only Page')];
    render(
      <ToolsTab
        pages={singlePage}
        currentPageId="p1"
        onDeletePage={vi.fn()}
      />
    );

    const deleteBtn = screen.getByTestId('delete-page-p1');
    expect(deleteBtn).toBeDisabled();
  });

  it('triggers export callbacks for PDF and Image exports', () => {
    const handleExportPdf = vi.fn();
    const handleExportImage = vi.fn();

    render(
      <ToolsTab
        onExportPdf={handleExportPdf}
        onExportImage={handleExportImage}
      />
    );

    fireEvent.click(screen.getByTestId('export-pdf-btn'));
    expect(handleExportPdf).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('export-image-btn'));
    expect(handleExportImage).toHaveBeenCalledTimes(1);
  });
});
