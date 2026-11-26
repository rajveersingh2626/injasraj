/**
 * Authoritative Teacher Permission & Validation Guards
 *
 * Implements server-grade authoritative permission checks for the dedicated
 * teaching whiteboard. Ensures teacher actions are unconditionally permitted,
 * while student drawing, object movement, deletion, and tool usage are strictly
 * governed by session permissions and role boundaries.
 */

import {
  WhiteboardPermissions,
  WhiteboardToolType,
} from '../../types/whiteboard';

export type WhiteboardActionType =
  | 'draw'
  | 'select'
  | 'modify'
  | 'delete'
  | 'clear-page'
  | 'add-page'
  | 'delete-page'
  | 'change-permissions';

export interface WhiteboardAction {
  type: WhiteboardActionType | string;
  tool?: WhiteboardToolType;
  targetCreatedBy?: string; // userId who created target object
  targetObjectId?: string;
}

export interface UserIdentity {
  id: string;
  role: 'teacher' | 'student';
}

export type UserRole = UserIdentity;

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates whether an action requested by a user is permitted given current whiteboard permissions.
 *
 * Rules:
 * 1. Teachers are unconditionally permitted for all actions.
 * 2. Students cannot perform teacher-only administrative actions (change-permissions, add-page, delete-page, clear-page).
 * 3. In laserPointerOnly mode, students may only use the laser pointer tool; all drawing, modifying, and deleting is blocked.
 * 4. When the whiteboard is locked globally, students cannot draw, modify, or delete unless explicitly granted permission.
 * 5. If a tool is specified, it must be contained in the allowedTools list.
 * 6. Deletion of teacher/other content is blocked when preventDeletingTeacherContent is true.
 * 7. Modification of other objects is blocked when allowMovingOnlyOwnObjects is true.
 */
export function validateWhiteboardAction(
  action: WhiteboardAction,
  permissions: WhiteboardPermissions,
  user: UserIdentity,
  activePageId?: string
): ValidationResult {
  // 1. Authoritative Teacher Override: teachers have unrestricted access to all tools & actions
  if (user.role === 'teacher') {
    return { allowed: true };
  }

  // 2. Strict Teacher-Only Actions (blocked for all students regardless of drawing grants)
  const teacherOnlyActions = [
    'change-permissions',
    'add-page',
    'delete-page',
    'clear-page',
    'clear',
  ];
  if (teacherOnlyActions.includes(action.type)) {
    return { allowed: false, reason: 'Teacher only' };
  }

  // 3. Laser Pointer Only Mode
  if (permissions.laserPointerOnly) {
    if (action.tool !== 'laser') {
      return { allowed: false, reason: 'Laser pointer only' };
    }
    if (
      Array.isArray(permissions.allowedTools) &&
      !permissions.allowedTools.includes('laser')
    ) {
      return { allowed: false, reason: 'Tool not allowed' };
    }
    return { allowed: true };
  }

  // 4. Global or Per-Tab Lock Check: if locked, students require an explicit grant for interactive actions
  const isGranted = Boolean(permissions.studentDrawingGranted?.[user.id]);
  const isTabLocked = Boolean(activePageId && permissions.tabLocks?.[activePageId]);
  if ((permissions.isLockedGlobally || isTabLocked) && !isGranted) {
    const interactiveActions = ['draw', 'modify', 'move', 'delete'];
    if (interactiveActions.includes(action.type)) {
      return { allowed: false, reason: 'Whiteboard is locked by teacher' };
    }
  }

  // 5. Tool Check: if a tool is specified, it must be within allowedTools
  if (
    action.tool &&
    Array.isArray(permissions.allowedTools) &&
    !permissions.allowedTools.includes(action.tool)
  ) {
    return { allowed: false, reason: 'Tool not allowed' };
  }

  // 6. Content Deletion Protection: students cannot delete content they did not create
  if (action.type === 'delete') {
    if (
      permissions.preventDeletingTeacherContent &&
      action.targetCreatedBy !== user.id
    ) {
      return { allowed: false, reason: 'Cannot delete teacher content' };
    }
  }

  // 7. Object Modification / Movement Protection: students can only move their own objects
  if (action.type === 'modify' || action.type === 'move') {
    if (
      permissions.allowMovingOnlyOwnObjects &&
      action.targetCreatedBy !== user.id
    ) {
      return { allowed: false, reason: 'Can only move your own objects' };
    }
  }

  return { allowed: true };
}

/**
 * Helper to check if a user is permitted to modify or move a specific canvas object.
 */
export function canUserModifyObject(
  targetCreatedBy: string | undefined,
  permissions: WhiteboardPermissions,
  user: UserIdentity
): boolean {
  return validateWhiteboardAction(
    { type: 'modify', targetCreatedBy },
    permissions,
    user
  ).allowed;
}

/**
 * Helper to check if a user is permitted to delete a specific canvas object.
 */
export function canUserDeleteObject(
  targetCreatedBy: string | undefined,
  permissions: WhiteboardPermissions,
  user: UserIdentity
): boolean {
  return validateWhiteboardAction(
    { type: 'delete', targetCreatedBy },
    permissions,
    user
  ).allowed;
}

/**
 * Derives a human-readable banner status message for students based on current permissions.
 */
export function getStudentStatusMessage(
  permissions: WhiteboardPermissions,
  studentId: string,
  activePageId?: string
): string {
  if (permissions.laserPointerOnly) {
    return 'Laser pointer only';
  }

  const isGranted = Boolean(permissions.studentDrawingGranted?.[studentId]);
  const isTabLocked = Boolean(activePageId && permissions.tabLocks?.[activePageId]);

  if (permissions.isLockedGlobally || isTabLocked) {
    if (isGranted) {
      return 'Drawing permission granted';
    }
    return 'Whiteboard locked by teacher';
  }

  if (isGranted) {
    return 'Drawing permission granted';
  }

  return 'You can participate';
}
