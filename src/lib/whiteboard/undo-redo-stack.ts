/**
 * User-Scoped Collaborative Undo/Redo Engine
 *
 * Implements command-based operational undo/redo stacks strictly segregated per user.
 * In a collaborative digital classroom (e.g., Teacher + Multiple Students):
 * - When student A triggers Undo, only student A's own strokes/actions are undone.
 * - Teacher content, worksheet background, or peer student drawings are never disturbed.
 * - Redo restores user A's undone command without affecting other active participants.
 * - Memory usage is bounded via FIFO history pruning per user.
 */

export type UndoActionType = 'add' | 'modify' | 'delete';

export type UndoInverseType = 'remove' | 'restore' | 'modify';

export interface UndoCommand {
  id: string;
  action: UndoActionType;
  objectId: string;
  userId: string;
  timestamp: number;
  beforeState?: any; // object JSON before modification or deletion
  afterState?: any;  // object JSON after addition or modification
  inverse?: UndoInverseType | string;
}

export interface UserHistoryState {
  undoStack: UndoCommand[];
  redoStack: UndoCommand[];
}

export const DEFAULT_MAX_HISTORY_PER_USER = 50;

/**
 * Safely deep-clones object states to ensure history immutability.
 */
function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) {
    return obj;
  }
  try {
    if (typeof structuredClone === 'function') {
      return structuredClone(obj);
    }
  } catch {
    // structuredClone failed or not supported in environment
  }
  try {
    return JSON.parse(JSON.stringify(obj));
  } catch {
    return obj;
  }
}

/**
 * Generates an RFC4122-compliant or secure unique command ID.
 */
function generateCommandId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'cmd-' + crypto.randomUUID();
  }
  return 'cmd-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

export class UserUndoRedoStack {
  private readonly maxHistoryPerUser: number;
  private readonly userHistories: Map<string, UserHistoryState> = new Map();

  /**
   * Initializes the undo/redo engine with a maximum history depth per user.
   * @param maxHistoryPerUser Maximum undo commands retained per user (defaults to 50).
   */
  constructor(maxHistoryPerUser: number = DEFAULT_MAX_HISTORY_PER_USER) {
    this.maxHistoryPerUser =
      typeof maxHistoryPerUser === 'number' && maxHistoryPerUser > 0
        ? Math.floor(maxHistoryPerUser)
        : DEFAULT_MAX_HISTORY_PER_USER;
  }

  /**
   * Returns the maximum history depth allowed per user.
   */
  public getMaxHistoryPerUser(): number {
    return this.maxHistoryPerUser;
  }

  /**
   * Retrieves or initializes the history state for a specific user.
   */
  private getOrCreateUserHistory(userId: string): UserHistoryState {
    let history = this.userHistories.get(userId);
    if (!history) {
      history = {
        undoStack: [],
        redoStack: [],
      };
      this.userHistories.set(userId, history);
    }
    return history;
  }

  /**
   * Records the addition of a new canvas object created by a user.
   * Clears the user's redo stack and prunes older entries beyond maxHistoryPerUser.
   *
   * @param objectId Unique identifier of the created canvas object.
   * @param objectJson Serialized snapshot of the created object.
   * @param userId ID of the user who created the object.
   */
  public recordAdd(objectId: string, objectJson: any, userId: string): void {
    if (!userId || !objectId) return;

    const history = this.getOrCreateUserHistory(userId);
    const command: UndoCommand = {
      id: generateCommandId(),
      action: 'add',
      objectId,
      userId,
      timestamp: Date.now(),
      afterState: deepClone(objectJson),
      inverse: 'remove',
    };

    history.undoStack.push(command);
    history.redoStack = [];

    if (history.undoStack.length > this.maxHistoryPerUser) {
      history.undoStack.shift();
    }
  }

  /**
   * Records a modification to an existing canvas object performed by a user.
   * Clears the user's redo stack and prunes older entries beyond maxHistoryPerUser.
   *
   * @param objectId Unique identifier of the modified canvas object.
   * @param beforeState Snapshot of the object state prior to modification.
   * @param afterState Snapshot of the object state post modification.
   * @param userId ID of the user who modified the object.
   */
  public recordModify(objectId: string, beforeState: any, afterState: any, userId: string): void {
    if (!userId || !objectId) return;

    const history = this.getOrCreateUserHistory(userId);
    const command: UndoCommand = {
      id: generateCommandId(),
      action: 'modify',
      objectId,
      userId,
      timestamp: Date.now(),
      beforeState: deepClone(beforeState),
      afterState: deepClone(afterState),
      inverse: 'modify',
    };

    history.undoStack.push(command);
    history.redoStack = [];

    if (history.undoStack.length > this.maxHistoryPerUser) {
      history.undoStack.shift();
    }
  }

