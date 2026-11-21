import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudioSidePanel } from '../../src/components/whiteboard/StudioSidePanel';
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

describe('StudioSidePanel Component (Collapsible 4-Tab Teaching Panel)', () => {
  const defaultPages = [
    createDefaultWhiteboardPage('p-1', 1, 'Lesson Intro'),
    createDefaultWhiteboardPage('p-2', 2, 'Exercises'),
  ];

  it('renders side panel with 320px width styling and all 4 tab buttons', () => {
    render(<StudioSidePanel pages={defaultPages} />);

    const panel = screen.getByTestId('studio-side-panel');
    expect(panel).toBeInTheDocument();
    expect(panel).toHaveClass('w-[320px]');

    // 4 tab buttons
    expect(screen.getByTestId('tab-people')).toBeInTheDocument();
    expect(screen.getByTestId('tab-chat')).toBeInTheDocument();
    expect(screen.getByTestId('tab-materials')).toBeInTheDocument();
    expect(screen.getByTestId('tab-tools')).toBeInTheDocument();
  });

  it('switches tabs smoothly when tab buttons are clicked and invokes onTabChange', () => {
    const handleTabChange = vi.fn();
    render(<StudioSidePanel onTabChange={handleTabChange} defaultTab="people" />);

    // Initially People tab is active
    expect(screen.getByTestId('people-tab')).toBeInTheDocument();
    expect(screen.getByTestId('tab-people').getAttribute('aria-selected')).toBe('true');

    // Switch to Chat tab
    fireEvent.click(screen.getByTestId('tab-chat'));
    expect(handleTabChange).toHaveBeenCalledWith('chat');
    expect(screen.getByTestId('tab-chat').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('chat-tab')).toBeInTheDocument();

    // Switch to Materials tab
    fireEvent.click(screen.getByTestId('tab-materials'));
    expect(handleTabChange).toHaveBeenCalledWith('materials');
    expect(screen.getByTestId('tab-materials').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('materials-tab')).toBeInTheDocument();

    // Switch to Tools tab
    fireEvent.click(screen.getByTestId('tab-tools'));
    expect(handleTabChange).toHaveBeenCalledWith('tools');
    expect(screen.getByTestId('tab-tools').getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('tools-tab')).toBeInTheDocument();
  });

  it('collapses and expands cleanly via collapse and expand buttons (uncontrolled)', () => {
    render(<StudioSidePanel />);

    const panel = screen.getByTestId('studio-side-panel');
    expect(panel.getAttribute('data-collapsed')).toBe('false');
    expect(screen.queryByTestId('expand-panel-btn')).toBeNull();

    // Click collapse button
    const collapseBtn = screen.getByTestId('collapse-panel-btn');
    fireEvent.click(collapseBtn);

    // Panel is now collapsed
    expect(panel.getAttribute('data-collapsed')).toBe('true');
    expect(panel).toHaveClass('translate-x-full');

    // Floating expand trigger appears
    const expandBtn = screen.getByTestId('expand-panel-btn');
    expect(expandBtn).toBeInTheDocument();

    // Click expand button to restore
    fireEvent.click(expandBtn);
    expect(panel.getAttribute('data-collapsed')).toBe('false');
    expect(panel).toHaveClass('translate-x-0');
  });

  it('respects controlled isCollapsed or isOpen prop and fires onToggleCollapse callback', () => {
    const handleToggleCollapse = vi.fn();
    const handleToggleOpen = vi.fn();

    const { rerender } = render(
      <StudioSidePanel
        isCollapsed={false}
        onToggleCollapse={handleToggleCollapse}
        onToggleOpen={handleToggleOpen}
      />
    );

    const collapseBtn = screen.getByTestId('collapse-panel-btn');
    fireEvent.click(collapseBtn);

    expect(handleToggleCollapse).toHaveBeenCalledTimes(1);
    expect(handleToggleOpen).toHaveBeenCalledWith(false);

    // Rerender as collapsed
    rerender(
      <StudioSidePanel
        isCollapsed={true}
        onToggleCollapse={handleToggleCollapse}
        onToggleOpen={handleToggleOpen}
      />
    );

    const expandBtn = screen.getByTestId('expand-panel-btn');
    expect(expandBtn).toBeInTheDocument();
    fireEvent.click(expandBtn);

    expect(handleToggleCollapse).toHaveBeenCalledTimes(2);
    expect(handleToggleOpen).toHaveBeenCalledWith(true);
  });

  it('preserves tab state and form inputs across collapse and expand cycles', () => {
    render(<StudioSidePanel defaultTab="chat" />);

    // Type into chat input
    const chatInput = screen.getByTestId('chat-input') as HTMLInputElement;
    fireEvent.change(chatInput, { target: { value: 'Important class note' } });
    expect(chatInput.value).toBe('Important class note');

    // Collapse
    fireEvent.click(screen.getByTestId('collapse-panel-btn'));
    expect(screen.getByTestId('expand-panel-btn')).toBeInTheDocument();

    // Expand
    fireEvent.click(screen.getByTestId('expand-panel-btn'));

    // Input state is still preserved
    const restoredInput = screen.getByTestId('chat-input') as HTMLInputElement;
    expect(restoredInput.value).toBe('Important class note');
    expect(screen.getByTestId('tab-chat').getAttribute('aria-selected')).toBe('true');
  });

  it('supports mobile swipe-to-dismiss via rightward touch swipe', () => {
    render(<StudioSidePanel />);

    const panel = screen.getByTestId('studio-side-panel');
    expect(panel.getAttribute('data-collapsed')).toBe('false');

    // Touch start at clientX: 100, clientY: 200
    fireEvent.touchStart(panel, {
      touches: [{ clientX: 100, clientY: 200 }],
    });

    // Touch end at clientX: 220, clientY: 210 (swipe right by +120px)
    fireEvent.touchEnd(panel, {
      changedTouches: [{ clientX: 220, clientY: 210 }],
    });

    // Should collapse
    expect(panel.getAttribute('data-collapsed')).toBe('true');
  });

  it('renders ToolsTab properly and fires grid, page selection, and export events', () => {
    const handleChangeGrid = vi.fn();
    const handleSelectPage = vi.fn();
    const handleClonePage = vi.fn();
    const handleDeletePage = vi.fn();
    const handleExportPdf = vi.fn();
    const handleExportImage = vi.fn();

    render(
      <StudioSidePanel
        defaultTab="tools"
        pages={defaultPages}
        currentPageId="p-1"
        onChangeGrid={handleChangeGrid}
        onSelectPage={handleSelectPage}
        onClonePage={handleClonePage}
        onDeletePage={handleDeletePage}
        onExportPdf={handleExportPdf}
        onExportImage={handleExportImage}
      />
    );

    // Grid change
    fireEvent.click(screen.getByTestId('grid-option-dots'));
    expect(handleChangeGrid).toHaveBeenCalledWith('dots');

    // Page jump
    fireEvent.click(screen.getByTestId('jump-page-p-2'));
    expect(handleSelectPage).toHaveBeenCalledWith('p-2');

    // Page clone
    fireEvent.click(screen.getByTestId('clone-page-p-1'));
    expect(handleClonePage).toHaveBeenCalledWith('p-1');

    // Page delete
    fireEvent.click(screen.getByTestId('delete-page-p-2'));
    expect(handleDeletePage).toHaveBeenCalledWith('p-2');

    // Export PDF
    fireEvent.click(screen.getByTestId('export-pdf-btn'));
    expect(handleExportPdf).toHaveBeenCalledTimes(1);

    // Export Image
    fireEvent.click(screen.getByTestId('export-image-btn'));
    expect(handleExportImage).toHaveBeenCalledTimes(1);
  });
});
