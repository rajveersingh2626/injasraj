import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ControlBar } from '../../src/components/classroom/ControlBar';

// Extend expect for matchers in environments where jest-dom is not preloaded
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

describe('ControlBar Component (Tactile Dark-Glass Controls)', () => {
  const mockAudioDevices: MediaDeviceInfo[] = [
    {
      deviceId: 'mic-1',
      kind: 'audioinput',
      label: 'MacBook Built-in Mic',
      groupId: 'g1',
      toJSON: () => ({}),
    },
    {
      deviceId: 'mic-2',
      kind: 'audioinput',
      label: 'AirPods Pro',
      groupId: 'g2',
      toJSON: () => ({}),
    },
  ];

  const mockVideoDevices: MediaDeviceInfo[] = [
    {
      deviceId: 'cam-1',
      kind: 'videoinput',
      label: 'FaceTime HD Camera',
      groupId: 'g1',
      toJSON: () => ({}),
    },
    {
      deviceId: 'cam-2',
      kind: 'videoinput',
      label: 'External 4K Cam',
      groupId: 'g3',
      toJSON: () => ({}),
    },
  ];

  describe('Microphone Toggle & Tactile Feedback', () => {
    it('invokes onToggleMic callback when clicked', () => {
      const handleToggleMic = vi.fn();
      render(
        <ControlBar isMicMuted={false} onToggleMic={handleToggleMic} />
      );

      const micBtn = screen.getByTestId('toggle-mic-btn');
      expect(micBtn).toBeInTheDocument();
      expect(micBtn.getAttribute('aria-label')).toBe('Mute microphone');

      fireEvent.click(micBtn);
      expect(handleToggleMic).toHaveBeenCalledTimes(1);
    });

    it('displays danger variant and unmute label when muted', () => {
      render(<ControlBar isMicMuted={true} />);

      const micBtn = screen.getByTestId('toggle-mic-btn');
      expect(micBtn.getAttribute('aria-label')).toBe('Unmute microphone');
      expect(micBtn).toHaveClass('bg-[rgba(239,68,68,0.2)]');
    });
  });

  describe('Camera Toggle & Feedback', () => {
    it('invokes onToggleCamera callback when clicked', () => {
      const handleToggleCamera = vi.fn();
      render(
        <ControlBar isCameraOff={false} onToggleCamera={handleToggleCamera} />
      );

      const camBtn = screen.getByTestId('toggle-camera-btn');
      expect(camBtn).toBeInTheDocument();
      expect(camBtn.getAttribute('aria-label')).toBe('Turn off camera');

      fireEvent.click(camBtn);
      expect(handleToggleCamera).toHaveBeenCalledTimes(1);
    });

    it('displays danger variant and turn on camera label when camera is off', () => {
      render(<ControlBar isCameraOff={true} />);

      const camBtn = screen.getByTestId('toggle-camera-btn');
      expect(camBtn.getAttribute('aria-label')).toBe('Turn on camera');
      expect(camBtn).toHaveClass('bg-[rgba(239,68,68,0.2)]');
    });
  });

  describe('Screen Sharing Toggle', () => {
    it('invokes onToggleScreenShare callback when clicked', () => {
      const handleToggleScreenShare = vi.fn();
      render(
        <ControlBar
          isScreenSharing={false}
          onToggleScreenShare={handleToggleScreenShare}
        />
      );

      const screenBtn = screen.getByTestId('toggle-screenshare-btn');
      expect(screenBtn.getAttribute('aria-label')).toBe('Share screen');

      fireEvent.click(screenBtn);
      expect(handleToggleScreenShare).toHaveBeenCalledTimes(1);
    });

    it('displays active emerald variant when actively screen sharing', () => {
      render(<ControlBar isScreenSharing={true} />);

      const screenBtn = screen.getByTestId('toggle-screenshare-btn');
      expect(screenBtn.getAttribute('aria-label')).toBe('Stop sharing screen');
      expect(screenBtn).toHaveClass('bg-[rgba(52,211,153,0.15)]');
    });
  });

  describe('Device Settings Popover & Selection', () => {
    it('toggles settings popover on button click and closes on Escape', () => {
      render(
        <ControlBar
          audioDevices={mockAudioDevices}
          videoDevices={mockVideoDevices}
        />
      );

      expect(screen.queryByTestId('device-settings-popover')).toBeNull();

      const settingsBtn = screen.getByTestId('device-settings-btn');
      fireEvent.click(settingsBtn);

      const popover = screen.getByTestId('device-settings-popover');
      expect(popover).toBeInTheDocument();
      expect(screen.getByText('Audio & Video Settings')).toBeInTheDocument();

      // Close on Escape
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(screen.queryByTestId('device-settings-popover')).toBeNull();
    });

    it('invokes onSelectAudioDevice when user selects a different microphone', () => {
      const handleSelectAudio = vi.fn();
      render(
        <ControlBar
          audioDevices={mockAudioDevices}
          selectedAudioDeviceId="mic-1"
          onSelectAudioDevice={handleSelectAudio}
        />
      );

      fireEvent.click(screen.getByTestId('device-settings-btn'));

      const select = screen.getByTestId('audio-device-select') as HTMLSelectElement;
      expect(select.value).toBe('mic-1');

      fireEvent.change(select, { target: { value: 'mic-2' } });
      expect(handleSelectAudio).toHaveBeenCalledWith('mic-2');
    });

    it('invokes onSelectVideoDevice when user selects a different camera', () => {
      const handleSelectVideo = vi.fn();
      render(
        <ControlBar
          videoDevices={mockVideoDevices}
          selectedVideoDeviceId="cam-1"
          onSelectVideoDevice={handleSelectVideo}
        />
      );

      fireEvent.click(screen.getByTestId('device-settings-btn'));

      const select = screen.getByTestId('video-device-select') as HTMLSelectElement;
      expect(select.value).toBe('cam-1');

      fireEvent.change(select, { target: { value: 'cam-2' } });
      expect(handleSelectVideo).toHaveBeenCalledWith('cam-2');
    });
  });

  describe('Leave Classroom Action & Mobile Safe Area Padding', () => {
    it('invokes onLeaveClass callback and has danger variant', () => {
      const handleLeave = vi.fn();
      render(<ControlBar onLeaveClass={handleLeave} />);

      const leaveBtn = screen.getByTestId('leave-class-btn');
      expect(leaveBtn).toBeInTheDocument();
      expect(leaveBtn.getAttribute('aria-label')).toBe('Leave class');

      fireEvent.click(leaveBtn);
      expect(handleLeave).toHaveBeenCalledTimes(1);
    });

    it('applies env(safe-area-inset-bottom) in inline paddingBottom style', () => {
      render(<ControlBar />);

      const container = screen.getByTestId('control-bar-container');
      expect(container.style.paddingBottom).toContain('safe-area-inset-bottom');
      expect(container.style.paddingBottom).toContain('0.75rem');
    });
  });
});
