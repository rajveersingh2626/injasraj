import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  MaterialsTab,
  WorksheetMaterial,
  DEFAULT_WORKSHEETS,
} from '../../src/components/whiteboard/tabs/MaterialsTab';

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

describe('MaterialsTab Component (Worksheet Library & PDF Upload)', () => {
  const customWorksheets: WorksheetMaterial[] = [
    {
      id: 'ws-chem-01',
      title: 'Chemistry: Chemical Bonding and Lewis Structures',
      description: 'Covalent and ionic bonds practice problems',
      url: 'https://example.com/chem-bonding.pdf',
      category: 'Chemistry',
      pageCount: 2,
    },
    {
      id: 'ws-bio-01',
      title: 'Biology: Cell Respiration Guided Worksheet',
      description: 'Glycolysis and Krebs cycle step-by-step',
      url: 'https://example.com/bio-respiration.pdf',
      category: 'Biology',
      pageCount: 4,
    },
  ];

  it('renders worksheet library with titles, categories, and load buttons', () => {
    const handleLoadWorksheet = vi.fn();
    render(
      <MaterialsTab
        onLoadWorksheet={handleLoadWorksheet}
        worksheets={customWorksheets}
      />
    );

    expect(screen.getByText('Chemistry: Chemical Bonding and Lewis Structures')).toBeInTheDocument();
    expect(screen.getByText('Biology: Cell Respiration Guided Worksheet')).toBeInTheDocument();
    expect(screen.getByText('Chemistry')).toBeInTheDocument();
    expect(screen.getByText('Biology')).toBeInTheDocument();

    const loadButtons = screen.getAllByRole('button', { name: /Load into Whiteboard/i });
    expect(loadButtons.length).toBe(2);
  });

  it('invokes onLoadWorksheet with worksheet URL when sample worksheet is clicked', () => {
    const handleLoadWorksheet = vi.fn();
    render(
      <MaterialsTab
        onLoadWorksheet={handleLoadWorksheet}
        worksheets={customWorksheets}
      />
    );

    const loadChemBtn = screen.getByTestId('load-worksheet-ws-chem-01');
    fireEvent.click(loadChemBtn);

    expect(handleLoadWorksheet).toHaveBeenCalledTimes(1);
    expect(handleLoadWorksheet).toHaveBeenCalledWith('https://example.com/chem-bonding.pdf');
  });

  it('handles PDF file selection via input and triggers onLoadWorksheet with File object', () => {
    const handleLoadWorksheet = vi.fn();
    render(<MaterialsTab onLoadWorksheet={handleLoadWorksheet} />);

    const fileInput = screen.getByTestId('pdf-file-input') as HTMLInputElement;
    expect(fileInput).toBeInTheDocument();
    expect(fileInput.getAttribute('accept')).toBe('application/pdf');

    const fakePdfFile = new File(['%PDF-1.4 mock content'], 'algebra_quiz.pdf', {
      type: 'application/pdf',
    });

    fireEvent.change(fileInput, {
      target: { files: [fakePdfFile] },
    });

    expect(handleLoadWorksheet).toHaveBeenCalledWith(fakePdfFile);
    expect(screen.getByText('algebra_quiz.pdf')).toBeInTheDocument();

    // Clicking the explicit load button also triggers load
    const loadPdfBtn = screen.getByTestId('load-pdf-button');
    expect(loadPdfBtn).toBeInTheDocument();
    fireEvent.click(loadPdfBtn);
    expect(handleLoadWorksheet).toHaveBeenCalledWith(fakePdfFile);
  });

  it('triggers file input click when upload trigger button is clicked', () => {
    const handleLoadWorksheet = vi.fn();
    render(<MaterialsTab onLoadWorksheet={handleLoadWorksheet} />);

    const fileInput = screen.getByTestId('pdf-file-input') as HTMLInputElement;
    const clickSpy = vi.spyOn(fileInput, 'click');

    const triggerBtn = screen.getByTestId('upload-pdf-trigger-btn');
    fireEvent.click(triggerBtn);

    expect(clickSpy).toHaveBeenCalledTimes(1);
  });

  it('shows loading indicator and disables load buttons during worksheet loading', () => {
    const handleLoadWorksheet = vi.fn();
    render(
      <MaterialsTab
        onLoadWorksheet={handleLoadWorksheet}
        worksheets={customWorksheets}
        isLoading={true}
      />
    );

    expect(screen.getByTestId('materials-loading')).toBeInTheDocument();

    const loadChemBtn = screen.getByTestId('load-worksheet-ws-chem-01');
    expect(loadChemBtn).toBeDisabled();
  });
});
