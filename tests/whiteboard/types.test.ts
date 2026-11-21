import { describe, it, expect } from 'vitest';
import {
  defaultWhiteboardPermissions,
  createDefaultWhiteboardPage,
  createWhiteboardDeltaMessage,
  ALL_WHITEBOARD_TOOLS,
  WhiteboardToolType,
  StrokeProperties,
  WhiteboardPage,
  WhiteboardPermissions,
  LaserPoint,
  WhiteboardDeltaType,
  WhiteboardDeltaMessage,
  WhiteboardAction,
  WhiteboardSessionRecord,
} from '../../src/types/whiteboard';

describe('Whiteboard Types & Factory Functions', () => {
  describe('defaultWhiteboardPermissions', () => {
    it('creates default locked-down permissions for structured teaching', () => {
      const perms = defaultWhiteboardPermissions();

      expect(perms.isLockedGlobally).toBe(true);
      expect(perms.preventDeletingTeacherContent).toBe(true);
      expect(perms.allowMovingOnlyOwnObjects).toBe(true);
      expect(perms.studentDrawingGranted).toEqual({});
      expect(perms.laserPointerOnly).toBe(false);
      expect(Array.isArray(perms.allowedTools)).toBe(true);
      expect(perms.allowedTools.length).toBeGreaterThan(0);
      expect(perms.allowedTools).toContain('pen');
      expect(perms.allowedTools).toContain('highlighter');
      expect(perms.allowedTools).toContain('laser');
    });

    it('returns a fresh object reference on every invocation', () => {
      const perms1 = defaultWhiteboardPermissions();
      const perms2 = defaultWhiteboardPermissions();

      expect(perms1).not.toBe(perms2);
      expect(perms1.studentDrawingGranted).not.toBe(perms2.studentDrawingGranted);
      expect(perms1.allowedTools).not.toBe(perms2.allowedTools);

      perms1.studentDrawingGranted['student-1'] = true;
      expect(perms2.studentDrawingGranted['student-1']).toBeUndefined();
    });
  });

  describe('createDefaultWhiteboardPage', () => {
    it('creates default empty whiteboard page with custom title', () => {
      const page = createDefaultWhiteboardPage('page-1', 1, 'Exercise 1');

      expect(page.id).toBe('page-1');
      expect(page.pageNumber).toBe(1);
      expect(page.title).toBe('Exercise 1');
      expect(page.canvasJson).toEqual({ version: '6.0', objects: [] });
      expect(page.backgroundPdfUrl).toBeUndefined();
      expect(page.backgroundPdfPage).toBeUndefined();
      expect(page.backgroundImageUrl).toBeUndefined();
      expect(page.thumbnailUrl).toBeUndefined();
    });

    it('generates fallback title when title is omitted', () => {
      const page = createDefaultWhiteboardPage('page-42', 42);

      expect(page.id).toBe('page-42');
      expect(page.pageNumber).toBe(42);
      expect(page.title).toBe('Page 42');
      expect(page.canvasJson).toEqual({ version: '6.0', objects: [] });
    });
  });

  describe('createWhiteboardDeltaMessage', () => {
    it('creates a valid delta message with generated timestamp', () => {
      const beforeTime = Date.now();
      const delta = createWhiteboardDeltaMessage('object-added', 'teacher-1', {
        pageId: 'page-1',
        objectId: 'obj-123',
        objectJson: { type: 'path', stroke: '#ff0000' },
      });
      const afterTime = Date.now();

      expect(delta.type).toBe('object-added');
      expect(delta.senderId).toBe('teacher-1');
      expect(delta.pageId).toBe('page-1');
      expect(delta.objectId).toBe('obj-123');
      expect(delta.objectJson).toEqual({ type: 'path', stroke: '#ff0000' });
      expect(delta.timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(delta.timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('preserves an explicitly provided timestamp', () => {
      const fixedTimestamp = 1770000000000;
      const delta = createWhiteboardDeltaMessage('laser-move', 'student-99', {
        laserPoint: { x: 300, y: 450, timestamp: fixedTimestamp, opacity: 0.8 },
        timestamp: fixedTimestamp,
      });

      expect(delta.type).toBe('laser-move');
      expect(delta.senderId).toBe('student-99');
      expect(delta.timestamp).toBe(fixedTimestamp);
      expect(delta.laserPoint).toEqual({
        x: 300,
        y: 450,
        timestamp: fixedTimestamp,
        opacity: 0.8,
      });
    });
  });

  describe('Type Contract Conformance', () => {
    it('supports all defined WhiteboardToolTypes', () => {
      const expectedTools: WhiteboardToolType[] = [
        'select',
        'pan',
        'pen',
        'pencil',
        'highlighter',
        'eraser',
        'line',
        'arrow',
        'rect',
        'circle',
        'triangle',
        'text',
        'sticky',
        'laser',
      ];

      expect(ALL_WHITEBOARD_TOOLS).toEqual(expectedTools);
    });

    it('allows valid StrokeProperties definition', () => {
      const stroke: StrokeProperties = {
        color: '#3b82f6',
        width: 4,
        opacity: 0.9,
        fill: '#dbeafe',
        fontSize: 18,
        fontFamily: 'Inter',
      };

      expect(stroke.color).toBe('#3b82f6');
      expect(stroke.width).toBe(4);
      expect(stroke.opacity).toBe(0.9);
      expect(stroke.fill).toBe('#dbeafe');
      expect(stroke.fontSize).toBe(18);
      expect(stroke.fontFamily).toBe('Inter');
    });

    it('allows valid WhiteboardPage definition with optional background', () => {
      const page: WhiteboardPage = {
        id: 'pg-002',
        pageNumber: 2,
        title: 'Worksheet Math 101',
        backgroundPdfUrl: 'https://example.com/sheet.pdf',
        backgroundPdfPage: 2,
        backgroundImageUrl: 'data:image/png;base64,...',
        canvasJson: { version: '6.0', objects: [{ type: 'rect' }] },
        thumbnailUrl: 'https://example.com/thumb.png',
      };

      expect(page.id).toBe('pg-002');
      expect(page.pageNumber).toBe(2);
      expect(page.backgroundPdfUrl).toBe('https://example.com/sheet.pdf');
      expect(page.backgroundPdfPage).toBe(2);
      expect(page.backgroundImageUrl).toBe('data:image/png;base64,...');
      expect(page.thumbnailUrl).toBe('https://example.com/thumb.png');
    });

    it('allows valid WhiteboardDeltaType payloads', () => {
      const deltaTypes: WhiteboardDeltaType[] = [
        'object-added',
        'object-modified',
        'object-removed',
        'laser-move',
        'page-switch',
        'page-added',
        'page-deleted',
        'permissions-update',
      ];

      for (const type of deltaTypes) {
        const msg: WhiteboardDeltaMessage = {
          type,
          senderId: 'user-xyz',
          timestamp: 123456789,
        };
        expect(msg.type).toBe(type);
      }
    });

    it('allows valid WhiteboardAction and WhiteboardSessionRecord', () => {
      const action: WhiteboardAction = {
        type: 'delete',
        targetCreatedBy: 'teacher-1',
        targetObjectId: 'obj-456',
        tool: 'select',
      };
      expect(action.type).toBe('delete');
      expect(action.targetCreatedBy).toBe('teacher-1');

      const session: WhiteboardSessionRecord = {
        id: 'sess-1',
        lesson_id: 'lesson-123',
        pages: [createDefaultWhiteboardPage('p1', 1)],
        active_page_id: 'p1',
        permissions: defaultWhiteboardPermissions(),
        updated_at: '2026-11-21T12:00:00Z',
      };
      expect(session.lesson_id).toBe('lesson-123');
      expect(session.pages.length).toBe(1);
    });
  });
});
