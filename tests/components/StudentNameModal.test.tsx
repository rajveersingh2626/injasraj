import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  StudentNameModal,
  STUDENT_NAME_STORAGE_KEY,
} from '../../src/components/classroom/StudentNameModal';

// Extend expect for jest-dom matchers
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
  toHaveTextContent(received, expected) {
    const content = received?.textContent ?? '';
    const pass =
      expected instanceof RegExp ? expected.test(content) : content.includes(expected);
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}have text content ${expected}`,
    };
  },
});

describe('StudentNameModal Component', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('does not render when isOpen is false', () => {
    render(<StudentNameModal isOpen={false} onJoin={vi.fn()} />);
    expect(screen.queryByTestId('student-name-modal')).toBeNull();
  });

  it('renders modal with input field and submit button when isOpen is true', () => {
    render(<StudentNameModal isOpen={true} onJoin={vi.fn()} />);

    expect(screen.getByTestId('student-name-modal')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Class')).toBeInTheDocument();
    expect(screen.getByTestId('student-display-name-input')).toBeInTheDocument();
    expect(screen.getByTestId('student-name-submit-btn')).toBeInTheDocument();
  });

  it('shows error validation if user attempts to submit empty name', () => {
    const onJoin = vi.fn();
    render(<StudentNameModal isOpen={true} onJoin={onJoin} />);

    const submitBtn = screen.getByTestId('student-name-submit-btn');
    fireEvent.click(submitBtn);

    expect(screen.getByTestId('student-name-error')).toHaveTextContent(
      'Please enter your name to join the classroom.'
    );
    expect(onJoin).not.toHaveBeenCalled();
  });

  it('saves name to localStorage and calls onJoin when submitted with valid name', () => {
    const onJoin = vi.fn();
    render(<StudentNameModal isOpen={true} onJoin={onJoin} />);

    const input = screen.getByTestId('student-display-name-input');
    fireEvent.change(input, { target: { value: 'Harpreet Kaur' } });

    const submitBtn = screen.getByTestId('student-name-submit-btn');
    fireEvent.click(submitBtn);

    expect(localStorage.getItem(STUDENT_NAME_STORAGE_KEY)).toBe('Harpreet Kaur');
    expect(onJoin).toHaveBeenCalledWith('Harpreet Kaur');
  });
});
