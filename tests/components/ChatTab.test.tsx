import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ChatTab, ChatMessage } from '../../src/components/whiteboard/tabs/ChatTab';

// Extend expect for matchers
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
  toBeDisabled(received) {
    const pass = Boolean(received?.disabled || received?.hasAttribute('disabled'));
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be disabled`,
    };
  },
});

describe('ChatTab Component (Real-Time Whiteboard Chat & iOS 16px Font)', () => {
  const mockMessages: ChatMessage[] = [
    {
      id: 'm1',
      senderId: 'teacher-1',
      senderName: 'Prof. Miller',
      senderRole: 'teacher',
      text: 'Welcome everyone! Look at problem #3 on page 2.',
      timestamp: 1700000000000,
      isSelf: false,
    },
    {
      id: 'm2',
      senderId: 'student-1',
      senderName: 'Alex Johnson',
      senderRole: 'student',
      text: 'Got it, should we factor by grouping?',
      timestamp: 1700000060000,
      isSelf: true,
    },
  ];

  it('renders messages with timestamps and role badges', () => {
    render(<ChatTab messages={mockMessages} currentUserId="student-1" />);

    expect(screen.getByText('Prof. Miller')).toBeInTheDocument();
    expect(screen.getByText('Alex Johnson')).toBeInTheDocument();
    expect(
      screen.getByText('Welcome everyone! Look at problem #3 on page 2.')
    ).toBeInTheDocument();
    expect(
      screen.getByText('Got it, should we factor by grouping?')
    ).toBeInTheDocument();

    expect(screen.getByTestId('message-role-badge-m1').textContent).toContain('Teacher');
    expect(screen.getByTestId('message-role-badge-m2').textContent).toContain('Student');
  });

  it('enforces font-size >= 16px on message input to prevent iOS mobile zoom', () => {
    render(<ChatTab messages={mockMessages} />);

    const input = screen.getByTestId('chat-input') as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.style.fontSize).toBe('16px');
  });

  it('sends message via form submission and clears input', () => {
    const handleSendMessage = vi.fn();
    render(<ChatTab onSendMessage={handleSendMessage} />);

    const input = screen.getByTestId('chat-input') as HTMLInputElement;
    const sendBtn = screen.getByTestId('send-chat-btn');

    // Initially disabled because input is empty
    expect(sendBtn).toBeDisabled();

    // Type message
    fireEvent.change(input, { target: { value: 'Is this formula right?' } });
    expect(sendBtn).not.toBeDisabled();

    // Submit form
    fireEvent.click(sendBtn);

    expect(handleSendMessage).toHaveBeenCalledTimes(1);
    expect(handleSendMessage).toHaveBeenCalledWith('Is this formula right?');
    expect(input.value).toBe('');
  });

  it('shows empty state when message list is empty', () => {
    render(<ChatTab messages={[]} />);

    expect(screen.getByTestId('chat-empty-state')).toBeInTheDocument();
    expect(screen.getByText('No messages yet')).toBeInTheDocument();
  });
});
