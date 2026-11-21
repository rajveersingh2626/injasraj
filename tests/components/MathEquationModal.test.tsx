import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MathEquationModal } from '../../src/components/whiteboard/MathEquationModal';

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

describe('MathEquationModal Component (LaTeX Math Formula Tool)', () => {
  it('renders modal when isOpen is true', () => {
    render(
      <MathEquationModal
        isOpen={true}
        onClose={vi.fn()}
        onInsertEquation={vi.fn()}
      />
    );

    expect(screen.getByTestId('math-equation-modal')).toBeInTheDocument();
    expect(screen.getByText(/insert math formula/i)).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <MathEquationModal
        isOpen={false}
        onClose={vi.fn()}
        onInsertEquation={vi.fn()}
      />
    );

    expect(screen.queryByTestId('math-equation-modal')).not.toBeInTheDocument();
  });

  it('inserts symbol snippets when clicking math symbol palette buttons', () => {
    render(
      <MathEquationModal
        isOpen={true}
        onClose={vi.fn()}
        onInsertEquation={vi.fn()}
      />
    );

    const fractionBtn = screen.getByRole('button', { name: /fraction/i });
    fireEvent.click(fractionBtn);

    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    expect(textarea.value).toContain('\\frac');
  });

  it('calls onInsertEquation with LaTeX string and SVG data URL when Insert is clicked', () => {
    const onInsert = vi.fn();
    render(
      <MathEquationModal
        isOpen={true}
        onClose={vi.fn()}
        onInsertEquation={onInsert}
      />
    );

    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: 'E = mc^2' } });

    const insertBtn = screen.getByRole('button', { name: /insert on canvas/i });
    fireEvent.click(insertBtn);

    expect(onInsert).toHaveBeenCalledWith(
      'E = mc^2',
      expect.stringMatching(/^data:image\/svg\+xml/)
    );
  });

  it('calls onClose when close or cancel button is clicked', () => {
    const onClose = vi.fn();
    render(
      <MathEquationModal
        isOpen={true}
        onClose={onClose}
        onInsertEquation={vi.fn()}
      />
    );

    const cancelBtn = screen.getByRole('button', { name: /cancel/i });
    fireEvent.click(cancelBtn);
    expect(onClose).toHaveBeenCalled();
  });
});
