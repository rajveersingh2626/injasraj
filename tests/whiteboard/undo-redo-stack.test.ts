import { describe, it, expect, beforeEach } from 'vitest';
import {
  UserUndoRedoStack,
  UndoCommand,
  DEFAULT_MAX_HISTORY_PER_USER,
} from '../../src/lib/whiteboard/undo-redo-stack';

describe('UserUndoRedoStack: Collaborative User-Scoped Undo/Redo Engine', () => {
  let stack: UserUndoRedoStack;

  const TEACHER_ID = 'teacher-1';
  const STUDENT_A = 'student-alice';
  const STUDENT_B = 'student-bob';

  beforeEach(() => {
    stack = new UserUndoRedoStack();
  });

  describe('Initialization & Configuration', () => {
    it('initializes with default maximum history of 50 per user', () => {
      const defaultStack = new UserUndoRedoStack();
      expect(defaultStack.getMaxHistoryPerUser()).toBe(DEFAULT_MAX_HISTORY_PER_USER);
      expect(defaultStack.getMaxHistoryPerUser()).toBe(50);
    });

    it('initializes with custom maximum history limit', () => {
      const customStack = new UserUndoRedoStack(20);
      expect(customStack.getMaxHistoryPerUser()).toBe(20);
    });

    it('falls back to default 50 if zero or negative limit is provided', () => {
      const zeroStack = new UserUndoRedoStack(0);
      expect(zeroStack.getMaxHistoryPerUser()).toBe(50);

      const negStack = new UserUndoRedoStack(-10);
      expect(negStack.getMaxHistoryPerUser()).toBe(50);
    });

    it('reports false for canUndo and canRedo on freshly initialized stack', () => {
      expect(stack.canUndo(TEACHER_ID)).toBe(false);
      expect(stack.canRedo(TEACHER_ID)).toBe(false);
      expect(stack.getUndoCount(TEACHER_ID)).toBe(0);
      expect(stack.getRedoCount(TEACHER_ID)).toBe(0);
      expect(stack.undo(TEACHER_ID)).toBeNull();
      expect(stack.redo(TEACHER_ID)).toBeNull();
      expect(stack.peekUndo(TEACHER_ID)).toBeNull();
      expect(stack.peekRedo(TEACHER_ID)).toBeNull();
    });

    it('handles non-existent or empty user IDs gracefully', () => {
      expect(stack.canUndo('')).toBe(false);
      expect(stack.canRedo('')).toBe(false);
      expect(stack.undo('')).toBeNull();
      expect(stack.redo('')).toBeNull();
      expect(stack.getUndoCount('')).toBe(0);
      expect(stack.getRedoCount('')).toBe(0);
    });
  });

  describe('Add -> Undo -> Redo Flow', () => {
    it('records an object addition with deep-cloned state and inverse metadata', () => {
      const shapeJson = {
        type: 'rect',
        id: 'rect-1',
        left: 100,
        top: 200,
        fill: '#3B82F6',
      };

      stack.recordAdd('rect-1', shapeJson, STUDENT_A);

      expect(stack.canUndo(STUDENT_A)).toBe(true);
      expect(stack.canRedo(STUDENT_A)).toBe(false);
      expect(stack.getUndoCount(STUDENT_A)).toBe(1);

      const peek = stack.peekUndo(STUDENT_A);
      expect(peek).not.toBeNull();
      expect(peek?.action).toBe('add');
      expect(peek?.objectId).toBe('rect-1');
      expect(peek?.userId).toBe(STUDENT_A);
      expect(peek?.inverse).toBe('remove');
      expect(peek?.afterState).toEqual(shapeJson);
      expect(peek?.beforeState).toBeUndefined();
      expect(typeof peek?.id).toBe('string');
      expect(typeof peek?.timestamp).toBe('number');
    });

    it('performs full undo then redo cycle on add command', () => {
      const circleJson = { type: 'circle', id: 'circle-1', radius: 50 };
      stack.recordAdd('circle-1', circleJson, STUDENT_A);

      // Undo: pops add command, transitions to redo stack
      const undoCmd = stack.undo(STUDENT_A);
      expect(undoCmd).not.toBeNull();
      expect(undoCmd?.action).toBe('add');
      expect(undoCmd?.objectId).toBe('circle-1');
      expect(undoCmd?.afterState).toEqual(circleJson);
      expect(undoCmd?.inverse).toBe('remove');

      expect(stack.canUndo(STUDENT_A)).toBe(false);
      expect(stack.canRedo(STUDENT_A)).toBe(true);
      expect(stack.getRedoCount(STUDENT_A)).toBe(1);

      // Redo: pops from redo stack, restores to undo stack
      const redoCmd = stack.redo(STUDENT_A);
      expect(redoCmd).not.toBeNull();
      expect(redoCmd?.action).toBe('add');
      expect(redoCmd?.objectId).toBe('circle-1');
      expect(redoCmd?.afterState).toEqual(circleJson);

      expect(stack.canUndo(STUDENT_A)).toBe(true);
      expect(stack.canRedo(STUDENT_A)).toBe(false);
    });

    it('preserves strict LIFO order across multiple consecutive additions', () => {
      stack.recordAdd('stroke-1', { id: 'stroke-1', width: 2 }, STUDENT_A);
      stack.recordAdd('stroke-2', { id: 'stroke-2', width: 3 }, STUDENT_A);
      stack.recordAdd('stroke-3', { id: 'stroke-3', width: 4 }, STUDENT_A);

      expect(stack.getUndoCount(STUDENT_A)).toBe(3);

      // Undo in reverse order: 3, then 2, then 1
      expect(stack.undo(STUDENT_A)?.objectId).toBe('stroke-3');
      expect(stack.undo(STUDENT_A)?.objectId).toBe('stroke-2');
      expect(stack.undo(STUDENT_A)?.objectId).toBe('stroke-1');
      expect(stack.undo(STUDENT_A)).toBeNull();

      expect(stack.canUndo(STUDENT_A)).toBe(false);
      expect(stack.getRedoCount(STUDENT_A)).toBe(3);

      // Redo in forward order: 1, then 2, then 3
      expect(stack.redo(STUDENT_A)?.objectId).toBe('stroke-1');
      expect(stack.redo(STUDENT_A)?.objectId).toBe('stroke-2');
      expect(stack.redo(STUDENT_A)?.objectId).toBe('stroke-3');
      expect(stack.redo(STUDENT_A)).toBeNull();

      expect(stack.canRedo(STUDENT_A)).toBe(false);
      expect(stack.canUndo(STUDENT_A)).toBe(true);
    });
  });

  describe('Modify -> Undo -> Redo Flow', () => {
    it('records object modification with before and after snapshots', () => {
      const before = { id: 'text-1', text: 'Hello', fontSize: 16 };
      const after = { id: 'text-1', text: 'Hello World!', fontSize: 24 };

      stack.recordModify('text-1', before, after, TEACHER_ID);

      expect(stack.canUndo(TEACHER_ID)).toBe(true);
      expect(stack.getUndoCount(TEACHER_ID)).toBe(1);

      const cmd = stack.undo(TEACHER_ID);
      expect(cmd).not.toBeNull();
      expect(cmd?.action).toBe('modify');
      expect(cmd?.objectId).toBe('text-1');
      expect(cmd?.beforeState).toEqual(before);
      expect(cmd?.afterState).toEqual(after);
      expect(cmd?.inverse).toBe('modify');

      expect(stack.canUndo(TEACHER_ID)).toBe(false);
      expect(stack.canRedo(TEACHER_ID)).toBe(true);

      const redoCmd = stack.redo(TEACHER_ID);
      expect(redoCmd).not.toBeNull();
      expect(redoCmd?.action).toBe('modify');
      expect(redoCmd?.objectId).toBe('text-1');
      expect(redoCmd?.beforeState).toEqual(before);
      expect(redoCmd?.afterState).toEqual(after);
    });

    it('supports chained modifications to the same object', () => {
      const state1 = { id: 'obj-1', x: 0 };
      const state2 = { id: 'obj-1', x: 100 };
      const state3 = { id: 'obj-1', x: 200 };

      stack.recordModify('obj-1', state1, state2, STUDENT_A);
      stack.recordModify('obj-1', state2, state3, STUDENT_A);

      // First undo reverts state3 -> state2
      const undo1 = stack.undo(STUDENT_A);
      expect(undo1?.beforeState).toEqual(state2);
      expect(undo1?.afterState).toEqual(state3);

      // Second undo reverts state2 -> state1
      const undo2 = stack.undo(STUDENT_A);
      expect(undo2?.beforeState).toEqual(state1);
      expect(undo2?.afterState).toEqual(state2);

      // Re-apply forwards
      const redo1 = stack.redo(STUDENT_A);
      expect(redo1?.beforeState).toEqual(state1);
      expect(redo1?.afterState).toEqual(state2);

      const redo2 = stack.redo(STUDENT_A);
      expect(redo2?.beforeState).toEqual(state2);
      expect(redo2?.afterState).toEqual(state3);
    });
  });

  describe('Delete -> Undo -> Redo Flow', () => {
    it('records object deletion with before snapshot for restoration', () => {
      const stickyJson = {
        type: 'sticky',
        id: 'sticky-1',
        text: 'Exam question #1',
        fill: '#FEF08A',
      };

      stack.recordDelete('sticky-1', stickyJson, STUDENT_A);

      expect(stack.canUndo(STUDENT_A)).toBe(true);
      expect(stack.canRedo(STUDENT_A)).toBe(false);

      const undoCmd = stack.undo(STUDENT_A);
      expect(undoCmd).not.toBeNull();
      expect(undoCmd?.action).toBe('delete');
      expect(undoCmd?.objectId).toBe('sticky-1');
      expect(undoCmd?.beforeState).toEqual(stickyJson);
      expect(undoCmd?.inverse).toBe('restore');

      const redoCmd = stack.redo(STUDENT_A);
      expect(redoCmd).not.toBeNull();
      expect(redoCmd?.action).toBe('delete');
      expect(redoCmd?.objectId).toBe('sticky-1');
      expect(redoCmd?.beforeState).toEqual(stickyJson);
    });
  });

  describe('User Isolation & Multi-User Collaboration', () => {
    it('strictly isolates undo stacks between Teacher and Students', () => {
      // Teacher draws 2 diagram strokes
      stack.recordAdd('teacher-stroke-1', { id: 'teacher-stroke-1' }, TEACHER_ID);
      stack.recordAdd('teacher-stroke-2', { id: 'teacher-stroke-2' }, TEACHER_ID);

      // Student Alice draws an answer
      stack.recordAdd('alice-answer-1', { id: 'alice-answer-1' }, STUDENT_A);

      // Student Bob draws a note
      stack.recordAdd('bob-note-1', { id: 'bob-note-1' }, STUDENT_B);

      expect(stack.getUndoCount(TEACHER_ID)).toBe(2);
      expect(stack.getUndoCount(STUDENT_A)).toBe(1);
      expect(stack.getUndoCount(STUDENT_B)).toBe(1);

      // Student Alice undos her action
      const aliceUndone = stack.undo(STUDENT_A);
      expect(aliceUndone?.objectId).toBe('alice-answer-1');
      expect(aliceUndone?.userId).toBe(STUDENT_A);

      // Teacher and Bob are completely untouched!
      expect(stack.canUndo(STUDENT_A)).toBe(false);
      expect(stack.canUndo(TEACHER_ID)).toBe(true);
      expect(stack.getUndoCount(TEACHER_ID)).toBe(2);
      expect(stack.canUndo(STUDENT_B)).toBe(true);
      expect(stack.getUndoCount(STUDENT_B)).toBe(1);

      // Teacher undos latest stroke
      const teacherUndone = stack.undo(TEACHER_ID);
      expect(teacherUndone?.objectId).toBe('teacher-stroke-2');
      expect(teacherUndone?.userId).toBe(TEACHER_ID);
      expect(stack.getUndoCount(TEACHER_ID)).toBe(1);

      // Student Bob still intact
      expect(stack.getUndoCount(STUDENT_B)).toBe(1);
      expect(stack.undo(STUDENT_B)?.objectId).toBe('bob-note-1');
    });

    it('isolates redo stacks between users', () => {
      stack.recordAdd('t1', { id: 't1' }, TEACHER_ID);
      stack.recordAdd('a1', { id: 'a1' }, STUDENT_A);

      stack.undo(TEACHER_ID);
      stack.undo(STUDENT_A);

      expect(stack.canRedo(TEACHER_ID)).toBe(true);
      expect(stack.canRedo(STUDENT_A)).toBe(true);

      // Redoing Teacher does not consume Alice's redo
      const redoneTeacher = stack.redo(TEACHER_ID);
      expect(redoneTeacher?.objectId).toBe('t1');

      expect(stack.canRedo(TEACHER_ID)).toBe(false);
      expect(stack.canRedo(STUDENT_A)).toBe(true);
    });

    it('clearing history for one user preserves other users', () => {
      stack.recordAdd('t1', { id: 't1' }, TEACHER_ID);
      stack.recordAdd('a1', { id: 'a1' }, STUDENT_A);

      stack.clearUserHistory(STUDENT_A);

      expect(stack.canUndo(STUDENT_A)).toBe(false);
      expect(stack.getUndoCount(STUDENT_A)).toBe(0);

      expect(stack.canUndo(TEACHER_ID)).toBe(true);
      expect(stack.getUndoCount(TEACHER_ID)).toBe(1);
    });

    it('lists tracked user IDs accurately', () => {
      stack.recordAdd('t1', { id: 't1' }, TEACHER_ID);
      stack.recordAdd('a1', { id: 'a1' }, STUDENT_A);

      const userIds = stack.getUserIds();
      expect(userIds).toContain(TEACHER_ID);
      expect(userIds).toContain(STUDENT_A);
      expect(userIds.length).toBe(2);
    });
  });

  describe('Branching History (New Action Clears Redo Stack)', () => {
    it('discards redo stack when a user performs a new action after undo', () => {
      stack.recordAdd('obj-1', { id: 'obj-1' }, STUDENT_A);
      stack.recordAdd('obj-2', { id: 'obj-2' }, STUDENT_A);

      // Undo obj-2
      const undone = stack.undo(STUDENT_A);
      expect(undone?.objectId).toBe('obj-2');
      expect(stack.canRedo(STUDENT_A)).toBe(true);

      // User performs new action (obj-3)
      stack.recordAdd('obj-3', { id: 'obj-3' }, STUDENT_A);

      // Redo stack MUST be wiped out!
      expect(stack.canRedo(STUDENT_A)).toBe(false);
      expect(stack.getRedoCount(STUDENT_A)).toBe(0);
      expect(stack.redo(STUDENT_A)).toBeNull();

      // Undo now pops obj-3, then obj-1 (obj-2 is permanently discarded)
      expect(stack.undo(STUDENT_A)?.objectId).toBe('obj-3');
      expect(stack.undo(STUDENT_A)?.objectId).toBe('obj-1');
      expect(stack.undo(STUDENT_A)).toBeNull();
    });

    it('clears redo stack on new modify or delete action as well', () => {
      stack.recordAdd('obj-1', { id: 'obj-1' }, STUDENT_A);
      stack.undo(STUDENT_A);
      expect(stack.canRedo(STUDENT_A)).toBe(true);

      stack.recordModify('obj-1', { x: 1 }, { x: 2 }, STUDENT_A);
      expect(stack.canRedo(STUDENT_A)).toBe(false);

      stack.undo(STUDENT_A);
      expect(stack.canRedo(STUDENT_A)).toBe(true);

      stack.recordDelete('obj-1', { x: 2 }, STUDENT_A);
      expect(stack.canRedo(STUDENT_A)).toBe(false);
    });
  });

  describe('History Limit Clamping (FIFO Pruning)', () => {
    it('clamps user undo history to specified maximum depth', () => {
      const shallowStack = new UserUndoRedoStack(3);

      shallowStack.recordAdd('item-1', { id: 'item-1' }, STUDENT_A);
      shallowStack.recordAdd('item-2', { id: 'item-2' }, STUDENT_A);
      shallowStack.recordAdd('item-3', { id: 'item-3' }, STUDENT_A);
      shallowStack.recordAdd('item-4', { id: 'item-4' }, STUDENT_A);
      shallowStack.recordAdd('item-5', { id: 'item-5' }, STUDENT_A);

      expect(shallowStack.getUndoCount(STUDENT_A)).toBe(3);

      // Only items 5, 4, 3 remain. Items 1 and 2 were dropped by FIFO.
      expect(shallowStack.undo(STUDENT_A)?.objectId).toBe('item-5');
      expect(shallowStack.undo(STUDENT_A)?.objectId).toBe('item-4');
      expect(shallowStack.undo(STUDENT_A)?.objectId).toBe('item-3');
      expect(shallowStack.undo(STUDENT_A)).toBeNull();
    });

    it('clamps redo stack depth to maxHistoryPerUser', () => {
      const shallowStack = new UserUndoRedoStack(2);

      shallowStack.recordAdd('item-1', { id: 'item-1' }, STUDENT_A);
      shallowStack.recordAdd('item-2', { id: 'item-2' }, STUDENT_A);

      shallowStack.undo(STUDENT_A);
      shallowStack.undo(STUDENT_A);
      expect(shallowStack.getRedoCount(STUDENT_A)).toBe(2);

      expect(shallowStack.redo(STUDENT_A)?.objectId).toBe('item-1');
      expect(shallowStack.redo(STUDENT_A)?.objectId).toBe('item-2');
      expect(shallowStack.redo(STUDENT_A)).toBeNull();
    });
  });

  describe('Deep Cloning & Immutability', () => {
    it('mutating original state object does not mutate stored history', () => {
      const original = {
        id: 'rect-1',
        coords: { x: 10, y: 20 },
        colors: ['red', 'blue'],
      };

      stack.recordAdd('rect-1', original, STUDENT_A);

      // Mutate original object externally
      original.coords.x = 999;
      original.colors.push('green');

      const cmd = stack.undo(STUDENT_A);
      expect(cmd?.afterState.coords.x).toBe(10);
      expect(cmd?.afterState.colors).toEqual(['red', 'blue']);
    });

    it('mutating returned undo command does not corrupt redo stack state', () => {
      const original = { id: 'shape-1', width: 50 };
      stack.recordAdd('shape-1', original, STUDENT_A);

      const undone = stack.undo(STUDENT_A);
      expect(undone).not.toBeNull();
      undone!.afterState.width = 12345;

      const redone = stack.redo(STUDENT_A);
      expect(redone?.afterState.width).toBe(50);
    });
  });

  describe('Object Purging & Global Clear', () => {
    it('purges specific object across all users histories', () => {
      stack.recordAdd('shared-obj', { id: 'shared-obj' }, TEACHER_ID);
      stack.recordModify('shared-obj', { v: 1 }, { v: 2 }, STUDENT_A);
      stack.recordAdd('alice-other', { id: 'alice-other' }, STUDENT_A);

      expect(stack.getUndoCount(TEACHER_ID)).toBe(1);
      expect(stack.getUndoCount(STUDENT_A)).toBe(2);

      stack.purgeObject('shared-obj');

      expect(stack.getUndoCount(TEACHER_ID)).toBe(0);
      expect(stack.getUndoCount(STUDENT_A)).toBe(1);
      expect(stack.undo(STUDENT_A)?.objectId).toBe('alice-other');
    });

    it('clears all user histories on clearAll()', () => {
      stack.recordAdd('t1', { id: 't1' }, TEACHER_ID);
      stack.recordAdd('a1', { id: 'a1' }, STUDENT_A);
      stack.recordAdd('b1', { id: 'b1' }, STUDENT_B);

      stack.clearAll();

      expect(stack.canUndo(TEACHER_ID)).toBe(false);
      expect(stack.canUndo(STUDENT_A)).toBe(false);
      expect(stack.canUndo(STUDENT_B)).toBe(false);
      expect(stack.getUserIds().length).toBe(0);
    });
  });
});
