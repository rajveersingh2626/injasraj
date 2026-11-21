import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudentBookingCalendar } from '../../src/components/booking/StudentBookingCalendar';
import { SlotItem } from '../../src/utils/timezone';
import { TeacherAvailability } from '../../src/types/database';

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

const mockSlots: SlotItem[] = [
  {
    id: 'slot-regular',
    utcStartTime: '2026-11-23T10:30:00.000Z',
    utcEndTime: '2026-11-23T11:30:00.000Z',
    studentFormattedTime: 'Nov 23, 2026, 5:30 AM EST',
    teacherFormattedTime: 'Nov 23, 2026, 4:00 PM IST',
    dateLabel: 'Mon, Nov 23, 2026',
    isCrossDay: false,
  },
  {
    id: 'slot-crossday',
    utcStartTime: '2026-11-23T20:30:00.000Z',
    utcEndTime: '2026-11-23T21:30:00.000Z',
    studentFormattedTime: 'Nov 23, 2026, 3:30 PM EST',
    teacherFormattedTime: 'Nov 24, 2026, 2:00 AM IST',
    dateLabel: 'Mon, Nov 23, 2026',
    isCrossDay: true,
  },
];

describe('StudentBookingCalendar Component', () => {
  it('renders slot cards with student and teacher dual times', () => {
    const handleBook = vi.fn();
    render(
      <StudentBookingCalendar
        slots={mockSlots}
        onBookSlot={handleBook}
        initialTimezone="America/New_York"
      />
    );

    // Prominent student times
    expect(screen.getByText('Nov 23, 2026, 5:30 AM EST')).toBeInTheDocument();
    expect(screen.getByText('Nov 23, 2026, 3:30 PM EST')).toBeInTheDocument();

    // Teacher times
    expect(screen.getByText('Nov 23, 2026, 4:00 PM IST')).toBeInTheDocument();
    expect(screen.getByText('Nov 24, 2026, 2:00 AM IST')).toBeInTheDocument();
  });

  it('displays cross-day indicator when isCrossDay is true', () => {
    render(
      <StudentBookingCalendar
        slots={mockSlots}
        onBookSlot={vi.fn()}
        initialTimezone="America/New_York"
      />
    );

    // Only slot-crossday has isCrossDay: true
    const badges = screen.getAllByText(/Different calendar day in India/i);
    expect(badges.length).toBe(1);
    expect(badges[0]).toBeInTheDocument();
  });

  it('renders 14-day date picker and timezone selector', () => {
    const handleTzChange = vi.fn();
    render(
      <StudentBookingCalendar
        slots={mockSlots}
        onBookSlot={vi.fn()}
        initialTimezone="America/New_York"
        onTimezoneChange={handleTzChange}
      />
    );

    // 14-day date picker region
    const datePickerRegion = screen.getByRole('region', { name: /14-day date picker/i });
    expect(datePickerRegion).toBeInTheDocument();

    // 14 date buttons
    const dateButtons = datePickerRegion.querySelectorAll('button');
    expect(dateButtons.length).toBe(14);

    // Timezone selector
    const tzSelect = screen.getByLabelText(/Select Timezone/i) as HTMLSelectElement;
    expect(tzSelect).toBeInTheDocument();
    expect(tzSelect.value).toBe('America/New_York');

    // Changing timezone
    fireEvent.change(tzSelect, { target: { value: 'Europe/London' } });
    expect(handleTzChange).toHaveBeenCalledWith('Europe/London');
  });

  it('opens booking modal on slot click, verifies input font >= 16px, and invokes onBookSlot on submit', async () => {
    const handleBook = vi.fn().mockResolvedValue(undefined);
    render(
      <StudentBookingCalendar
        slots={mockSlots}
        onBookSlot={handleBook}
        initialTimezone="America/New_York"
      />
    );

    // Click on the regular slot
    const slotCard = screen.getByText('Nov 23, 2026, 5:30 AM EST').closest('button');
    expect(slotCard).not.toBeNull();
    fireEvent.click(slotCard!);

    // Booking modal opens
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Confirm Lesson Booking/i })).toBeInTheDocument();

    // Inputs with >= 16px font-size to prevent iOS auto-zoom
    const nameInput = screen.getByLabelText(/Student Name/i) as HTMLInputElement;
    const emailInput = screen.getByLabelText(/Student Email/i) as HTMLInputElement;

    expect(nameInput.style.fontSize).toBe('16px');
    expect(emailInput.style.fontSize).toBe('16px');
    expect(emailInput.type).toBe('email');

    // Fill details
    fireEvent.change(nameInput, { target: { value: 'Maya Lin' } });
    fireEvent.change(emailInput, { target: { value: 'maya@example.com' } });

    // Submit booking
    const confirmButton = screen.getByRole('button', { name: /Confirm & Get Classroom Link/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(handleBook).toHaveBeenCalledTimes(1);
    });

    expect(handleBook).toHaveBeenCalledWith(mockSlots[0], {
      name: 'Maya Lin',
      email: 'maya@example.com',
    });
  });

  it('validates student name and email before booking', async () => {
    const handleBook = vi.fn();
    render(
      <StudentBookingCalendar
        slots={mockSlots}
        onBookSlot={handleBook}
        initialTimezone="America/New_York"
      />
    );

    // Open modal
    const slotCard = screen.getByText('Nov 23, 2026, 5:30 AM EST').closest('button');
    fireEvent.click(slotCard!);

    // Submit with empty name
    const confirmButton = screen.getByRole('button', { name: /Confirm & Get Classroom Link/i });
    fireEvent.click(confirmButton);

    expect(handleBook).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Please enter your full name/i);

    // Fill name, invalid email
    const nameInput = screen.getByLabelText(/Student Name/i);
    const emailInput = screen.getByLabelText(/Student Email/i);
    fireEvent.change(nameInput, { target: { value: 'Alice' } });
    fireEvent.change(emailInput, { target: { value: 'invalid-email-address' } });
    fireEvent.click(confirmButton);

    expect(handleBook).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Please enter a valid email address/i);
  });

  it('generates slots dynamically when teacherAvailability is provided', () => {
    // Provide availability on all days 16:00 to 18:00 IST (UTC+5:30)
    const availabilities: TeacherAvailability[] = [0, 1, 2, 3, 4, 5, 6].map((day) => ({
      id: `avail-${day}`,
      teacher_id: 'teacher-global',
      day_of_week: day,
      start_time: '16:00:00',
      end_time: '18:00:00',
      slot_duration_minutes: 60,
    }));

    render(
      <StudentBookingCalendar
        teacherAvailability={availabilities}
        onBookSlot={vi.fn()}
        initialTimezone="Asia/Kolkata"
      />
    );

    // Should have generated available slots
    expect(screen.getByRole('region', { name: /14-day date picker/i })).toBeInTheDocument();
    // Slots for the selected day should be visible
    expect(screen.getByText(/slots? available/i)).toBeInTheDocument();
  });
});
