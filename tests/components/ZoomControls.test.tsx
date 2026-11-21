import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ZoomControls } from '../../src/components/whiteboard/ZoomControls';

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

describe('ZoomControls Component (Bottom-Left Glass Dock)', () => {
  it('renders zoom percentage and triggers zoom actions', () => {
    const handleZoomIn = vi.fn();
    const handleZoomOut = vi.fn();
    const handleResetZoom = vi.fn();
    const handleFitToScreen = vi.fn();

    render(
      <ZoomControls
        zoom={1.25}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onResetZoom={handleResetZoom}
        onFitToScreen={handleFitToScreen}
      />
    );

    // Displays percentage (125%)
    const pctBtn = screen.getByTestId('zoom-percentage-btn');
    expect(pctBtn.textContent).toContain('125%');

    // Zoom in
    fireEvent.click(screen.getByTestId('zoom-in-btn'));
    expect(handleZoomIn).toHaveBeenCalledTimes(1);

    // Zoom out
    fireEvent.click(screen.getByTestId('zoom-out-btn'));
    expect(handleZoomOut).toHaveBeenCalledTimes(1);

    // Reset zoom
    fireEvent.click(pctBtn);
    expect(handleResetZoom).toHaveBeenCalledTimes(1);

    // Fit to screen
    fireEvent.click(screen.getByTestId('zoom-fit-btn'));
    expect(handleFitToScreen).toHaveBeenCalledTimes(1);
  });

  it('disables zoom out button when minZoom is reached', () => {
    render(
      <ZoomControls
        zoom={0.1}
        minZoom={0.1}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
      />
    );

    const zoomOutBtn = screen.getByTestId('zoom-out-btn');
    expect(zoomOutBtn).toBeDisabled();
  });

  it('disables zoom in button when maxZoom is reached', () => {
    render(
      <ZoomControls
        zoom={5.0}
        maxZoom={5.0}
        onZoomIn={vi.fn()}
        onZoomOut={vi.fn()}
      />
    );

    const zoomInBtn = screen.getByTestId('zoom-in-btn');
    expect(zoomInBtn).toBeDisabled();
  });
});
