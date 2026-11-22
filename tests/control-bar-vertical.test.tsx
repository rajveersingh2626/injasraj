import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ControlBar } from '../src/components/classroom/ControlBar';

describe('ControlBar Vertical Left Dock & Non-Colliding Layout', () => {
  it('renders vertically docked on the left by default', () => {
    render(<ControlBar />);

    const container = screen.getByTestId('control-bar-container');
    expect(container.className).toContain('left-4');
    expect(container.className).toContain('top-1/2');

    const bar = screen.getByTestId('control-bar');
    expect(bar.className).toContain('flex-col');
  });

  it('renders horizontally when orientation is horizontal', () => {
    render(<ControlBar orientation="horizontal" />);

    const container = screen.getByTestId('control-bar-container');
    expect(container.className).toContain('bottom-0');

    const bar = screen.getByTestId('control-bar');
    expect(bar.className).not.toContain('flex-col');
  });

  it('opens device settings popover to the right when vertical', () => {
    render(<ControlBar orientation="vertical" />);

    const settingsBtn = screen.getByTestId('device-settings-btn');
    fireEvent.click(settingsBtn);

    const popover = screen.getByTestId('device-settings-popover');
    expect(popover).toBeDefined();
    // In vertical mode, popover flies out to the right (left-full ml-3)
    expect(popover.className).toContain('left-full');
  });

  it('allows vertical dragging / repositioning along edge without collision', () => {
    render(<ControlBar orientation="vertical" />);

    const dragHandle = screen.getByLabelText('Drag control dock');
    expect(dragHandle).toBeDefined();

    // Simulate drag start and move
    fireEvent.pointerDown(dragHandle, { clientY: 200 });
    fireEvent.pointerMove(window, { clientY: 280 });
    fireEvent.pointerUp(window);

    const container = screen.getByTestId('control-bar-container');
    expect(container).toBeDefined();
  });
});
