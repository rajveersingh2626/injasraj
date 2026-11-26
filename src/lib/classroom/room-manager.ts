/**
 * Active Room & Link Management Engine
 *
 * Tracks generated classroom links, active sessions, and instant room lifecycle:
 * - Persists and queries state against Supabase public.lessons table (SSOT).
 * - Instant rooms expire after 15 minutes of joining.
 * - Scheduled rooms remain active until completed or manually deleted.
 */

import { createBrowserClient } from '../supabase/client';
import { CANONICAL_TEACHER_ID } from '../auth/teacher-auth';

export const ROOM_MANAGER_STORAGE_KEY = 'injasraj_managed_rooms_v1';
export const INSTANT_ROOM_TTL_MS = 15 * 60 * 1000; // 15 minutes

export interface ManagedRoom {
  id: string;
  roomId: string;
  title: string;
  type: 'instant' | 'scheduled';
  createdAt: string;
  joinedAt?: string;
  expiresAt?: string;
  status: 'active' | 'expired' | 'completed';
}

function loadStoredRooms(): ManagedRoom[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(ROOM_MANAGER_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as ManagedRoom[];
  } catch {
    return [];
  }
}

function saveStoredRooms(rooms: ManagedRoom[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ROOM_MANAGER_STORAGE_KEY, JSON.stringify(rooms));
  } catch (err) {
    console.warn('Failed to save managed rooms to storage:', err);
  }
}

/**
 * Creates and registers a new managed room, syncing with Supabase lessons table.
 */
export function createManagedRoom(
  roomId: string,
  type: 'instant' | 'scheduled' = 'instant',
  title?: string
): ManagedRoom {
  const rooms = loadStoredRooms();
  const existingIdx = rooms.findIndex((r) => r.roomId === roomId);

  const defaultTitle =
    title && title.trim().length > 0
      ? title.trim()
      : type === 'instant'
      ? `Instant Session (${roomId})`
      : `Scheduled Class (${roomId})`;

  const now = new Date();
  const newRoom: ManagedRoom = {
    id: `room_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    roomId,
    title: defaultTitle,
    type,
    createdAt: now.toISOString(),
    status: 'active',
  };

  if (existingIdx >= 0) {
    rooms[existingIdx] = { ...rooms[existingIdx], ...newRoom };
  } else {
    rooms.unshift(newRoom);
  }

  saveStoredRooms(rooms);

  // Sync to Supabase public.lessons asynchronously
  try {
    const supabase = createBrowserClient();
    if (supabase && typeof supabase.from === 'function') {
      Promise.resolve(
        supabase
          .from('lessons')
          .upsert(
            {
              room_id: roomId,
              teacher_id: CANONICAL_TEACHER_ID,
              room_type: type,
              title: defaultTitle,
              status: 'live',
              start_time_utc: now.toISOString(),
              created_at: now.toISOString(),
            },
            { onConflict: 'room_id' }
          )
      ).catch((err: any) => console.warn('Supabase room upsert notice:', err));
    }
  } catch {}

  return newRoom;
}

/**
 * Retrieves a managed room by its unique room ID.
 */
export function getRoomById(roomId: string): ManagedRoom | undefined {
  const rooms = loadStoredRooms();
  return rooms.find((r) => r.roomId === roomId);
}

/**
 * Records when a teacher or student joins the room.
 */
export function recordRoomJoin(roomId: string): ManagedRoom | null {
  const rooms = loadStoredRooms();
  const room = rooms.find((r) => r.roomId === roomId);
  if (!room) return null;

  const now = new Date();
  room.joinedAt = room.joinedAt || now.toISOString();

  if (room.type === 'instant' && !room.expiresAt) {
    room.expiresAt = new Date(now.getTime() + INSTANT_ROOM_TTL_MS).toISOString();
  }

  saveStoredRooms(rooms);

  // Sync join time to Supabase
  try {
    const supabase = createBrowserClient();
    if (supabase && typeof supabase.from === 'function') {
      Promise.resolve(
        supabase
          .from('lessons')
          .update({
            joined_at: room.joinedAt,
            expires_at: room.expiresAt,
          })
          .eq('room_id', roomId)
      ).catch(() => {});
    }
  } catch {}

  return room;
}

/**
 * Evaluates all rooms and transitions expired instant rooms.
 */
export function checkAndExpireRooms(): {
  active: ManagedRoom[];
  expired: ManagedRoom[];
} {
  const rooms = loadStoredRooms();
  const now = Date.now();

  const active: ManagedRoom[] = [];
  const expired: ManagedRoom[] = [];

  for (const room of rooms) {
    if (room.status === 'active') {
      if (
        room.type === 'instant' &&
        room.expiresAt &&
        new Date(room.expiresAt).getTime() <= now
      ) {
        room.status = 'expired';
        expired.push(room);
      } else {
        active.push(room);
      }
    } else {
      expired.push(room);
    }
  }

  saveStoredRooms(rooms);
  return { active, expired };
}

/**
 * Returns all currently active managed rooms, automatically pruning expired ones.
 */
export function getActiveRooms(): ManagedRoom[] {
  const { active } = checkAndExpireRooms();
  return active;
}

/**
 * Deletes a managed room by roomId.
 */
export function deleteManagedRoom(roomId: string): boolean {
  const rooms = loadStoredRooms();
  const filtered = rooms.filter((r) => r.roomId !== roomId);
  if (filtered.length !== rooms.length) {
    saveStoredRooms(filtered);

    // Sync status = 'completed' or delete in Supabase
    try {
      const supabase = createBrowserClient();
      if (supabase && typeof supabase.from === 'function') {
        Promise.resolve(
          supabase
            .from('lessons')
            .update({ status: 'completed' })
            .eq('room_id', roomId)
        ).catch(() => {});
      }
    } catch {}

    return true;
  }
  return false;
}

/**
 * Asynchronously synchronizes active rooms from Supabase public.lessons.
 */
export async function syncRoomsFromSupabase(): Promise<ManagedRoom[]> {
  try {
    const supabase = createBrowserClient();
    if (supabase && typeof supabase.from === 'function') {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .in('status', ['live', 'scheduled'])
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const synced: ManagedRoom[] = data.map((l: any) => ({
          id: l.id,
          roomId: l.room_id,
          title: l.title || `Classroom (${l.room_id})`,
          type: (l.room_type as any) || 'instant',
          createdAt: l.created_at || new Date().toISOString(),
          joinedAt: l.joined_at,
          expiresAt: l.expires_at,
          status: 'active',
        }));
        saveStoredRooms(synced);
        return synced;
      }
    }
  } catch (err) {
    console.warn('Could not sync rooms from Supabase:', err);
  }
  return getActiveRooms();
}
