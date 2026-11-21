import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { PageNavigationBar } from '../../src/components/whiteboard/PageNavigationBar';

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
  toBeDisabled(received) {
    const pass = Boolean(received?.disabled || received?.hasAttribute('disabled'));
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be disabled`,
    };
  },
});

describe('PageNavigationBar Component (Floating Top Glass Pill)', () => {
  it('renders current page indicator text accurately', () => {
    render(
      <PageNavigationBar
        currentPage={2}
        totalPages={5}
        onPageChange={vi.fn()}
      />
    );

    const indicator = screen.getByTestId('page-indicator');
    expect(indicator).toBeInTheDocument();
    expect(indicator.textContent).toContain('Page 2 of 5');
  });

  it('navigates to next page on next button click when not on last page', () => {
    const handlePageChange = vi.fn();
    render(
      <PageNavigationBar
        currentPage={2}
        totalPages={5}
        onPageChange={handlePageChange}
      />
    );

    const nextBtn = screen.getByTestId('next-page-btn');
    expect(nextBtn).not.toBeDisabled();

    fireEvent.click(nextBtn);
    expect(handlePageChange).toHaveBeenCalledWith(3);
  });

  it('navigates to previous page on prev button click when not on first page', () => {
    const handlePageChange = vi.fn();
    render(
      <PageNavigationBar
        currentPage={3}
        totalPages={5}
        onPageChange={handlePageChange}
      />
    );

    const prevBtn = screen.getByTestId('prev-page-btn');
    expect(prevBtn).not.toBeDisabled();

    fireEvent.click(prevBtn);
    expect(handlePageChange).toHaveBeenCalledWith(2);
  });

  it('disables previous button on boundary page 1', () => {
    const handlePageChange = vi.fn();
    render(
      <PageNavigationBar
        currentPage={1}
        totalPages={4}
        onPageChange={handlePageChange}
      />
    );

    const prevBtn = screen.getByTestId('prev-page-btn');
    expect(prevBtn).toBeDisabled();

    fireEvent.click(prevBtn);
    expect(handlePageChange).not.toHaveBeenCalled();
  });

  it('disables next button on boundary last page', () => {
    const handlePageChange = vi.fn();
    render(
      <PageNavigationBar
        currentPage={4}
        totalPages={4}
        onPageChange={handlePageChange}
      />
    );

    const nextBtn = screen.getByTestId('next-page-btn');
    expect(nextBtn).toBeDisabled();

    fireEvent.click(nextBtn);
    expect(handlePageChange).not.toHaveBeenCalled();
  });

  it('triggers onAddPage when add page button is clicked', () => {
    const handleAddPage = vi.fn();
    render(
      <PageNavigationBar
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        onAddPage={handleAddPage}
        canAddPage={true}
      />
    );

    const addBtn = screen.getByTestId('add-page-btn');
    expect(addBtn).toBeInTheDocument();
    expect(addBtn).not.toBeDisabled();

    fireEvent.click(addBtn);
    expect(handleAddPage).toHaveBeenCalledTimes(1);
  });

  it('disables add page button when canAddPage is false (e.g. student permissions)', () => {
    const handleAddPage = vi.fn();
    render(
      <PageNavigationBar
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        onAddPage={handleAddPage}
        canAddPage={false}
      />
    );

    const addBtn = screen.getByTestId('add-page-btn');
    expect(addBtn).toBeDisabled();

    fireEvent.click(addBtn);
    expect(handleAddPage).not.toHaveBeenCalled();
  });

  it('toggles thumbnail drawer on button click and reflects active state', () => {
    const handleToggleThumbnails = vi.fn();
    const { rerender } = render(
      <PageNavigationBar
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        onToggleThumbnails={handleToggleThumbnails}
        isThumbnailsOpen={false}
      />
    );

    const toggleBtn = screen.getByTestId('toggle-thumbnails-btn');
    expect(toggleBtn.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(toggleBtn);
    expect(handleToggleThumbnails).toHaveBeenCalledTimes(1);

    // Re-render with isThumbnailsOpen = true
    rerender(
      <PageNavigationBar
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
        onToggleThumbnails={handleToggleThumbnails}
        isThumbnailsOpen={true}
      />
    );

    const activeToggleBtn = screen.getByTestId('toggle-thumbnails-btn');
    expect(activeToggleBtn.getAttribute('aria-pressed')).toBe('true');
    expect(activeToggleBtn).toHaveClass('bg-white/20');
  });
});
