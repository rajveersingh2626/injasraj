import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TeacherAvailabilityForm } from '../../src/components/booking/TeacherAvailabilityForm';
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
  toBeChecked(received) {
    const pass = Boolean(received?.checked);
    return {
      pass,
      message: () => `expected element to ${pass ? 'not ' : ''}be checked`,
    };
  },
});

describe('TeacherAvailabilityForm Component', () => {
  it('renders day checkboxes and default time inputs in IST', () => {
    const handleSave = vi.fn();
    render(<TeacherAvailabilityForm onSave={handleSave} />);

    // Header and description
    expect(screen.getByRole('heading', { name: /Teacher Availability/i })).toBeInTheDocument();
    expect(screen.getByText(/India Standard Time \(IST/i)).toBeInTheDocument();

    // Checkboxes for all 7 days
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(7);

    // Weekdays (Mon-Fri) are checked by default
    const mondayCheckbox = screen.getByRole('checkbox', { name: /Monday/i }) as HTMLInputElement;
    const sundayCheckbox = screen.getByRole('checkbox', { name: /Sunday/i }) as HTMLInputElement;
    expect(mondayCheckbox.checked).toBe(true);
    expect(sundayCheckbox.checked).toBe(false);

    // Start time and end time inputs with defaults '16:00' and '21:00'
    const startTimeInput = screen.getByLabelText(/Start Time \(IST\)/i) as HTMLInputElement;
    const endTimeInput = screen.getByLabelText(/End Time \(IST\)/i) as HTMLInputElement;
    expect(startTimeInput).toBeInTheDocument();
    expect(endTimeInput).toBeInTheDocument();
    expect(startTimeInput.value).toBe('16:00');
    expect(endTimeInput.value).toBe('21:00');

    // Slot duration dropdown
    const durationSelect = screen.getByLabelText(/Lesson Slot Duration/i) as HTMLSelectElement;
    expect(durationSelect).toBeInTheDocument();
    expect(durationSelect.value).toBe('60');
  });

  it('ensures input elements have font-size >= 16px to prevent iOS auto-zoom', () => {
    render(<TeacherAvailabilityForm onSave={vi.fn()} />);

    const startTimeInput = screen.getByLabelText(/Start Time \(IST\)/i);
    const endTimeInput = screen.getByLabelText(/End Time \(IST\)/i);
    const durationSelect = screen.getByLabelText(/Lesson Slot Duration/i);

    expect(startTimeInput.style.fontSize).toBe('16px');
    expect(endTimeInput.style.fontSize).toBe('16px');
    expect(durationSelect.style.fontSize).toBe('16px');
  });

  it('allows toggling days and submits structured TeacherAvailability data', async () => {
    const handleSave = vi.fn().mockResolvedValue(undefined);
    render(<TeacherAvailabilityForm teacherId="teacher-42" onSave={handleSave} />);

    // Clear all days
    const clearButton = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearButton);

    // Check Sunday (0) and Saturday (6)
    const sundayCheckbox = screen.getByRole('checkbox', { name: /Sunday/i });
    const saturdayCheckbox = screen.getByRole('checkbox', { name: /Saturday/i });
    fireEvent.click(sundayCheckbox);
    fireEvent.click(saturdayCheckbox);

    // Change start time and end time
    const startTimeInput = screen.getByLabelText(/Start Time \(IST\)/i);
    const endTimeInput = screen.getByLabelText(/End Time \(IST\)/i);
    fireEvent.change(startTimeInput, { target: { value: '18:00' } });
    fireEvent.change(endTimeInput, { target: { value: '22:00' } });

    // Change slot duration to 45 mins
    const durationSelect = screen.getByLabelText(/Lesson Slot Duration/i);
    fireEvent.change(durationSelect, { target: { value: '45' } });

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Save Availability/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(handleSave).toHaveBeenCalledTimes(1);
    });

    const savedAvails: TeacherAvailability[] = handleSave.mock.calls[0][0];
    expect(savedAvails.length).toBe(2);

    expect(savedAvails[0]).toEqual({
      id: 'avail-teacher-42-0',
      teacher_id: 'teacher-42',
      day_of_week: 0,
      start_time: '18:00:00',
      end_time: '22:00:00',
      slot_duration_minutes: 45,
    });

    expect(savedAvails[1]).toEqual({
      id: 'avail-teacher-42-6',
      teacher_id: 'teacher-42',
      day_of_week: 6,
      start_time: '18:00:00',
      end_time: '22:00:00',
      slot_duration_minutes: 45,
    });

    // Success feedback
    expect(
      screen.getByText(/Availability saved in IST \(UTC\+5:30\) successfully!/i)
    ).toBeInTheDocument();
  });

  it('pre-populates from initialAvailabilities when provided', () => {
    const initial: TeacherAvailability[] = [
      {
        id: 'avail-existing-2',
        teacher_id: 'teacher-custom',
        day_of_week: 2, // Tuesday
        start_time: '14:30:00',
        end_time: '19:30:00',
        slot_duration_minutes: 30,
      },
      {
        id: 'avail-existing-4',
        teacher_id: 'teacher-custom',
        day_of_week: 4, // Thursday
        start_time: '14:30:00',
        end_time: '19:30:00',
        slot_duration_minutes: 30,
      },
    ];

    render(<TeacherAvailabilityForm teacherId="teacher-custom" initialAvailabilities={initial} onSave={vi.fn()} />);

    const tuesdayCheckbox = screen.getByRole('checkbox', { name: /Tuesday/i }) as HTMLInputElement;
    const thursdayCheckbox = screen.getByRole('checkbox', { name: /Thursday/i }) as HTMLInputElement;
    const mondayCheckbox = screen.getByRole('checkbox', { name: /Monday/i }) as HTMLInputElement;

    expect(tuesdayCheckbox.checked).toBe(true);
    expect(thursdayCheckbox.checked).toBe(true);
    expect(mondayCheckbox.checked).toBe(false);

    const startTimeInput = screen.getByLabelText(/Start Time \(IST\)/i) as HTMLInputElement;
    const endTimeInput = screen.getByLabelText(/End Time \(IST\)/i) as HTMLInputElement;
    const durationSelect = screen.getByLabelText(/Lesson Slot Duration/i) as HTMLSelectElement;

    expect(startTimeInput.value).toBe('14:30');
    expect(endTimeInput.value).toBe('19:30');
    expect(durationSelect.value).toBe('30');
  });

  it('displays validation error if no days are selected', async () => {
    const handleSave = vi.fn();
    render(<TeacherAvailabilityForm onSave={handleSave} />);

    // Clear all days
    const clearButton = screen.getByRole('button', { name: /Clear/i });
    fireEvent.click(clearButton);

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /Save Availability/i });
    fireEvent.click(submitBtn);

    expect(handleSave).not.toHaveBeenCalled();
    expect(screen.getByRole('alert').textContent).toMatch(/Please select at least one active day/i);
  });
});
