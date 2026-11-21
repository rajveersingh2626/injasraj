import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  serializeWhiteboardSession,
  deserializeWhiteboardSession,
  DebouncedPersistenceManager,
  saveWhiteboardSession,
  loadWhiteboardSession,
  mergeWhiteboardPages,
  mergeWhiteboardSessions,
  WhiteboardSessionRecord,
} from '../../src/lib/whiteboard/whiteboard-persistence';
import {
  WhiteboardPage,
  WhiteboardPermissions,
  defaultWhiteboardPermissions,
  createDefaultWhiteboardPage,
} from '../../src/types/whiteboard';

describe('Task 10: Whiteboard Persistence & Supabase Integration', () => {
  // ==========================================================================
  // Suite 1: PostgreSQL Migration Schema & DDL Verification
  // ==========================================================================
  describe('Suite 1: PostgreSQL Migration (20261121000001_whiteboard_sessions.sql)', () => {
    const migrationPath = path.resolve(
      process.cwd(),
      'supabase/migrations/20261121000001_whiteboard_sessions.sql'
    );

    it('migration file exists at supabase/migrations/20261121000001_whiteboard_sessions.sql', () => {
      expect(fs.existsSync(migrationPath)).toBe(true);
    });

    it('defines public.whiteboard_sessions table with all required columns and constraints', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(/create\s+table\s+(if\s+not\s+exists\s+)?(public\.)?whiteboard_sessions/i);
      expect(sql).toMatch(/id\s+uuid\s+primary\s+key\s+default\s+gen_random_uuid\(\)/i);
      expect(sql).toMatch(/room_id\s+text\s+not\s+null\s+unique/i);
      expect(sql).toMatch(/pages\s+jsonb\s+not\s+null\s+default\s+'\[\]'::jsonb/i);
      expect(sql).toMatch(/active_page_id\s+text\s+not\s+null/i);
      expect(sql).toMatch(/permissions\s+jsonb\s+not\s+null\s+default\s+'\{\}'::jsonb/i);
      expect(sql).toMatch(/updated_at\s+timestamptz\s+not\s+null\s+default\s+now\(\)/i);
    });

    it('creates performance indexes on room_id and updated_at', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(
        /create\s+index\s+(if\s+not\s+exists\s+)?idx_whiteboard_sessions_room_id\s+on\s+(public\.)?whiteboard_sessions\s*\(\s*room_id\s*\)/i
      );
      expect(sql).toMatch(
        /create\s+index\s+(if\s+not\s+exists\s+)?idx_whiteboard_sessions_updated_at\s+on\s+(public\.)?whiteboard_sessions\s*\(\s*updated_at\s*\)/i
      );
    });

    it('enables Row Level Security (RLS) on public.whiteboard_sessions', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(
        /alter\s+table\s+(public\.)?whiteboard_sessions\s+enable\s+row\s+level\s+security/i
      );
    });

    it('defines RLS policies for read, insert, and hardened participant update', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      // SELECT policy
      expect(sql).toMatch(
        /create\s+policy[\s\S]*?on\s+(public\.)?whiteboard_sessions\s+for\s+select[\s\S]*?using\s*\(\s*true\s*\)/i
      );
      // INSERT policy
      expect(sql).toMatch(
        /create\s+policy[\s\S]*?on\s+(public\.)?whiteboard_sessions\s+for\s+insert[\s\S]*?with\s+check\s*\(\s*true\s*\)/i
      );
      // Hardened UPDATE policy
      expect(sql).toMatch(
        /create\s+policy\s+"participants\s+can\s+update\s+whiteboard\s+sessions"[\s\S]*?on\s+(public\.)?whiteboard_sessions\s+for\s+update/i
      );
    });

    it('defines updated_at trigger function and trigger definition', () => {
      const sql = fs.readFileSync(migrationPath, 'utf-8');
      expect(sql).toMatch(/function\s+(public\.)?handle_whiteboard_sessions_updated_at/i);
      expect(sql).toMatch(/trigger\s+trigger_whiteboard_sessions_updated_at/i);
    });
  });

  // ==========================================================================
  // Suite 2: Serialization & Deserialization Engine
  // ==========================================================================
  describe('Suite 2: serializeWhiteboardSession & deserializeWhiteboardSession', () => {
    const createSamplePage = (id: string, pageNumber: number): WhiteboardPage => ({
      id,
      pageNumber,
      title: `Lesson Step ${pageNumber}`,
      canvasJson: {
        version: '6.0',
        objects: [
          {
            id: `obj-${id}-1`,
            type: 'path',
            path: [['M', 0, 0], ['L', 100, 100]],
            stroke: '#2563eb',
            strokeWidth: 4,
          },
        ],
      },
      backgroundPdfUrl: 'https://example.com/worksheet.pdf',
      backgroundPdfPage: 1,
    });

    it('serializes complete session into WhiteboardSessionRecord with deep clone isolation', () => {
      const originalPages = [createSamplePage('p1', 1), createSamplePage('p2', 2)];
      const perms = defaultWhiteboardPermissions();
      perms.studentDrawingGranted['student-123'] = true;

      const serialized = serializeWhiteboardSession('room-alpha', originalPages, 'p2', perms);

      expect(serialized.room_id).toBe('room-alpha');
      expect(serialized.active_page_id).toBe('p2');
      expect(serialized.pages.length).toBe(2);
      expect(serialized.permissions.studentDrawingGranted['student-123']).toBe(true);
      expect(typeof serialized.updated_at).toBe('string');

      // Verify deep cloning: modifying original objects does NOT mutate serialized output
      (originalPages[0].canvasJson.objects as any[]).push({ id: 'injected-obj' });
      perms.studentDrawingGranted['student-456'] = true;

      expect(serialized.pages[0].canvasJson.objects.length).toBe(1);
      expect(serialized.permissions.studentDrawingGranted['student-456']).toBeUndefined();
    });

    it('handles empty pages during serialization by creating a default page', () => {
      const serialized = serializeWhiteboardSession('room-empty', [], '', defaultWhiteboardPermissions());
      expect(serialized.pages.length).toBe(1);
      expect(serialized.active_page_id).toBe(serialized.pages[0].id);
      expect(serialized.pages[0].canvasJson.version).toBe('6.0');
    });

    it('falls back to first page ID if provided activePageId does not exist in pages', () => {
      const pages = [createSamplePage('p-one', 1)];
      const serialized = serializeWhiteboardSession('room-1', pages, 'non-existent-id', defaultWhiteboardPermissions());
      expect(serialized.active_page_id).toBe('p-one');
    });

    it('deserializes standard record into typed session object', () => {
      const record = {
        id: 'db-record-uuid',
        room_id: 'room-beta',
        pages: [createSamplePage('page-a', 1), createSamplePage('page-b', 2)],
        active_page_id: 'page-b',
        permissions: defaultWhiteboardPermissions(),
        updated_at: '2026-11-21T12:00:00Z',
      };

      const deserialized = deserializeWhiteboardSession(record);
      expect(deserialized.pages.length).toBe(2);
      expect(deserialized.activePageId).toBe('page-b');
      expect(deserialized.pages[0].id).toBe('page-a');
      expect(deserialized.pages[1].id).toBe('page-b');
      expect(deserialized.permissions.isLockedGlobally).toBe(true);
    });

    it('deserializes record where pages and permissions are JSON stringified (JSONB string fallback)', () => {
      const record = {
        room_id: 'room-stringified',
        pages: JSON.stringify([createSamplePage('p-str', 1)]),
        active_page_id: 'p-str',
        permissions: JSON.stringify(defaultWhiteboardPermissions()),
      };

      const deserialized = deserializeWhiteboardSession(record);
      expect(deserialized.pages.length).toBe(1);
      expect(deserialized.activePageId).toBe('p-str');
      expect(deserialized.permissions.allowMovingOnlyOwnObjects).toBe(true);
    });

    it('gracefully handles null, undefined, or empty records with fallback defaults', () => {
      const nullResult = deserializeWhiteboardSession(null);
      expect(nullResult.pages.length).toBe(1);
      expect(nullResult.activePageId).toBe(nullResult.pages[0].id);
      expect(nullResult.permissions).toEqual(defaultWhiteboardPermissions());

      const emptyObjResult = deserializeWhiteboardSession({});
      expect(emptyObjResult.pages.length).toBe(1);
      expect(emptyObjResult.activePageId).toBe(emptyObjResult.pages[0].id);
      expect(emptyObjResult.permissions).toEqual(defaultWhiteboardPermissions());
    });

    it('ensures continuous sequential 1-based page numbers even if record has skewed pageNumbers', () => {
      const skewedRecord = {
        room_id: 'room-skewed',
        pages: [
          { id: 'p10', pageNumber: 99, title: 'Ten', canvasJson: { objects: [] } },
          { id: 'p20', pageNumber: 4, title: 'Twenty', canvasJson: { objects: [] } },
        ],
        active_page_id: 'p10',
      };

      const deserialized = deserializeWhiteboardSession(skewedRecord);
      expect(deserialized.pages[0].pageNumber).toBe(1);
      expect(deserialized.pages[1].pageNumber).toBe(2);
    });
  });

  // ==========================================================================
  // Suite 3: DebouncedPersistenceManager
  // ==========================================================================
  describe('Suite 3: DebouncedPersistenceManager', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('initializes with default 3000ms debounce interval', () => {
      const mockSave = vi.fn().mockResolvedValue(true);
      const manager = new DebouncedPersistenceManager(mockSave);
      expect(manager.getDebounceMs()).toBe(3000);
      expect(manager.isPending()).toBe(false);
    });

    it('batches rapid consecutive scheduleSave calls and triggers saveFn once after delay', async () => {
      const mockSave = vi.fn().mockResolvedValue(true);
      const manager = new DebouncedPersistenceManager(mockSave, 500);

      const record1: WhiteboardSessionRecord = {
        room_id: 'room-1',
        pages: [createDefaultWhiteboardPage('p1', 1)],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
      };

      const record2: WhiteboardSessionRecord = {
        ...record1,
        active_page_id: 'p2',
      };

      const record3: WhiteboardSessionRecord = {
        ...record1,
        active_page_id: 'p3',
      };

      manager.scheduleSave(record1);
      expect(manager.isPending()).toBe(true);
      vi.advanceTimersByTime(200);

      manager.scheduleSave(record2);
      expect(manager.isPending()).toBe(true);
      vi.advanceTimersByTime(200);

      manager.scheduleSave(record3);
      expect(manager.isPending()).toBe(true);

      // Total 400ms elapsed; timer was reset on each scheduleSave. mockSave should not have been called yet.
      expect(mockSave).not.toHaveBeenCalled();

      // Advance by full debounce window from last call (500ms)
      await vi.advanceTimersByTimeAsync(500);

      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith(record3);
      expect(manager.isPending()).toBe(false);
    });

    it('immediately executes flush() without waiting for debounce timeout', async () => {
      const mockSave = vi.fn().mockResolvedValue(true);
      const manager = new DebouncedPersistenceManager(mockSave, 3000);

      const record: WhiteboardSessionRecord = {
        room_id: 'room-flush',
        pages: [createDefaultWhiteboardPage('p1', 1)],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
      };

      manager.scheduleSave(record);
      expect(manager.isPending()).toBe(true);

      const flushResult = await manager.flush();
      expect(flushResult).toBe(true);
      expect(mockSave).toHaveBeenCalledTimes(1);
      expect(mockSave).toHaveBeenCalledWith(record);
      expect(manager.isPending()).toBe(false);

      // Fast-forward remaining timer: verify it does not trigger a duplicate save
      await vi.advanceTimersByTimeAsync(4000);
      expect(mockSave).toHaveBeenCalledTimes(1);
    });

    it('cancel() discards pending saves and prevents timer execution', async () => {
      const mockSave = vi.fn().mockResolvedValue(true);
      const manager = new DebouncedPersistenceManager(mockSave, 1000);

      const record: WhiteboardSessionRecord = {
        room_id: 'room-cancel',
        pages: [createDefaultWhiteboardPage('p1', 1)],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
      };

      manager.scheduleSave(record);
      expect(manager.isPending()).toBe(true);

      manager.cancel();
      expect(manager.isPending()).toBe(false);

      await vi.advanceTimersByTimeAsync(2000);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('flush() returns true and does nothing if no save is pending', async () => {
      const mockSave = vi.fn().mockResolvedValue(true);
      const manager = new DebouncedPersistenceManager(mockSave, 1000);

      const result = await manager.flush();
      expect(result).toBe(true);
      expect(mockSave).not.toHaveBeenCalled();
    });

    it('handles saveFn rejection gracefully in flush() without throwing unhandled rejection', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockSave = vi.fn().mockRejectedValue(new Error('Network timeout'));
      const manager = new DebouncedPersistenceManager(mockSave, 500);

      manager.scheduleSave({
        room_id: 'room-err',
        pages: [],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
      });

      const result = await manager.flush();
      expect(result).toBe(false);
      consoleErrorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Suite 4: Supabase Database Operations (saveWhiteboardSession & loadWhiteboardSession)
  // ==========================================================================
  describe('Suite 4: saveWhiteboardSession & loadWhiteboardSession', () => {
    it('saveWhiteboardSession upserts record to Supabase using room_id conflict key', async () => {
      const mockUpsert = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert });
      const mockSupabase = { from: mockFrom };

      const session: WhiteboardSessionRecord = {
        room_id: 'room-persist-1',
        pages: [createDefaultWhiteboardPage('p1', 1)],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
      };

      const success = await saveWhiteboardSession(mockSupabase, session);
      expect(success).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('whiteboard_sessions');
      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          room_id: 'room-persist-1',
          active_page_id: 'p1',
          pages: expect.any(Array),
          permissions: expect.any(Object),
        }),
        { onConflict: 'room_id' }
      );
    });

    it('saveWhiteboardSession returns false when database returns error', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockUpsert = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' },
      });
      const mockSupabase = { from: vi.fn().mockReturnValue({ upsert: mockUpsert }) };

      const session: WhiteboardSessionRecord = {
        room_id: 'room-fail',
        pages: [],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
      };

      const result = await saveWhiteboardSession(mockSupabase, session);
      expect(result).toBe(false);
      consoleErrorSpy.mockRestore();
    });

    it('saveWhiteboardSession validates input and returns false on missing room_id or invalid client', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const resultNoClient = await saveWhiteboardSession({} as any, {
        room_id: 'room-test',
        pages: [],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
      });
      expect(resultNoClient).toBe(false);

      const resultNoRoom = await saveWhiteboardSession({ from: vi.fn() } as any, {
        room_id: '',
        pages: [],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
      });
      expect(resultNoRoom).toBe(false);

      consoleWarnSpy.mockRestore();
    });

    it('loadWhiteboardSession fetches session by room_id and deserializes it', async () => {
      const mockRecord = {
        id: 'record-123',
        room_id: 'room-load-test',
        pages: [createDefaultWhiteboardPage('page-x', 1, 'Intro Page')],
        active_page_id: 'page-x',
        permissions: defaultWhiteboardPermissions(),
        updated_at: '2026-11-21T14:30:00Z',
      };

      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: mockRecord, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockFrom = vi.fn().mockReturnValue({ select: mockSelect });
      const mockSupabase = { from: mockFrom };

      const loaded = await loadWhiteboardSession(mockSupabase, 'room-load-test');
      expect(loaded).not.toBeNull();
      expect(loaded?.activePageId).toBe('page-x');
      expect(loaded?.pages.length).toBe(1);
      expect(loaded?.pages[0].title).toBe('Intro Page');
      expect(mockFrom).toHaveBeenCalledWith('whiteboard_sessions');
      expect(mockEq).toHaveBeenCalledWith('room_id', 'room-load-test');
    });

    it('loadWhiteboardSession returns null when record is not found', async () => {
      const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null, error: null });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSupabase = { from: vi.fn().mockReturnValue({ select: mockSelect }) };

      const loaded = await loadWhiteboardSession(mockSupabase, 'room-empty');
      expect(loaded).toBeNull();
    });

    it('loadWhiteboardSession returns null when database error occurs', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const mockMaybeSingle = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'RLS permission denied' },
      });
      const mockEq = vi.fn().mockReturnValue({ maybeSingle: mockMaybeSingle });
      const mockSelect = vi.fn().mockReturnValue({ eq: mockEq });
      const mockSupabase = { from: vi.fn().mockReturnValue({ select: mockSelect }) };

      const loaded = await loadWhiteboardSession(mockSupabase, 'room-err');
      expect(loaded).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it('loadWhiteboardSession returns null when room_id is empty', async () => {
      const loaded = await loadWhiteboardSession({ from: vi.fn() } as any, '');
      expect(loaded).toBeNull();
    });
  });

  // ==========================================================================
  // Suite 5: Multi-Master State Merge Compatibility
  // ==========================================================================
  describe('Suite 5: Multi-Master State Merge Compatibility', () => {
    it('merges local and remote pages by preserving drawing objects from both nodes', () => {
      const localPages: WhiteboardPage[] = [
        {
          id: 'page-1',
          pageNumber: 1,
          title: 'Slide 1',
          canvasJson: {
            version: '6.0',
            objects: [
              { id: 'obj-teacher-1', type: 'rect', fill: 'red' },
              { id: 'obj-shared', type: 'circle', fill: 'blue' },
            ],
          },
        },
      ];

      const remotePages: WhiteboardPage[] = [
        {
          id: 'page-1',
          pageNumber: 1,
          title: 'Slide 1',
          canvasJson: {
            version: '6.0',
            objects: [
              { id: 'obj-student-1', type: 'path', stroke: 'green' },
              { id: 'obj-shared', type: 'circle', fill: 'purple' }, // updated on remote
            ],
          },
        },
        {
          id: 'page-2',
          pageNumber: 2,
          title: 'Slide 2 Added by Teacher',
          canvasJson: { version: '6.0', objects: [] },
        },
      ];

      const merged = mergeWhiteboardPages(localPages, remotePages);
      expect(merged.length).toBe(2);

      // Check objects on page-1
      const p1Objects = merged[0].canvasJson.objects;
      expect(p1Objects.length).toBe(3); // obj-teacher-1, obj-shared (updated), obj-student-1
      const sharedObj = p1Objects.find((o: any) => o.id === 'obj-shared');
      expect(sharedObj.fill).toBe('purple');

      // Verify sequential page numbering
      expect(merged[0].pageNumber).toBe(1);
      expect(merged[1].pageNumber).toBe(2);
      expect(merged[1].id).toBe('page-2');
    });

    it('merges complete whiteboard sessions while uniting permissions', () => {
      const localSession = {
        pages: [createDefaultWhiteboardPage('p1', 1)],
        activePageId: 'p1',
        permissions: {
          ...defaultWhiteboardPermissions(),
          studentDrawingGranted: { 'student-alice': true },
        },
      };

      const remoteSession = {
        pages: [createDefaultWhiteboardPage('p1', 1), createDefaultWhiteboardPage('p2', 2)],
        activePageId: 'p2',
        permissions: {
          ...defaultWhiteboardPermissions(),
          studentDrawingGranted: { 'student-bob': true },
        },
      };

      const merged = mergeWhiteboardSessions(localSession, remoteSession);
      expect(merged.pages.length).toBe(2);
      expect(merged.activePageId).toBe('p2');
      expect(merged.permissions.studentDrawingGranted['student-alice']).toBe(true);
      expect(merged.permissions.studentDrawingGranted['student-bob']).toBe(true);
    });
  });
});
