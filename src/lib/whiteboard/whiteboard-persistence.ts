/**
 * Dedicated Teaching Whiteboard Persistence Layer
 *
 * Implements Supabase Postgres persistence for multi-page whiteboard sessions:
 * - Structured serialization and deserialization of canvas graphs, worksheets, and permissions.
 * - Debounced persistence manager preventing database saturation during high-frequency drawing.
 * - Upsert persistence on room_id for seamless guest student and teacher synchronization.
 * - Multi-master merge compatibility for real-time collaborative state resolution.
 */

import {
  WhiteboardPage,
  WhiteboardPermissions,
  defaultWhiteboardPermissions,
  createDefaultWhiteboardPage,
} from '../../types/whiteboard';
import { createBrowserClient } from '../supabase/client';

export interface WhiteboardSessionRecord {
  id?: string;
  room_id: string;
  lesson_id?: string;
  pages: WhiteboardPage[];
  active_page_id: string;
  permissions: WhiteboardPermissions;
  viewport?: {
    zoom: number;
    panX: number;
    panY: number;
  };
  updated_at?: string;
}

/**
 * Deep clones any serializable object graph via JSON serialization.
 */
function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Serializes whiteboard notebook state into a database-ready WhiteboardSessionRecord.
 */
export function serializeWhiteboardSession(
  roomId: string,
  pages: WhiteboardPage[],
  activePageId: string,
  permissions: WhiteboardPermissions,
  viewport?: { zoom: number; panX: number; panY: number }
): WhiteboardSessionRecord {
  const safePages: WhiteboardPage[] =
    Array.isArray(pages) && pages.length > 0
      ? deepClone(pages)
      : [createDefaultWhiteboardPage('default-page', 1)];

  const resolvedActivePageId =
    activePageId && safePages.some((p) => p.id === activePageId)
      ? activePageId
      : safePages[0].id;

  const safePermissions: WhiteboardPermissions = permissions
    ? deepClone(permissions)
    : defaultWhiteboardPermissions();

  return {
    room_id: roomId,
    pages: safePages,
    active_page_id: resolvedActivePageId,
    permissions: safePermissions,
    viewport: viewport ? deepClone(viewport) : undefined,
    updated_at: new Date().toISOString(),
  };
}

/**
 * Deserializes database records or JSON payloads into fully-typed whiteboard session state.
 */
export function deserializeWhiteboardSession(
  record: any
): {
  pages: WhiteboardPage[];
  activePageId: string;
  permissions: WhiteboardPermissions;
  viewport?: { zoom: number; panX: number; panY: number };
} {
  if (!record || typeof record !== 'object') {
    const fallbackPage = createDefaultWhiteboardPage('default-page', 1);
    return {
      pages: [fallbackPage],
      activePageId: fallbackPage.id,
      permissions: defaultWhiteboardPermissions(),
    };
  }

  // Parse pages (handles both parsed jsonb arrays and JSON string representations)
  let rawPages = record.pages;
  if (typeof rawPages === 'string') {
    try {
      rawPages = JSON.parse(rawPages);
    } catch {
      rawPages = [];
    }
  }

  let parsedPages: WhiteboardPage[] = [];
  if (Array.isArray(rawPages) && rawPages.length > 0) {
    parsedPages = rawPages.map((p, idx) => ({
      id: p.id || `page-${idx + 1}`,
      pageNumber: typeof p.pageNumber === 'number' ? p.pageNumber : idx + 1,
      title: p.title || `Page ${idx + 1}`,
      backgroundPdfUrl: p.backgroundPdfUrl,
      backgroundPdfPage: p.backgroundPdfPage,
      backgroundImageUrl: p.backgroundImageUrl,
      canvasJson:
        p.canvasJson && typeof p.canvasJson === 'object'
          ? deepClone(p.canvasJson)
          : { version: '6.0', objects: [] },
      thumbnailUrl: p.thumbnailUrl,
      pdfDocument: p.pdfDocument ? deepClone(p.pdfDocument) : undefined,
    }));
  } else {
    parsedPages = [createDefaultWhiteboardPage('default-page', 1)];
  }

  // Enforce continuous sequential 1-based page numbering
  parsedPages.forEach((p, idx) => {
    p.pageNumber = idx + 1;
  });

  // Resolve active page ID
  const rawActivePageId = record.active_page_id || record.activePageId;
  const activePageId =
    typeof rawActivePageId === 'string' &&
    parsedPages.some((p) => p.id === rawActivePageId)
      ? rawActivePageId
      : parsedPages[0].id;

  // Parse permissions
  let rawPermissions = record.permissions;
  if (typeof rawPermissions === 'string') {
    try {
      rawPermissions = JSON.parse(rawPermissions);
    } catch {
      rawPermissions = null;
    }
  }

  const defaultPerms = defaultWhiteboardPermissions();
  const permissions: WhiteboardPermissions =
    rawPermissions && typeof rawPermissions === 'object'
      ? {
          isLockedGlobally:
            typeof rawPermissions.isLockedGlobally === 'boolean'
              ? rawPermissions.isLockedGlobally
              : defaultPerms.isLockedGlobally,
          studentDrawingGranted:
            rawPermissions.studentDrawingGranted &&
            typeof rawPermissions.studentDrawingGranted === 'object'
              ? { ...rawPermissions.studentDrawingGranted }
              : { ...defaultPerms.studentDrawingGranted },
          preventDeletingTeacherContent:
            typeof rawPermissions.preventDeletingTeacherContent === 'boolean'
              ? rawPermissions.preventDeletingTeacherContent
              : defaultPerms.preventDeletingTeacherContent,
          allowMovingOnlyOwnObjects:
            typeof rawPermissions.allowMovingOnlyOwnObjects === 'boolean'
              ? rawPermissions.allowMovingOnlyOwnObjects
              : defaultPerms.allowMovingOnlyOwnObjects,
          allowedTools: Array.isArray(rawPermissions.allowedTools)
            ? [...rawPermissions.allowedTools]
            : [...defaultPerms.allowedTools],
          laserPointerOnly:
            typeof rawPermissions.laserPointerOnly === 'boolean'
              ? rawPermissions.laserPointerOnly
              : defaultPerms.laserPointerOnly,
        }
      : defaultPerms;

  let viewport: { zoom: number; panX: number; panY: number } | undefined;
  if (record.viewport && typeof record.viewport === 'object') {
    viewport = {
      zoom: typeof record.viewport.zoom === 'number' ? record.viewport.zoom : 1,
      panX: typeof record.viewport.panX === 'number' ? record.viewport.panX : 0,
      panY: typeof record.viewport.panY === 'number' ? record.viewport.panY : 0,
    };
  }

  return {
    pages: parsedPages,
    activePageId,
    permissions,
    viewport,
  };
}

