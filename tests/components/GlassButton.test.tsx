import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GlassButton } from '../../src/components/ui/GlassButton';

// Extend expect for matchers in environments where jest-dom is not preloaded
expect.extend({
  toBeInTheDocument(received) {
    const pass = received !== null && received !== undefined && (received.ownerDocument?.body.contains(received) ?? false);
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be in document`,
    };
  },
  toHaveClass(received, className) {
    const pass = Boolean(received?.classList?.contains(className) || (received?.className && received.className.includes(className)));
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

describe('GlassButton Component (Emil Kowalski Tactile Glass)', () => {
  it('renders children and default glass styling correctly', () => {
    render(<GlassButton>Click Me</GlassButton>);
    const button = screen.getByRole('button', { name: /Click Me/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveClass('select-none');
    expect(button).toHaveClass('active:scale-[0.97]');
  });

  it('handles click events and invokes callback', () => {
    const handleClick = vi.fn();
    render(<GlassButton onClick={handleClick}>Action</GlassButton>);
    const button = screen.getByRole('button', { name: /Action/i });
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('does not trigger onClick when disabled', () => {
    const handleClick = vi.fn();
    render(<GlassButton onClick={handleClick} disabled>Disabled Action</GlassButton>);
    const button = screen.getByRole('button', { name: /Disabled Action/i });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it('applies variant classes correctly', () => {
    const { rerender } = render(<GlassButton variant="primary">Primary</GlassButton>);
    let button = screen.getByRole('button');
    expect(button.className).toMatch(/bg-indigo|border-indigo|bg-blue|from-indigo/i);

    rerender(<GlassButton variant="danger">Danger</GlassButton>);
    button = screen.getByRole('button');
    expect(button.className).toMatch(/border-red|bg-red|text-red/i);

    rerender(<GlassButton variant="active">Active</GlassButton>);
    button = screen.getByRole('button');
    expect(button.className).toMatch(/border-emerald|bg-emerald|text-emerald/i);

    rerender(<GlassButton variant="ghost">Ghost</GlassButton>);
    button = screen.getByRole('button');
    expect(button.className).toMatch(/bg-transparent|border-transparent/i);
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<GlassButton size="sm">Small</GlassButton>);
    let button = screen.getByRole('button');
    expect(button.className).toContain('text-xs');

    rerender(<GlassButton size="md">Medium</GlassButton>);
    button = screen.getByRole('button');
    expect(button.className).toContain('text-sm');

    rerender(<GlassButton size="lg">Large</GlassButton>);
    button = screen.getByRole('button');
    expect(button.className).toContain('text-base');
  });

  it('enforces mobile touch-action manipulation and tap highlight hygiene', () => {
    render(<GlassButton data-testid="touch-btn">Touch Me</GlassButton>);
    const button = screen.getByTestId('touch-btn');

    // Verify touch-action is manipulation via class, style, or attribute
    const hasTouchClass = button.classList.contains('touch-manipulation');
    const hasTouchAttr = button.getAttribute('touch-action') === 'manipulation' || button.getAttribute('data-touch-action') === 'manipulation';
    expect(hasTouchClass || hasTouchAttr).toBe(true);

    // Verify button contains active scale micro-interaction
    expect(button).toHaveClass('active:scale-[0.97]');
  });

  it('forwards refs properly to underlying HTML button', () => {
    const ref = React.createRef<HTMLButtonElement>();
    render(<GlassButton ref={ref}>Ref Button</GlassButton>);
    expect(ref.current).toBeInstanceOf(HTMLButtonElement);
  });
});
