import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ClassroomTimerWidget } from '../../src/components/classroom/ClassroomTimerWidget';

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
});

describe('ClassroomTimerWidget Component (Synchronized Classroom Timer & Stopwatch HUD)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders timer HUD when isOpen is true', () => {
    render(
      <ClassroomTimerWidget
        isOpen={true}
        onClose={vi.fn()}
        isTeacher={true}
      />
    );

    expect(screen.getByTestId('classroom-timer-widget')).toBeInTheDocument();
    expect(screen.getByText('05:00')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <ClassroomTimerWidget
        isOpen={false}
        onClose={vi.fn()}
        isTeacher={true}
      />
    );

    expect(screen.queryByTestId('classroom-timer-widget')).not.toBeInTheDocument();
  });

  it('selects countdown presets (1m, 3m, 5m)', () => {
    render(
      <ClassroomTimerWidget
        isOpen={true}
        onClose={vi.fn()}
        isTeacher={true}
      />
    );

    const preset1m = screen.getByRole('button', { name: /1m/i });
    fireEvent.click(preset1m);
    expect(screen.getByText('01:00')).toBeInTheDocument();

    const preset3m = screen.getByRole('button', { name: /3m/i });
    fireEvent.click(preset3m);
    expect(screen.getByText('03:00')).toBeInTheDocument();
  });

  it('counts down, emits timer state, and triggers onFinish when reaching 0', () => {
    const onBroadcast = vi.fn();
    const onFinish = vi.fn();

    render(
      <ClassroomTimerWidget
        isOpen={true}
        onClose={vi.fn()}
        isTeacher={true}
        onBroadcastTimerState={onBroadcast}
        onFinish={onFinish}
      />
    );

    // Pick 1m preset
    fireEvent.click(screen.getByRole('button', { name: /1m/i }));

    // Click Start
    const startBtn = screen.getByRole('button', { name: /start/i });
    fireEvent.click(startBtn);

    expect(onBroadcast).toHaveBeenCalledWith(
      expect.objectContaining({ isRunning: true, remainingSeconds: 60 })
    );

    // Advance 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(screen.getByText('00:30')).toBeInTheDocument();

    // Advance remaining 30 seconds
    act(() => {
      vi.advanceTimersByTime(30000);
    });

    expect(screen.getByText('00:00')).toBeInTheDocument();
    expect(onFinish).toHaveBeenCalled();
  });

  it('supports stopwatch mode counting upwards', () => {
    render(
      <ClassroomTimerWidget
        isOpen={true}
        onClose={vi.fn()}
        isTeacher={true}
      />
    );

    const stopwatchTab = screen.getByRole('button', { name: /stopwatch/i });
    fireEvent.click(stopwatchTab);

    expect(screen.getByText('00:00')).toBeInTheDocument();

    const startBtn = screen.getByRole('button', { name: /start/i });
    fireEvent.click(startBtn);

    act(() => {
      vi.advanceTimersByTime(15000);
    });

    expect(screen.getByText('00:15')).toBeInTheDocument();
  });

  it('reflects remote timer state for students without control buttons', () => {
    render(
      <ClassroomTimerWidget
        isOpen={true}
        onClose={vi.fn()}
        isTeacher={false}
        remoteTimerState={{
          mode: 'countdown',
          remainingSeconds: 145,
          initialSeconds: 300,
          isRunning: true,
          isAlarm: false,
        }}
      />
    );

    // 145 seconds = 02:25
    expect(screen.getByText('02:25')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /start/i })).not.toBeInTheDocument();
  });
});
