import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { GlassCard } from '../../src/components/ui/GlassCard';

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
});

describe('GlassCard Component (Dark Glassmorphic Container)', () => {
  it('renders children with dark glass styling and specular hairline border', () => {
    render(<GlassCard data-testid="glass-card">Card Content</GlassCard>);
    const card = screen.getByTestId('glass-card');
    expect(card).toBeInTheDocument();
    expect(card).toHaveClass('rounded-2xl');
    expect(card).toHaveClass('backdrop-blur-[16px]');
    expect(card.textContent).toBe('Card Content');
  });

  it('renders subtle variant with softer opacity and border', () => {
    render(<GlassCard variant="subtle" data-testid="glass-card">Subtle Content</GlassCard>);
    const card = screen.getByTestId('glass-card');
    expect(card.className).toContain('bg-[#09090b]/60');
  });

  it('handles interactive mode with tactile press scaling and click callback', () => {
    const handleClick = vi.fn();
    render(<GlassCard interactive onClick={handleClick} data-testid="interactive-card">Clickable Card</GlassCard>);
    const card = screen.getByTestId('interactive-card');
    
    expect(card).toHaveClass('active:scale-[0.97]');
    expect(card).toHaveClass('cursor-pointer');
    expect(card).toHaveClass('touch-manipulation');

    fireEvent.click(card);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('automatically applies interactive styling when onClick is provided', () => {
    const handleClick = vi.fn();
    render(<GlassCard onClick={handleClick} data-testid="onclick-card">Auto-interactive</GlassCard>);
    const card = screen.getByTestId('onclick-card');
    expect(card).toHaveClass('active:scale-[0.97]');
  });

  it('forwards refs properly to underlying HTML div element', () => {
    const ref = React.createRef<HTMLDivElement>();
    render(<GlassCard ref={ref}>Ref Card</GlassCard>);
    expect(ref.current).toBeInstanceOf(HTMLDivElement);
  });
});
