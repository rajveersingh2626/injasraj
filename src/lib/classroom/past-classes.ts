/**
 * Past Classes Archival & Whiteboard Session Storage
 *
 * Persists historical class session logs with:
 * - Room ID, class title, date, and duration.
 * - Snapshot of the complete whiteboard notebook (all canvas objects, pages, background images).
 * - Full retrieval support for reloading previous whiteboards into active sessions.
 * - Backed by Supabase public.lessons and public.whiteboard_sessions tables (SSOT).
 */

import {
  WhiteboardSessionRecord,
  loadWhiteboardSession,
} from '../whiteboard/whiteboard-persistence';
import { deleteManagedRoom } from './room-manager';
import { createDefaultWhiteboardPage, defaultWhiteboardPermissions } from '../../types/whiteboard';
import { createBrowserClient } from '../supabase/client';
import { CANONICAL_TEACHER_ID } from '../auth/teacher-auth';

export const PAST_CLASSES_STORAGE_KEY = 'injasraj_past_classes_v1';

export interface PastClassRecord {
  id: string;
  roomId: string;
  title: string;
  date: string; // ISO date string
  durationSeconds: number;
  pageCount: number;
  thumbnailUrl?: string;
  whiteboardSnapshot?: WhiteboardSessionRecord;
}

function loadStoredPastClasses(): PastClassRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(PAST_CLASSES_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PastClassRecord[];
  } catch {
    return [];
  }
}

function saveStoredPastClasses(records: PastClassRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PAST_CLASSES_STORAGE_KEY, JSON.stringify(records));
  } catch (err) {
    console.warn('Failed to save past classes to storage:', err);
  }
}

/**
 * Archives an active or completed class session into the persistent past classes record.
 */
export async function archiveClassToHistory(
  roomId: string,
  title?: string,
  durationSeconds: number = 0,
  explicitSnapshot?: WhiteboardSessionRecord
): Promise<PastClassRecord> {
  let snapshot = explicitSnapshot;

  if (!snapshot && typeof window !== 'undefined') {
    try {
      const loaded = await Promise.race([
        loadWhiteboardSession(undefined, roomId),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
      ]);
      if (loaded) {
        snapshot = {
          room_id: roomId,
          pages: loaded.pages,
          active_page_id: loaded.activePageId,
          permissions: loaded.permissions,
          updated_at: new Date().toISOString(),
        };
      }
    } catch (err) {
      console.warn('Could not load whiteboard session for archival:', err);
    }
  }

  // Fallback snapshot if none existed
  if (!snapshot) {
    snapshot = {
      room_id: roomId,
      pages: [createDefaultWhiteboardPage('p-1', 1, 'Lesson Whiteboard')],
      active_page_id: 'p-1',
      permissions: defaultWhiteboardPermissions(),
      updated_at: new Date().toISOString(),
    };
  }

  const pages = snapshot.pages || [];
  const pageCount = pages.length > 0 ? pages.length : 1;
  const firstPage = pages[0];
  const thumbnailUrl =
    firstPage?.thumbnailUrl || firstPage?.backgroundImageUrl || undefined;

  const resolvedTitle =
    title && title.trim().length > 0
      ? title.trim()
      : `Classroom Session (${roomId})`;

  const record: PastClassRecord = {
    id: `past_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    roomId,
    title: resolvedTitle,
    date: new Date().toISOString(),
    durationSeconds,
    pageCount,
    thumbnailUrl,
    whiteboardSnapshot: snapshot,
  };

  const records = loadStoredPastClasses();
  // Filter out any older record with the exact same roomId to avoid duplicates
  const filtered = records.filter((r) => r.roomId !== roomId);
  filtered.unshift(record);
  saveStoredPastClasses(filtered);

  // Clean up from active room manager
  deleteManagedRoom(roomId);

  // Sync completed state to Supabase
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
              title: resolvedTitle,
              status: 'completed',
              end_time_utc: new Date().toISOString(),
            },
            { onConflict: 'room_id' }
          )
      ).catch(() => {});
    }
  } catch {}

  return record;
}

/**
 * Retrieves all past classes sorted with the newest first.
 */
export function getPastClasses(): PastClassRecord[] {
  const records = loadStoredPastClasses();
  return records.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

/**
 * Asynchronously synchronizes past completed classes from Supabase.
 */
export async function syncPastClassesFromSupabase(): Promise<PastClassRecord[]> {
  try {
    const supabase = createBrowserClient();
    if (supabase && typeof supabase.from === 'function') {
      const { data, error } = await supabase
        .from('lessons')
        .select('*')
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      if (!error && Array.isArray(data)) {
        const synced: PastClassRecord[] = data.map((l: any) => ({
          id: l.id,
          roomId: l.room_id,
          title: l.title || `Classroom (${l.room_id})`,
          date: l.end_time_utc || l.created_at || new Date().toISOString(),
          durationSeconds: 0,
          pageCount: 1,
        }));
        saveStoredPastClasses(synced);
        return synced;
      }
    }
  } catch (err) {
    console.warn('Could not sync past classes from Supabase:', err);
  }
  return getPastClasses();
}

/**
 * Retrieves the saved whiteboard snapshot for a past class room ID.
 */
export async function getPastClassWhiteboard(
  roomId: string
): Promise<WhiteboardSessionRecord | null> {
  const records = loadStoredPastClasses();
  const matched = records.find((r) => r.roomId === roomId);
  if (matched?.whiteboardSnapshot) {
    return matched.whiteboardSnapshot;
  }

  // Try direct Postgres load with race timeout
  try {
    const loaded = await Promise.race([
      loadWhiteboardSession(undefined, roomId),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 400)),
    ]);
    if (loaded) {
      return {
        room_id: roomId,
        pages: loaded.pages,
        active_page_id: loaded.activePageId,
        permissions: loaded.permissions,
        updated_at: new Date().toISOString(),
      };
    }
  } catch {}

  return null;
}

/**
 * Deletes a past class record from storage by record ID.
 */
export function deletePastClass(id: string): boolean {
  const records = loadStoredPastClasses();
  const filtered = records.filter((r) => r.id !== id);
  if (filtered.length !== records.length) {
    saveStoredPastClasses(filtered);
    return true;
  }
  return false;
}
