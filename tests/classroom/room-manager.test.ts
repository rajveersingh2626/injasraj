import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createManagedRoom,
  getActiveRooms,
  getRoomById,
  recordRoomJoin,
  deleteManagedRoom,
  checkAndExpireRooms,
  ROOM_MANAGER_STORAGE_KEY,
  ManagedRoom,
} from '../../src/lib/classroom/room-manager';

describe('Active Room & Link Management Engine', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
    vi.useRealTimers();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('creates an instant managed room and retrieves it in active roster', () => {
    const room = createManagedRoom('room-test-1', 'instant', '1:1 Instant Math Session');
    expect(room.roomId).toBe('room-test-1');
    expect(room.type).toBe('instant');
    expect(room.status).toBe('active');
    expect(room.title).toBe('1:1 Instant Math Session');

    const activeRooms = getActiveRooms();
    expect(activeRooms.length).toBe(1);
    expect(activeRooms[0].roomId).toBe('room-test-1');
  });

  it('records room join and sets 15-minute expiration for instant room', () => {
    vi.useFakeTimers();
    const now = new Date('2026-11-22T10:00:00.000Z');
    vi.setSystemTime(now);

    createManagedRoom('room-instant-join', 'instant');
    const joined = recordRoomJoin('room-instant-join');

    expect(joined).not.toBeNull();
    expect(joined?.joinedAt).toBe(now.toISOString());
    // 15 minutes = 15 * 60 * 1000 = 900,000 ms
    const expectedExpiry = new Date(now.getTime() + 15 * 60 * 1000).toISOString();
    expect(joined?.expiresAt).toBe(expectedExpiry);
  });

  it('expires instant room when 15 minutes have passed since joining', () => {
    vi.useFakeTimers();
    const t0 = new Date('2026-11-22T10:00:00.000Z');
    vi.setSystemTime(t0);

    createManagedRoom('room-to-expire', 'instant');
    recordRoomJoin('room-to-expire');

    // 10 minutes later: still active
    vi.setSystemTime(new Date(t0.getTime() + 10 * 60 * 1000));
    let check = checkAndExpireRooms();
    expect(check.active.some((r) => r.roomId === 'room-to-expire')).toBe(true);
    expect(check.expired.some((r) => r.roomId === 'room-to-expire')).toBe(false);

    // 16 minutes later: expired
    vi.setSystemTime(new Date(t0.getTime() + 16 * 60 * 1000));
    check = checkAndExpireRooms();
    expect(check.active.some((r) => r.roomId === 'room-to-expire')).toBe(false);
    expect(check.expired.some((r) => r.roomId === 'room-to-expire')).toBe(true);

    // Active roster should now be empty
    expect(getActiveRooms().some((r) => r.roomId === 'room-to-expire')).toBe(false);
  });

  it('keeps scheduled rooms active without auto-expiring after 15 minutes', () => {
    vi.useFakeTimers();
    const t0 = new Date('2026-11-22T10:00:00.000Z');
    vi.setSystemTime(t0);

    createManagedRoom('room-scheduled', 'scheduled', 'Scheduled Oxford Lesson');
    recordRoomJoin('room-scheduled');

    // 30 minutes later: scheduled room remains active
    vi.setSystemTime(new Date(t0.getTime() + 30 * 60 * 1000));
    const check = checkAndExpireRooms();
    expect(check.active.some((r) => r.roomId === 'room-scheduled')).toBe(true);
  });

  it('deletes managed room immediately and removes from storage', () => {
    createManagedRoom('room-to-delete', 'instant');
    expect(getActiveRooms().length).toBe(1);

    const deleted = deleteManagedRoom('room-to-delete');
    expect(deleted).toBe(true);
    expect(getActiveRooms().length).toBe(0);
  });
});
