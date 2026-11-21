import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  RewardCelebrationOverlay,
  RewardEvent,
} from '../../src/components/classroom/RewardCelebrationOverlay';

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

describe('RewardCelebrationOverlay Component (Celebratory Student Badges & Confetti)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders celebratory overlay when activeReward is provided', () => {
    const reward: RewardEvent = {
      id: 'reward-1',
      type: 'star',
      teacherName: 'Dr. Emily',
      message: 'Outstanding Solution!',
      timestamp: Date.now(),
    };

    render(
      <RewardCelebrationOverlay
        activeReward={reward}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.getByTestId('reward-celebration-overlay')).toBeInTheDocument();
    expect(screen.getByText('Outstanding Solution!')).toBeInTheDocument();
    expect(screen.getByText(/awarded by dr\. emily/i)).toBeInTheDocument();
  });

  it('does not render when activeReward is null', () => {
    render(
      <RewardCelebrationOverlay
        activeReward={null}
        onDismiss={vi.fn()}
      />
    );

    expect(screen.queryByTestId('reward-celebration-overlay')).not.toBeInTheDocument();
  });

  it('automatically decays and calls onDismiss after 3.5 seconds', () => {
    const onDismiss = vi.fn();
    const reward: RewardEvent = {
      id: 'reward-2',
      type: 'trophy',
      teacherName: 'Prof. Alan',
      message: 'Lesson Milestone Reached!',
      timestamp: Date.now(),
    };

    render(
      <RewardCelebrationOverlay
        activeReward={reward}
        onDismiss={onDismiss}
      />
    );

    expect(onDismiss).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(3500);
    });

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('calls onDismiss immediately when user clicks anywhere on overlay', () => {
    const onDismiss = vi.fn();
    const reward: RewardEvent = {
      id: 'reward-3',
      type: 'sparkles',
      teacherName: 'Tutor Sarah',
      timestamp: Date.now(),
    };

    render(
      <RewardCelebrationOverlay
        activeReward={reward}
        onDismiss={onDismiss}
      />
    );

    const overlay = screen.getByTestId('reward-celebration-overlay');
    fireEvent.click(overlay);

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
