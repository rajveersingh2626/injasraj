import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  archiveClassToHistory,
  getPastClasses,
  getPastClassWhiteboard,
  deletePastClass,
  PAST_CLASSES_STORAGE_KEY,
  PastClassRecord,
} from '../../src/lib/classroom/past-classes';
import { WhiteboardSessionRecord } from '../../src/lib/whiteboard/whiteboard-persistence';
import { createDefaultWhiteboardPage, defaultWhiteboardPermissions } from '../../src/types/whiteboard';

describe('Past Classes History & Whiteboard Archival', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.clear();
    }
  });

  it('archives a completed class session with whiteboard pages and duration', async () => {
    const mockSnapshot: WhiteboardSessionRecord = {
      room_id: 'room-history-1',
      pages: [
        createDefaultWhiteboardPage('p-1', 1, 'Intro Slide'),
        createDefaultWhiteboardPage('p-2', 2, 'Problem 12 Solution'),
      ],
      active_page_id: 'p-2',
      permissions: defaultWhiteboardPermissions(),
      updated_at: new Date().toISOString(),
    };

    const archived = await archiveClassToHistory(
      'room-history-1',
      'Algebra Lesson',
      900,
      mockSnapshot
    );

    expect(archived.roomId).toBe('room-history-1');
    expect(archived.title).toBe('Algebra Lesson');
    expect(archived.durationSeconds).toBe(900);
    expect(archived.pageCount).toBe(2);
    expect(archived.whiteboardSnapshot?.pages.length).toBe(2);

    const history = getPastClasses();
    expect(history.length).toBe(1);
    expect(history[0].roomId).toBe('room-history-1');
  });

  it('retrieves saved whiteboard data for a previous class session', async () => {
    const mockSnapshot: WhiteboardSessionRecord = {
      room_id: 'room-restore-test',
      pages: [createDefaultWhiteboardPage('p-1', 1, 'Restored Geometry')],
      active_page_id: 'p-1',
      permissions: defaultWhiteboardPermissions(),
    };

    await archiveClassToHistory('room-restore-test', 'Geometry 101', 600, mockSnapshot);

    const retrieved = await getPastClassWhiteboard('room-restore-test');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.room_id).toBe('room-restore-test');
    expect(retrieved?.pages[0].title).toBe('Restored Geometry');
  });

  it('deletes past class record cleanly', async () => {
    const record = await archiveClassToHistory('room-del-1', 'Delete Test', 300);
    expect(getPastClasses().length).toBe(1);

    const deleted = deletePastClass(record.id);
    expect(deleted).toBe(true);
    expect(getPastClasses().length).toBe(0);
  });
});
