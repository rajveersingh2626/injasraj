import { describe, it, expect } from 'vitest';
import {
  validateWhiteboardAction,
  canUserModifyObject,
  canUserDeleteObject,
  getStudentStatusMessage,
  WhiteboardAction,
  UserIdentity,
} from '../../src/lib/whiteboard/permission-guard';
import {
  defaultWhiteboardPermissions,
  WhiteboardPermissions,
} from '../../src/types/whiteboard';

describe('Whiteboard Permission Guard & Validation', () => {
  const teacherUser: UserIdentity = { id: 'teacher-1', role: 'teacher' };
  const studentUser: UserIdentity = { id: 'student-1', role: 'student' };
  const otherStudentUser: UserIdentity = { id: 'student-2', role: 'student' };

  describe('Teacher Authoritative Overrides', () => {
    it('always allows any action for the teacher regardless of global lock', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = true;

      const actions: WhiteboardAction[] = [
        { type: 'draw', tool: 'pen' },
        { type: 'select', tool: 'select' },
        { type: 'modify', targetCreatedBy: 'student-1' },
        { type: 'delete', targetCreatedBy: 'student-1' },
        { type: 'clear-page' },
        { type: 'add-page' },
        { type: 'delete-page' },
        { type: 'change-permissions' },
      ];

      for (const action of actions) {
        const res = validateWhiteboardAction(action, perms, teacherUser);
        expect(res.allowed).toBe(true);
        expect(res.reason).toBeUndefined();
      }
    });

    it('allows teacher actions even in laserPointerOnly mode or with empty allowedTools', () => {
      const perms = defaultWhiteboardPermissions();
      perms.laserPointerOnly = true;
      perms.allowedTools = [];

      const resDraw = validateWhiteboardAction({ type: 'draw', tool: 'highlighter' }, perms, teacherUser);
      expect(resDraw.allowed).toBe(true);

      const resClear = validateWhiteboardAction({ type: 'clear-page' }, perms, teacherUser);
      expect(resClear.allowed).toBe(true);
    });

    it('allows teacher to delete or modify any student content', () => {
      const perms = defaultWhiteboardPermissions();
      perms.preventDeletingTeacherContent = true;
      perms.allowMovingOnlyOwnObjects = true;

      expect(canUserModifyObject('student-1', perms, teacherUser)).toBe(true);
      expect(canUserDeleteObject('student-1', perms, teacherUser)).toBe(true);
    });
  });

  describe('Teacher-Only Actions Blocked for Students', () => {
    it('strictly forbids students from administrative page & permission actions', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.studentDrawingGranted['student-1'] = true;

      const teacherOnlyTypes: WhiteboardAction['type'][] = [
        'change-permissions',
        'add-page',
        'delete-page',
        'clear-page',
      ];

      for (const type of teacherOnlyTypes) {
        const res = validateWhiteboardAction({ type }, perms, studentUser);
        expect(res.allowed).toBe(false);
        expect(res.reason).toBe('Teacher only');
      }
    });

    it('also forbids synonymous action "clear" for students', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      const res = validateWhiteboardAction({ type: 'clear' as any }, perms, studentUser);
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Teacher only');
    });
  });

  describe('Global Lock Enforcement', () => {
    it('blocks student drawing, modifying, and deleting when globally locked without grant', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = true;
      perms.studentDrawingGranted = {};

      const drawRes = validateWhiteboardAction({ type: 'draw', tool: 'pen' }, perms, studentUser);
      expect(drawRes.allowed).toBe(false);
      expect(drawRes.reason).toBe('Whiteboard is locked by teacher');

      const modRes = validateWhiteboardAction({ type: 'modify', targetCreatedBy: 'student-1' }, perms, studentUser);
      expect(modRes.allowed).toBe(false);
      expect(modRes.reason).toBe('Whiteboard is locked by teacher');

      const delRes = validateWhiteboardAction({ type: 'delete', targetCreatedBy: 'student-1' }, perms, studentUser);
      expect(delRes.allowed).toBe(false);
      expect(delRes.reason).toBe('Whiteboard is locked by teacher');
    });

    it('allows student interactive actions when drawing is explicitly granted', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = true;
      perms.studentDrawingGranted['student-1'] = true;

      const drawRes = validateWhiteboardAction({ type: 'draw', tool: 'pen' }, perms, studentUser);
      expect(drawRes.allowed).toBe(true);

      const modRes = validateWhiteboardAction({ type: 'modify', targetCreatedBy: 'student-1' }, perms, studentUser);
      expect(modRes.allowed).toBe(true);
    });

    it('allows student interactive actions when whiteboard is not globally locked', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;

      const drawRes = validateWhiteboardAction({ type: 'draw', tool: 'pen' }, perms, studentUser);
      expect(drawRes.allowed).toBe(true);
    });

    it('does not block non-interactive select action when globally locked', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = true;
      perms.studentDrawingGranted = {};

      const selectRes = validateWhiteboardAction({ type: 'select', tool: 'select' }, perms, studentUser);
      expect(selectRes.allowed).toBe(true);
    });
  });

  describe('Tool Permission Filtering', () => {
    it('allows tools included in allowedTools', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.allowedTools = ['pen', 'highlighter', 'eraser'];

      const penRes = validateWhiteboardAction({ type: 'draw', tool: 'pen' }, perms, studentUser);
      expect(penRes.allowed).toBe(true);

      const highRes = validateWhiteboardAction({ type: 'draw', tool: 'highlighter' }, perms, studentUser);
      expect(highRes.allowed).toBe(true);
    });

    it('blocks tools not present in allowedTools', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.allowedTools = ['pen', 'eraser'];

      const textRes = validateWhiteboardAction({ type: 'draw', tool: 'text' }, perms, studentUser);
      expect(textRes.allowed).toBe(false);
      expect(textRes.reason).toBe('Tool not allowed');

      const stickyRes = validateWhiteboardAction({ type: 'draw', tool: 'sticky' }, perms, studentUser);
      expect(stickyRes.allowed).toBe(false);
      expect(stickyRes.reason).toBe('Tool not allowed');
    });
  });

  describe('Deletion Protection (Teacher Content)', () => {
    it('blocks student from deleting teacher content when preventDeletingTeacherContent is true', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.preventDeletingTeacherContent = true;

      const res = validateWhiteboardAction(
        { type: 'delete', targetCreatedBy: 'teacher-1' },
        perms,
        studentUser
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Cannot delete teacher content');
    });

    it('blocks student from deleting another student content when preventDeletingTeacherContent is true', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.preventDeletingTeacherContent = true;

      const res = validateWhiteboardAction(
        { type: 'delete', targetCreatedBy: 'student-2' },
        perms,
        studentUser
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Cannot delete teacher content');
    });

    it('allows student to delete their own content', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.preventDeletingTeacherContent = true;

      const res = validateWhiteboardAction(
        { type: 'delete', targetCreatedBy: 'student-1' },
        perms,
        studentUser
      );
      expect(res.allowed).toBe(true);
    });

    it('allows deleting any content when preventDeletingTeacherContent is disabled', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.preventDeletingTeacherContent = false;

      const res = validateWhiteboardAction(
        { type: 'delete', targetCreatedBy: 'teacher-1' },
        perms,
        studentUser
      );
      expect(res.allowed).toBe(true);
    });
  });

  describe('Object Modification & Movement Protection', () => {
    it('blocks student from modifying/moving non-own objects when allowMovingOnlyOwnObjects is true', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.allowMovingOnlyOwnObjects = true;

      const teacherTargetRes = validateWhiteboardAction(
        { type: 'modify', targetCreatedBy: 'teacher-1' },
        perms,
        studentUser
      );
      expect(teacherTargetRes.allowed).toBe(false);
      expect(teacherTargetRes.reason).toBe('Can only move your own objects');

      const peerTargetRes = validateWhiteboardAction(
        { type: 'modify', targetCreatedBy: 'student-2' },
        perms,
        studentUser
      );
      expect(peerTargetRes.allowed).toBe(false);
      expect(peerTargetRes.reason).toBe('Can only move your own objects');
    });

    it('allows student to modify/move their own objects', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.allowMovingOnlyOwnObjects = true;

      const ownTargetRes = validateWhiteboardAction(
        { type: 'modify', targetCreatedBy: 'student-1' },
        perms,
        studentUser
      );
      expect(ownTargetRes.allowed).toBe(true);
    });

    it('allows student to modify any object when allowMovingOnlyOwnObjects is disabled', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.allowMovingOnlyOwnObjects = false;

      const res = validateWhiteboardAction(
        { type: 'modify', targetCreatedBy: 'teacher-1' },
        perms,
        studentUser
      );
      expect(res.allowed).toBe(true);
    });

    it('supports synonymous "move" action type', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.allowMovingOnlyOwnObjects = true;

      const res = validateWhiteboardAction(
        { type: 'move' as any, targetCreatedBy: 'teacher-1' },
        perms,
        studentUser
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Can only move your own objects');
    });
  });

  describe('Laser Pointer Only Mode', () => {
    it('allows laser tool but blocks all other tools when laserPointerOnly is true', () => {
      const perms = defaultWhiteboardPermissions();
      perms.laserPointerOnly = true;

      const laserRes = validateWhiteboardAction(
        { type: 'draw', tool: 'laser' },
        perms,
        studentUser
      );
      expect(laserRes.allowed).toBe(true);

      const penRes = validateWhiteboardAction(
        { type: 'draw', tool: 'pen' },
        perms,
        studentUser
      );
      expect(penRes.allowed).toBe(false);
      expect(penRes.reason).toBe('Laser pointer only');

      const modRes = validateWhiteboardAction(
        { type: 'modify', targetCreatedBy: 'student-1' },
        perms,
        studentUser
      );
      expect(modRes.allowed).toBe(false);
      expect(modRes.reason).toBe('Laser pointer only');

      const delRes = validateWhiteboardAction(
        { type: 'delete', targetCreatedBy: 'student-1' },
        perms,
        studentUser
      );
      expect(delRes.allowed).toBe(false);
      expect(delRes.reason).toBe('Laser pointer only');
    });

    it('blocks laser if laser is removed from allowedTools', () => {
      const perms = defaultWhiteboardPermissions();
      perms.laserPointerOnly = true;
      perms.allowedTools = ['pen'];

      const res = validateWhiteboardAction(
        { type: 'draw', tool: 'laser' },
        perms,
        studentUser
      );
      expect(res.allowed).toBe(false);
      expect(res.reason).toBe('Tool not allowed');
    });
  });

  describe('canUserModifyObject & canUserDeleteObject helpers', () => {
    it('properly evaluates canUserModifyObject', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.allowMovingOnlyOwnObjects = true;

      expect(canUserModifyObject('teacher-1', perms, teacherUser)).toBe(true);
      expect(canUserModifyObject('student-1', perms, teacherUser)).toBe(true);
      expect(canUserModifyObject('student-1', perms, studentUser)).toBe(true);
      expect(canUserModifyObject('student-2', perms, studentUser)).toBe(false);
      expect(canUserModifyObject('teacher-1', perms, studentUser)).toBe(false);
      expect(canUserModifyObject(undefined, perms, studentUser)).toBe(false);
    });

    it('properly evaluates canUserDeleteObject', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.preventDeletingTeacherContent = true;

      expect(canUserDeleteObject('teacher-1', perms, teacherUser)).toBe(true);
      expect(canUserDeleteObject('student-1', perms, teacherUser)).toBe(true);
      expect(canUserDeleteObject('student-1', perms, studentUser)).toBe(true);
      expect(canUserDeleteObject('student-2', perms, studentUser)).toBe(false);
      expect(canUserDeleteObject('teacher-1', perms, studentUser)).toBe(false);
      expect(canUserDeleteObject(undefined, perms, studentUser)).toBe(false);
    });
  });

  describe('getStudentStatusMessage', () => {
    it('returns "Laser pointer only" when laserPointerOnly is true', () => {
      const perms = defaultWhiteboardPermissions();
      perms.laserPointerOnly = true;

      expect(getStudentStatusMessage(perms, 'student-1')).toBe('Laser pointer only');

      // Even if student drawing is granted, laserPointerOnly mode takes precedence
      perms.studentDrawingGranted['student-1'] = true;
      expect(getStudentStatusMessage(perms, 'student-1')).toBe('Laser pointer only');
    });

    it('returns "Whiteboard locked by teacher" when locked globally and not granted', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = true;
      perms.studentDrawingGranted = {};

      expect(getStudentStatusMessage(perms, 'student-1')).toBe('Whiteboard locked by teacher');
    });

    it('returns "Drawing permission granted" when granted during global lock', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = true;
      perms.studentDrawingGranted['student-1'] = true;

      expect(getStudentStatusMessage(perms, 'student-1')).toBe('Drawing permission granted');
      expect(getStudentStatusMessage(perms, 'student-2')).toBe('Whiteboard locked by teacher');
    });

    it('returns "You can participate" when whiteboard is unlocked globally and no individual override', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.studentDrawingGranted = {};

      expect(getStudentStatusMessage(perms, 'student-1')).toBe('You can participate');
    });

    it('returns "Drawing permission granted" when unlocked and explicitly granted', () => {
      const perms = defaultWhiteboardPermissions();
      perms.isLockedGlobally = false;
      perms.studentDrawingGranted['student-1'] = true;

      expect(getStudentStatusMessage(perms, 'student-1')).toBe('Drawing permission granted');
      expect(getStudentStatusMessage(perms, 'student-2')).toBe('You can participate');
    });
  });
});