  /**
   * Records the deletion of a canvas object performed by a user.
   * Clears the user's redo stack and prunes older entries beyond maxHistoryPerUser.
   *
   * @param objectId Unique identifier of the deleted canvas object.
   * @param beforeState Snapshot of the object state before it was deleted.
   * @param userId ID of the user who deleted the object.
   */
  public recordDelete(objectId: string, beforeState: any, userId: string): void {
    if (!userId || !objectId) return;

    const history = this.getOrCreateUserHistory(userId);
    const command: UndoCommand = {
      id: generateCommandId(),
      action: 'delete',
      objectId,
      userId,
      timestamp: Date.now(),
      beforeState: deepClone(beforeState),
      inverse: 'restore',
    };

    history.undoStack.push(command);
    history.redoStack = [];

    if (history.undoStack.length > this.maxHistoryPerUser) {
      history.undoStack.shift();
    }
  }

  /**
   * Checks whether the specified user has any commands available to undo.
   */
  public canUndo(userId: string): boolean {
    if (!userId) return false;
    const history = this.userHistories.get(userId);
    return Boolean(history && history.undoStack.length > 0);
  }

  /**
   * Checks whether the specified user has any commands available to redo.
   */
  public canRedo(userId: string): boolean {
    if (!userId) return false;
    const history = this.userHistories.get(userId);
    return Boolean(history && history.redoStack.length > 0);
  }

  /**
   * Undoes the latest command executed by the specified user.
   * Pops the command from the user's undo stack, pushes it to their redo stack,
   * and returns the command for inverse execution on canvas/engine.
   *
   * @param userId ID of the user requesting undo.
   * @returns The popped UndoCommand to execute, or null if nothing to undo.
   */
  public undo(userId: string): UndoCommand | null {
    if (!this.canUndo(userId)) return null;

    const history = this.userHistories.get(userId)!;
    const command = history.undoStack.pop()!;

    history.redoStack.push(command);
    if (history.redoStack.length > this.maxHistoryPerUser) {
      history.redoStack.shift();
    }

    return deepClone(command);
  }

  /**
   * Redoes the latest undone command for the specified user.
   * Pops the command from the user's redo stack, pushes it back to their undo stack,
   * and returns the command for re-execution on canvas/engine.
   *
   * @param userId ID of the user requesting redo.
   * @returns The popped UndoCommand to re-apply, or null if nothing to redo.
   */
  public redo(userId: string): UndoCommand | null {
    if (!this.canRedo(userId)) return null;

    const history = this.userHistories.get(userId)!;
    const command = history.redoStack.pop()!;

    history.undoStack.push(command);
    if (history.undoStack.length > this.maxHistoryPerUser) {
      history.undoStack.shift();
    }

    return deepClone(command);
  }

  /**
   * Returns the number of undoable commands currently stored for the specified user.
   */
  public getUndoCount(userId: string): number {
    return this.userHistories.get(userId)?.undoStack.length ?? 0;
  }

  /**
   * Returns the number of redoable commands currently stored for the specified user.
   */
  public getRedoCount(userId: string): number {
    return this.userHistories.get(userId)?.redoStack.length ?? 0;
  }

  /**
   * Returns a copy of the top undo command for the user without popping it.
   */
  public peekUndo(userId: string): UndoCommand | null {
    if (!this.canUndo(userId)) return null;
    const history = this.userHistories.get(userId)!;
    return deepClone(history.undoStack[history.undoStack.length - 1]);
  }

  /**
   * Returns a copy of the top redo command for the user without popping it.
   */
  public peekRedo(userId: string): UndoCommand | null {
    if (!this.canRedo(userId)) return null;
    const history = this.userHistories.get(userId)!;
    return deepClone(history.redoStack[history.redoStack.length - 1]);
  }

  /**
   * Returns a list of user IDs currently tracked in the engine.
   */
  public getUserIds(): string[] {
    return Array.from(this.userHistories.keys());
  }

  /**
   * Clears all undo and redo history for a specific user.
   */
  public clearUserHistory(userId: string): void {
    if (!userId) return;
    this.userHistories.delete(userId);
  }

  /**
   * Clears all undo and redo history across all users.
   */
  public clearAll(): void {
    this.userHistories.clear();
  }

  /**
   * Removes all commands referencing a specific object ID across all users.
   * Useful when an object is permanently purged or when a page is cleared.
   */
  public purgeObject(objectId: string): void {
    if (!objectId) return;

    for (const history of this.userHistories.values()) {
      history.undoStack = history.undoStack.filter((cmd) => cmd.objectId !== objectId);
      history.redoStack = history.redoStack.filter((cmd) => cmd.objectId !== objectId);
    }
  }
}

export { UserUndoRedoStack as UndoRedoStack };
