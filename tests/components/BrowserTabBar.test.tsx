import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BrowserTabBar } from '../../src/components/whiteboard/BrowserTabBar';
import { WhiteboardPage } from '../../src/types/whiteboard';

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

const mockPages: WhiteboardPage[] = [
  { id: 'page-1', pageNumber: 1, title: 'Calculus Warmup', canvasJson: {} },
  { id: 'page-2', pageNumber: 2, title: 'Derivatives Worksheet', canvasJson: {} },
  { id: 'page-3', pageNumber: 3, title: 'Homework Notes', canvasJson: {} },
];

describe('BrowserTabBar Component (Chrome/Arc-style Whiteboard Tabs)', () => {
  it('renders all page tabs with titles and page indicators', () => {
    render(
      <BrowserTabBar
        pages={mockPages}
        activePageId="page-1"
        onSelectTab={vi.fn()}
        onAddTab={vi.fn()}
      />
    );

    expect(screen.getByText('Calculus Warmup')).toBeInTheDocument();
    expect(screen.getByText('Derivatives Worksheet')).toBeInTheDocument();
    expect(screen.getByText('Homework Notes')).toBeInTheDocument();
  });

  it('marks active tab with distinctive style and calls onSelectTab when another tab is clicked', () => {
    const onSelect = vi.fn();
    render(
      <BrowserTabBar
        pages={mockPages}
        activePageId="page-2"
        onSelectTab={onSelect}
        onAddTab={vi.fn()}
      />
    );

    const activeTab = screen.getByTestId('tab-page-2');
    expect(activeTab).toHaveClass('active-tab');

    const firstTab = screen.getByTestId('tab-page-1');
    fireEvent.click(firstTab);
    expect(onSelect).toHaveBeenCalledWith('page-1');
  });

  it('triggers onAddTab when the plus button is clicked', () => {
    const onAdd = vi.fn();
    render(
      <BrowserTabBar
        pages={mockPages}
        activePageId="page-1"
        onSelectTab={vi.fn()}
        onAddTab={onAdd}
      />
    );

    const addBtn = screen.getByRole('button', { name: /new whiteboard tab/i });
    fireEvent.click(addBtn);
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('allows renaming a tab via double click and pressing Enter', () => {
    const onRename = vi.fn();
    render(
      <BrowserTabBar
        pages={mockPages}
        activePageId="page-1"
        onSelectTab={vi.fn()}
        onAddTab={vi.fn()}
        onRenameTab={onRename}
      />
    );

    const titleElement = screen.getByText('Calculus Warmup');
    fireEvent.doubleClick(titleElement);

    const input = screen.getByDisplayValue('Calculus Warmup');
    fireEvent.change(input, { target: { value: 'Integral Calculus' } });
    fireEvent.keyDown(input, { key: 'Enter', code: 'Enter' });

    expect(onRename).toHaveBeenCalledWith('page-1', 'Integral Calculus');
  });

  it('triggers onCloseTab when close button is clicked on a tab', () => {
    const onClose = vi.fn();
    render(
      <BrowserTabBar
        pages={mockPages}
        activePageId="page-1"
        onSelectTab={vi.fn()}
        onAddTab={vi.fn()}
        onCloseTab={onClose}
      />
    );

    const closeBtn = screen.getByTestId('close-tab-page-2');
    fireEvent.click(closeBtn);
    expect(onClose).toHaveBeenCalledWith('page-2');
  });

  it('hides close button when only a single tab exists', () => {
    render(
      <BrowserTabBar
        pages={[mockPages[0]]}
        activePageId="page-1"
        onSelectTab={vi.fn()}
        onAddTab={vi.fn()}
        onCloseTab={vi.fn()}
      />
    );

    expect(screen.queryByTestId('close-tab-page-1')).not.toBeInTheDocument();
  });
});
