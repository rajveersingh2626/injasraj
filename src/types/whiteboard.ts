/**
 * Dedicated Teaching Whiteboard Domain Types & Interfaces
 *
 * Implements canonical domain models for multi-page whiteboard worksheets,
 * authoritative teacher permissions, real-time delta synchronization payloads,
 * and drawing tool properties.
 */

export type WhiteboardToolType =
  | 'select'
  | 'pan'
  | 'pen'
  | 'pencil'
  | 'highlighter'
  | 'eraser'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'circle'
  | 'triangle'
  | 'text'
  | 'sticky'
  | 'laser';

export interface StrokeProperties {
  color: string;
  width: number;
  opacity?: number;
  fill?: string;
  fontSize?: number;
  fontFamily?: string;
}

export interface WhiteboardPage {
  id: string;
  pageNumber: number;
  title: string;
  backgroundPdfUrl?: string;
  backgroundPdfPage?: number;
  backgroundImageUrl?: string;
  canvasJson: any; // Serialized Fabric.js v6 canvas object graph
  thumbnailUrl?: string;
}

export interface WhiteboardPermissions {
  isLockedGlobally: boolean;
  studentDrawingGranted: Record<string, boolean>; // studentId -> boolean
  preventDeletingTeacherContent: boolean;
  allowMovingOnlyOwnObjects: boolean;
  allowedTools: WhiteboardToolType[];
  laserPointerOnly: boolean;
}

export interface LaserPoint {
  x: number;
  y: number;
  timestamp: number;
  opacity?: number;
}

export type WhiteboardDeltaType =
  | 'object-added'
  | 'object-modified'
  | 'object-removed'
  | 'laser-move'
  | 'page-switch'
  | 'page-added'
  | 'page-deleted'
  | 'permissions-update';

export interface WhiteboardDeltaMessage {
  type: WhiteboardDeltaType;
  pageId?: string;
  objectId?: string;
  objectJson?: any;
  properties?: any;
  laserPoint?: LaserPoint;
  permissions?: WhiteboardPermissions;
  senderId: string;
  timestamp: number;
}

export type WhiteboardActionType =
  | 'draw'
  | 'modify'
  | 'move'
  | 'delete'
  | 'clear'
  | 'laser'
  | 'page-switch';

export interface WhiteboardAction {
  type: WhiteboardActionType | string;
  tool?: WhiteboardToolType;
  targetCreatedBy?: string;
  targetObjectId?: string;
}

export interface WhiteboardValidationResult {
  allowed: boolean;
  reason?: string;
}

export interface WhiteboardSessionRecord {
  id?: string;
  room_id?: string;
  lesson_id?: string;
  pages: WhiteboardPage[];
  active_page_id: string;
  permissions: WhiteboardPermissions;
  updated_at?: string;
}

export const ALL_WHITEBOARD_TOOLS: WhiteboardToolType[] = [
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

export const DEFAULT_STUDENT_ALLOWED_TOOLS: WhiteboardToolType[] = [
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

/**
 * Returns default authoritative permissions for structured tutoring.
 * Whiteboard starts locked globally to prevent uncoordinated student scribbling.
 */
export function defaultWhiteboardPermissions(): WhiteboardPermissions {
  return {
    isLockedGlobally: true,
    studentDrawingGranted: {},
    preventDeletingTeacherContent: true,
    allowMovingOnlyOwnObjects: true,
    allowedTools: [...DEFAULT_STUDENT_ALLOWED_TOOLS],
    laserPointerOnly: false,
  };
}

/**
 * Creates a default blank WhiteboardPage initialized with an empty Fabric v6 canvas.
 */
export function createDefaultWhiteboardPage(
  id: string,
  pageNumber: number,
  title?: string
): WhiteboardPage {
  return {
    id,
    pageNumber,
    title: title ?? `Page ${pageNumber}`,
    canvasJson: {
      version: '6.0',
      objects: [],
    },
  };
}

/**
 * Factory helper for constructing valid WhiteboardDeltaMessage payloads.
 */
export function createWhiteboardDeltaMessage(
  type: WhiteboardDeltaType,
  senderId: string,
  payload?: Partial<Omit<WhiteboardDeltaMessage, 'type' | 'senderId'>>
): WhiteboardDeltaMessage {
  return {
    type,
    senderId,
    timestamp: payload?.timestamp ?? Date.now(),
    ...payload,
  };
}
