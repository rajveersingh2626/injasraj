import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import {
  ColorStrokePopover,
  COLOR_SWATCHES,
  STROKE_WIDTH_PRESETS,
} from '../../src/components/whiteboard/ColorStrokePopover';

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

describe('ColorStrokePopover Component (Emil-Grade Origin-Aware Popover)', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    strokeProperties: { color: '#3b82f6', width: 4 },
    onChange: vi.fn(),
  };

  it('does not render in the DOM when isOpen is false', () => {
    render(<ColorStrokePopover {...defaultProps} isOpen={false} />);
    expect(screen.queryByTestId('color-stroke-popover')).toBeNull();
  });

  it('renders all 6 specification swatches and 4 stroke width presets when isOpen is true', () => {
    render(<ColorStrokePopover {...defaultProps} />);
    const popover = screen.getByTestId('color-stroke-popover');
    expect(popover).toBeInTheDocument();

    // Verify all 6 specification swatches exist
    const expectedHexes = ['#ffffff', '#3b82f6', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6'];
    expectedHexes.forEach((hex) => {
      const swatchBtn = screen.getByTestId(`color-swatch-${hex.replace('#', '')}`);
      expect(swatchBtn).toBeInTheDocument();
    });

    // Verify all 4 stroke width presets exist
    const expectedWidths = [2, 4, 8, 16];
    expectedWidths.forEach((width) => {
      const widthBtn = screen.getByTestId(`stroke-width-${width}`);
      expect(widthBtn).toBeInTheDocument();
    });
  });

  it('invokes onChange with clicked color swatch', () => {
    const handleChange = vi.fn();
    render(<ColorStrokePopover {...defaultProps} onChange={handleChange} />);

    // Click Red swatch (#ef4444)
    const redSwatch = screen.getByTestId('color-swatch-ef4444');
    fireEvent.click(redSwatch);

    expect(handleChange).toHaveBeenCalledWith({ color: '#ef4444' });

    // Click Emerald swatch (#10b981)
    const emeraldSwatch = screen.getByTestId('color-swatch-10b981');
    fireEvent.click(emeraldSwatch);

    expect(handleChange).toHaveBeenCalledWith({ color: '#10b981' });
  });

  it('highlights currently selected color with active ring and radio checked status', () => {
    render(
      <ColorStrokePopover
        {...defaultProps}
        strokeProperties={{ color: '#ef4444', width: 8 }}
      />
    );

    const redSwatch = screen.getByTestId('color-swatch-ef4444');
    expect(redSwatch.getAttribute('aria-checked')).toBe('true');
    expect(redSwatch).toHaveClass('ring-2');

    const blueSwatch = screen.getByTestId('color-swatch-3b82f6');
    expect(blueSwatch.getAttribute('aria-checked')).toBe('false');
  });

  it('invokes onChange with selected stroke width preset', () => {
    const handleChange = vi.fn();
    render(<ColorStrokePopover {...defaultProps} onChange={handleChange} />);

    // Select Bold (8px)
    const boldBtn = screen.getByTestId('stroke-width-8');
    fireEvent.click(boldBtn);

    expect(handleChange).toHaveBeenCalledWith({ width: 8 });

    // Select Highlighter (16px)
    const highBtn = screen.getByTestId('stroke-width-16');
    fireEvent.click(highBtn);

    expect(handleChange).toHaveBeenCalledWith({ width: 16 });
  });

  it('highlights currently active stroke width preset', () => {
    render(
      <ColorStrokePopover
        {...defaultProps}
        strokeProperties={{ color: '#ffffff', width: 8 }}
      />
    );

    const boldBtn = screen.getByTestId('stroke-width-8');
    expect(boldBtn.getAttribute('aria-checked')).toBe('true');
    expect(boldBtn).toHaveClass('bg-white/15');

    const fineBtn = screen.getByTestId('stroke-width-2');
    expect(fineBtn.getAttribute('aria-checked')).toBe('false');
  });

  it('calls onClose when Escape key is pressed', () => {
    const handleClose = vi.fn();
    render(<ColorStrokePopover {...defaultProps} onClose={handleClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when clicking outside the popover', () => {
    const handleClose = vi.fn();
    render(
      <div>
        <div data-testid="outside-element">Outside</div>
        <ColorStrokePopover {...defaultProps} onClose={handleClose} />
      </div>
    );

    const outside = screen.getByTestId('outside-element');
    fireEvent.mouseDown(outside);

    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it('applies origin-aware transform and scale(0.95) enter animation', () => {
    const { container } = render(
      <ColorStrokePopover {...defaultProps} position="top" />
    );
    const popover = screen.getByTestId('color-stroke-popover');
    expect(popover.style.transformOrigin).toBe('bottom center');
    expect(popover.style.animation).toContain('colorStrokePopoverEnter');
  });
});
