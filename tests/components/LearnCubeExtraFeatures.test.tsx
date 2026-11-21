import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ChatTab, ChatMessage } from '../../src/components/whiteboard/tabs/ChatTab';
import { ClassroomVideoSync } from '../../src/components/classroom/ClassroomVideoSync';

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

describe('LearnCube Extra Features (Video Sync & Teacher Chat Correction)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('ChatTab Teacher Correction Syntax', () => {
    it('formats ~wrong~ -> *correct* with strikethrough error and highlighted correction badge', () => {
      const messages: ChatMessage[] = [
        {
          id: 'msg-1',
          senderId: 'teacher-1',
          senderName: 'Tutor Sarah',
          senderRole: 'teacher',
          text: 'Correction: ~she go~ -> *she went* to the store',
          timestamp: Date.now(),
        },
      ];

      render(<ChatTab messages={messages} currentUserId="student-1" />);

      // The corrected text parts should be formatted
      const wrongElement = screen.getByText('she go');
      expect(wrongElement).toBeInTheDocument();
      expect(wrongElement.className).toContain('line-through');

      const correctElement = screen.getByText('she went');
      expect(correctElement).toBeInTheDocument();
      expect(correctElement.className).toContain('text-emerald-400');
    });
  });

  describe('ClassroomVideoSync', () => {
    it('allows teacher to load a video URL and controls synchronized play/pause', () => {
      const mockBroadcast = vi.fn();

      render(
        <ClassroomVideoSync
          isOpen={true}
          isTeacher={true}
          onClose={vi.fn()}
          onBroadcastVideoState={mockBroadcast}
        />
      );

      const urlInput = screen.getByTestId('video-url-input');
      fireEvent.change(urlInput, { target: { value: 'https://example.com/lesson.mp4' } });

      const loadBtn = screen.getByTestId('load-video-btn');
      fireEvent.click(loadBtn);

      const playBtn = screen.getByTestId('video-play-toggle-btn');
      fireEvent.click(playBtn);

      expect(mockBroadcast).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com/lesson.mp4',
          isPlaying: true,
        })
      );
    });

    it('displays teacher-controlled badge for student when viewing synchronized video', () => {
      render(
        <ClassroomVideoSync
          isOpen={true}
          isTeacher={false}
          onClose={vi.fn()}
          remoteVideoState={{
            url: 'https://example.com/lesson.mp4',
            isPlaying: true,
            currentTime: 42,
            timestamp: Date.now(),
          }}
        />
      );

      expect(screen.getByText(/Controlled by tutor/i)).toBeInTheDocument();
      expect(screen.getByTestId('sync-video-player')).toBeInTheDocument();
    });
  });
});