/**
 * Debounced persistence manager to throttle rapid drawing modifications (e.g. 3000ms delay).
 * Ensures that high-frequency freehand strokes are batched into a single Postgres write.
 */
export class DebouncedPersistenceManager {
  private saveFn: (data: WhiteboardSessionRecord) => Promise<boolean>;
  private debounceMs: number;
  private pendingData: WhiteboardSessionRecord | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private isSaving: boolean = false;

  constructor(
    saveFn: (data: WhiteboardSessionRecord) => Promise<boolean>,
    debounceMs: number = 3000
  ) {
    this.saveFn = saveFn;
    this.debounceMs = debounceMs;
  }

  /**
   * Schedules a debounced save operation.
   * Replaces any pending payload with the latest session record and resets timer.
   */
  public scheduleSave(data: WhiteboardSessionRecord): void {
    this.pendingData = data;
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.flush();
    }, this.debounceMs);
  }

  /**
   * Immediately flushes any pending save operation without waiting for the timer.
   */
  public async flush(): Promise<boolean> {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }

    if (!this.pendingData) {
      return true;
    }

    const dataToSave = this.pendingData;
    this.pendingData = null;

    this.isSaving = true;
    try {
      const result = await this.saveFn(dataToSave);
      return result;
    } catch (err) {
      console.error('DebouncedPersistenceManager.flush error:', err);
      return false;
    } finally {
      this.isSaving = false;
    }
  }

  /**
   * Cancels any scheduled debounced save and discards pending payload.
   */
  public cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    this.pendingData = null;
  }

  /**
   * Returns true if a save operation is pending debounce execution.
   */
  public isPending(): boolean {
    return this.timer !== null || this.pendingData !== null;
  }

  /**
   * Returns configured debounce delay in milliseconds.
   */
  public getDebounceMs(): number {
    return this.debounceMs;
  }
}

/**
 * Persists whiteboard session data to Supabase Postgres via upsert on room_id.
 */
export async function saveWhiteboardSession(
  supabaseClient: any,
  sessionData: WhiteboardSessionRecord
): Promise<boolean> {
  try {
    const client = supabaseClient || createBrowserClient();
    if (!client || typeof client.from !== 'function') {
      console.warn('saveWhiteboardSession: Invalid or missing Supabase client');
      return false;
    }

    if (!sessionData || !sessionData.room_id) {
      console.warn('saveWhiteboardSession: Missing sessionData or room_id');
      return false;
    }

    const payload = {
      room_id: sessionData.room_id,
      pages: sessionData.pages ?? [],
      active_page_id: sessionData.active_page_id,
      permissions: sessionData.permissions ?? defaultWhiteboardPermissions(),
      updated_at: sessionData.updated_at ?? new Date().toISOString(),
    };

    const { error } = await client
      .from('whiteboard_sessions')
      .upsert(payload, { onConflict: 'room_id' });

    if (error) {
      console.error('saveWhiteboardSession error:', error);
      return false;
    }

    return true;
  } catch (err) {
    console.error('saveWhiteboardSession exception:', err);
    return false;
  }
}

