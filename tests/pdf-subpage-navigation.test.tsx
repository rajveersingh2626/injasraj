import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PdfSubPageNavigator } from '../src/components/whiteboard/PdfSubPageNavigator';

describe('PdfSubPageNavigator Component', () => {
  it('renders nothing if totalPages <= 1', () => {
    const { container } = render(
      <PdfSubPageNavigator
        currentPage={1}
        totalPages={1}
        onPageChange={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders current page and total pages when totalPages > 1', () => {
    render(
      <PdfSubPageNavigator
        currentPage={2}
        totalPages={5}
        onPageChange={vi.fn()}
        documentTitle="Calculus Worksheet"
      />
    );

    expect(screen.getByText('Page 2 of 5')).toBeDefined();
    expect(screen.getByText('Calculus Worksheet')).toBeDefined();
  });

  it('triggers onPageChange when clicking next and prev', () => {
    const onPageChange = vi.fn();
    render(
      <PdfSubPageNavigator
        currentPage={2}
        totalPages={5}
        onPageChange={onPageChange}
      />
    );

    const prevBtn = screen.getByLabelText('Previous PDF Page');
    const nextBtn = screen.getByLabelText('Next PDF Page');

    fireEvent.click(prevBtn);
    expect(onPageChange).toHaveBeenCalledWith(1);

    fireEvent.click(nextBtn);
    expect(onPageChange).toHaveBeenCalledWith(3);
  });

  it('disables prev button on first page and next button on last page', () => {
    const { rerender } = render(
      <PdfSubPageNavigator
        currentPage={1}
        totalPages={3}
        onPageChange={vi.fn()}
      />
    );

    const prevBtn = screen.getByLabelText('Previous PDF Page') as HTMLButtonElement;
    expect(prevBtn.disabled).toBe(true);

    rerender(
      <PdfSubPageNavigator
        currentPage={3}
        totalPages={3}
        onPageChange={vi.fn()}
      />
    );

    const nextBtn = screen.getByLabelText('Next PDF Page') as HTMLButtonElement;
    expect(nextBtn.disabled).toBe(true);
  });
});
