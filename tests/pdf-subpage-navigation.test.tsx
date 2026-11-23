import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { PdfSubPageNavigator } from '../src/components/whiteboard/PdfSubPageNavigator';
import { ClassroomWorkspace } from '../src/components/classroom/ClassroomWorkspace';
import { createDefaultWhiteboardPage } from '../src/types/whiteboard';

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

  it('strictly mounts PdfSubPageNavigator only when current page has multi-page document, and hides on blank pages', () => {
    const pageWithDoc = createDefaultWhiteboardPage('p1', 1, 'Math Worksheet');
    pageWithDoc.pdfDocument = {
      title: 'Math Worksheet',
      pages: ['data:image/png;base64,page1', 'data:image/png;base64,page2'],
      currentPage: 1,
      totalPages: 2,
    };
    const blankPage = createDefaultWhiteboardPage('p2', 2, 'Blank Notes');

    render(
      <ClassroomWorkspace
        roomId="room-test"
        initialPages={[pageWithDoc, blankPage]}
      />
    );

    // Active on Page 1: document navigator is visible
    const pdfNav = screen.getByTestId('pdf-subpage-navigator');
    expect(pdfNav).toBeDefined();
    expect(within(pdfNav).getByText('Page 1 of 2')).toBeDefined();

    // Switch to Page 2 (blank page): document navigator must be unmounted/hidden completely
    const blankTab = screen.getByTestId('tab-p2');
    fireEvent.click(blankTab);

    expect(screen.queryByTestId('pdf-subpage-navigator')).toBeNull();

    // Switch back to Page 1: document navigator reappears
    const docTab = screen.getByTestId('tab-p1');
    fireEvent.click(docTab);

    const pdfNavRestored = screen.getByTestId('pdf-subpage-navigator');
    expect(pdfNavRestored).toBeDefined();
    expect(within(pdfNavRestored).getByText('Page 1 of 2')).toBeDefined();
  });
});
