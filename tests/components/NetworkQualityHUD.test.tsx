import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NetworkQualityHUD } from '../../src/components/ui/NetworkQualityHUD';
import { ConnectionQuality } from '../../src/types/media';

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
});

describe('NetworkQualityHUD Component', () => {
  it('displays green dot for direct connection with good RTT (<150ms)', () => {
    const quality: ConnectionQuality = {
      status: 'good',
      rttMs: 64,
      packetLossPercent: 0,
      connectionType: 'direct',
      isAudioPrioritized: false,
    };
    render(<NetworkQualityHUD quality={quality} />);
    
    const dot = screen.getByTestId('status-dot');
    expect(dot).toHaveClass('bg-emerald-400');
    expect(screen.getByText(/64ms/i)).toBeInTheDocument();
  });

  it('displays amber dot for relayed link or moderate latency (150-350ms)', () => {
    const quality: ConnectionQuality = {
      status: 'fair',
      rttMs: 220,
      packetLossPercent: 1.5,
      connectionType: 'relay',
      isAudioPrioritized: true,
    };
    render(<NetworkQualityHUD quality={quality} />);

    const dot = screen.getByTestId('status-dot');
    expect(dot).toHaveClass('bg-amber-400');
  });

  it('displays rose dot for high packet loss (>5%) or high RTT (>350ms)', () => {
    const quality: ConnectionQuality = {
      status: 'poor',
      rttMs: 400,
      packetLossPercent: 6,
      connectionType: 'direct',
      isAudioPrioritized: true,
    };
    render(<NetworkQualityHUD quality={quality} />);

    const dot = screen.getByTestId('status-dot');
    expect(dot).toHaveClass('bg-rose-400');
  });

  it('opens and closes popover on hud-trigger click', () => {
    const quality: ConnectionQuality = {
      status: 'fair',
      rttMs: 220,
      packetLossPercent: 1.5,
      connectionType: 'relay',
      isAudioPrioritized: true,
    };
    render(<NetworkQualityHUD quality={quality} />);

    // Initially popover is not visible
    expect(screen.queryByTestId('hud-popover')).not.toBeInTheDocument();

    // Click trigger to open
    const trigger = screen.getByTestId('hud-trigger');
    fireEvent.click(trigger);

    const popover = screen.getByTestId('hud-popover');
    expect(popover).toBeInTheDocument();
    expect(within(popover).getByText('Relayed Link (TURN)')).toBeInTheDocument();
    expect(within(popover).getByText(/Audio Prioritized - Conserving Bandwidth/i)).toBeInTheDocument();

    // Click trigger again to close
    fireEvent.click(trigger);
    expect(screen.queryByTestId('hud-popover')).not.toBeInTheDocument();
  });

  it('displays detailed telemetry (RTT, Loss, Resolution, FPS) in popover', () => {
    const quality: ConnectionQuality = {
      status: 'good',
      rttMs: 45,
      packetLossPercent: 0.2,
      connectionType: 'direct',
      isAudioPrioritized: false,
      videoResolution: { width: 1280, height: 720 },
      fps: 30,
    };
    render(<NetworkQualityHUD quality={quality} />);

    fireEvent.click(screen.getByTestId('hud-trigger'));

    const popover = screen.getByTestId('hud-popover');
    expect(within(popover).getByText('Direct Peer-to-Peer')).toBeInTheDocument();
    expect(within(popover).getByText(/45\s*ms/i)).toBeInTheDocument();
    expect(within(popover).getByText(/0\.2\s*%/i)).toBeInTheDocument();
    expect(within(popover).getByText(/1280\s*x\s*720/i)).toBeInTheDocument();
    expect(within(popover).getByText(/30\s*fps/i)).toBeInTheDocument();

    // Audio priority banner should NOT appear when false
    expect(screen.queryByText(/Audio Prioritized - Conserving Bandwidth/i)).not.toBeInTheDocument();
  });

  it('shows Audio-Priority banner when isAudioPrioritized is true', () => {
    const quality: ConnectionQuality = {
      status: 'fair',
      rttMs: 180,
      packetLossPercent: 2.1,
      connectionType: 'relay',
      isAudioPrioritized: true,
    };
    render(<NetworkQualityHUD quality={quality} />);

    fireEvent.click(screen.getByTestId('hud-trigger'));

    const popover = screen.getByTestId('hud-popover');
    expect(within(popover).getByText(/Audio Prioritized - Conserving Bandwidth/i)).toBeInTheDocument();
  });
});