/**
 * Retrieves whiteboard session record by room_id from Supabase Postgres.
 */
export async function loadWhiteboardSession(
  supabaseClient: any,
  roomId: string
): Promise<{ pages: WhiteboardPage[]; activePageId: string; permissions: WhiteboardPermissions } | null> {
  try {
    const client = supabaseClient || createBrowserClient();
    if (!client || typeof client.from !== 'function') {
      console.warn('loadWhiteboardSession: Invalid or missing Supabase client');
      return null;
    }

    if (!roomId) {
      return null;
    }

    const query = client
      .from('whiteboard_sessions')
      .select('*')
      .eq('room_id', roomId);

    let res: any;
    if (typeof query.maybeSingle === 'function') {
      res = await query.maybeSingle();
    } else if (typeof query.single === 'function') {
      res = await query.single();
    } else {
      res = await query;
    }

    if (res?.error) {
      // PGRST116 indicates row not found in single()
      if (res.error.code === 'PGRST116') {
        return null;
      }
      console.error('loadWhiteboardSession error:', res.error);
      return null;
    }

    const recordData = Array.isArray(res?.data) ? res.data[0] : res?.data;
    if (!recordData) {
      return null;
    }

    return deserializeWhiteboardSession(recordData);
  } catch (err) {
    console.error('loadWhiteboardSession exception:', err);
    return null;
  }
}

/**
 * Merges two sets of whiteboard pages for multi-master conflict resolution.
 * Matches pages by ID; for matching pages, merges canvas objects by their object ID,
 * and appends new pages while enforcing continuous sequential numbering.
 */
export function mergeWhiteboardPages(
  localPages: WhiteboardPage[],
  remotePages: WhiteboardPage[]
): WhiteboardPage[] {
  if (!Array.isArray(localPages) || localPages.length === 0) {
    return Array.isArray(remotePages) && remotePages.length > 0
      ? deepClone(remotePages)
      : [createDefaultWhiteboardPage('default-page', 1)];
  }
  if (!Array.isArray(remotePages) || remotePages.length === 0) {
    return deepClone(localPages);
  }

  const mergedMap = new Map<string, WhiteboardPage>();

  // Ingest local pages
  for (const p of localPages) {
    mergedMap.set(p.id, deepClone(p));
  }

  // Ingest/merge remote pages
  for (const rPage of remotePages) {
    if (mergedMap.has(rPage.id)) {
      const local = mergedMap.get(rPage.id)!;
      const localObjects: any[] = local.canvasJson?.objects || [];
      const remoteObjects: any[] = rPage.canvasJson?.objects || [];

      const objMap = new Map<string, any>();
      localObjects.forEach((obj, idx) => {
        const id = obj.id || `loc-obj-${idx}`;
        objMap.set(id, obj);
      });
      remoteObjects.forEach((obj, idx) => {
        const id = obj.id || `rem-obj-${idx}`;
        objMap.set(id, obj);
      });

      local.canvasJson = {
        ...(local.canvasJson || { version: '6.0' }),
        ...(rPage.canvasJson || {}),
        objects: Array.from(objMap.values()),
      };
      if (rPage.backgroundPdfUrl) local.backgroundPdfUrl = rPage.backgroundPdfUrl;
      if (rPage.backgroundPdfPage) local.backgroundPdfPage = rPage.backgroundPdfPage;
      if (rPage.backgroundImageUrl) local.backgroundImageUrl = rPage.backgroundImageUrl;
      if (rPage.title) local.title = rPage.title;
    } else {
      mergedMap.set(rPage.id, deepClone(rPage));
    }
  }

  const mergedPages = Array.from(mergedMap.values());
  mergedPages.forEach((p, idx) => {
    p.pageNumber = idx + 1;
  });

  return mergedPages;
}

/**
 * Merges local and remote session snapshots for multi-master synchronization.
 */
export function mergeWhiteboardSessions(
  local: { pages: WhiteboardPage[]; activePageId: string; permissions: WhiteboardPermissions },
  remote: { pages: WhiteboardPage[]; activePageId: string; permissions: WhiteboardPermissions }
): { pages: WhiteboardPage[]; activePageId: string; permissions: WhiteboardPermissions } {
  const mergedPages = mergeWhiteboardPages(local.pages, remote.pages);
  const activePageId =
    remote.activePageId && mergedPages.some((p) => p.id === remote.activePageId)
      ? remote.activePageId
      : local.activePageId && mergedPages.some((p) => p.id === local.activePageId)
      ? local.activePageId
      : mergedPages[0].id;

  const mergedPermissions: WhiteboardPermissions = {
    ...local.permissions,
    ...remote.permissions,
    studentDrawingGranted: {
      ...(local.permissions?.studentDrawingGranted || {}),
      ...(remote.permissions?.studentDrawingGranted || {}),
    },
  };

  return {
    pages: mergedPages,
    activePageId,
    permissions: mergedPermissions,
  };
}
