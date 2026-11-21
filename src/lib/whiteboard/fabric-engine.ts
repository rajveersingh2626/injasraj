/**
 * Fabric.js Canvas Engine Core & Vector Drawing Tools
 *
 * Implements canonical 1920x1080 virtual coordinate drawing engine with:
 * - Freehand drawing (pen, pencil, smooth curves)
 * - Semi-transparent highlighter (default 0.35 opacity for worksheet legibility)
 * - Object-level eraser
 * - Vector geometric shapes (rect, circle, triangle, line, arrow)
 * - Editable text & pastel sticky notes
 * - Ephemeral laser pointer events (no permanent canvas footprint)
 * - Locked worksheet background images (unselectable, non-interactive, preserved on page clear)
 * - JSDOM / headless test-environment safety without requiring native WebGL/Canvas2D context
 */

import {
  WhiteboardToolType,
  StrokeProperties,
} from '../../types/whiteboard';
import {
  DEFAULT_VIRTUAL_WIDTH,
  DEFAULT_VIRTUAL_HEIGHT,
  calculateViewportTransform,
  screenToVirtualPoint,
} from './viewport-transform';

export const DEFAULT_HIGHLIGHTER_OPACITY = 0.35;
export const DEFAULT_STICKY_COLOR = '#FEF08A';
export const DEFAULT_STICKY_WIDTH = 200;
export const DEFAULT_STICKY_HEIGHT = 180;

export const DEFAULT_STROKE_PROPERTIES: StrokeProperties = {
  color: '#000000',
  width: 3,
  opacity: 1.0,
  fill: 'transparent',
  fontSize: 24,
  fontFamily: 'Inter, system-ui, sans-serif',
};

/**
 * Deep clones an object safely via JSON serialization.
 */
function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generates an RFC4122-compliant or secure unique ID for canvas objects.
 */
function generateObjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'obj-' + crypto.randomUUID();
  }
  return 'obj-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

/**
 * Generates smooth SVG path string from point stream using quadratic bezier interpolation.
 */
function pointsToSvgPath(points: Array<{ x: number; y: number }>): string {
  if (!points || points.length === 0) return '';
  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
  }
  let path = `M ${points[0].x} ${points[0].y}`;
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const midX = (prev.x + curr.x) / 2;
    const midY = (prev.y + curr.y) / 2;
    path += ` Q ${prev.x} ${prev.y}, ${midX} ${midY}`;
  }
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  return path;
}

/**
 * Calculates perpendicular distance from a point to a 2D line segment.
 */
function distanceToSegment(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) {
    return Math.hypot(px - x1, py - y1);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
}

/**
 * Robust geometric hit tester for canvas objects.
 */
export function isPointInObject(point: { x: number; y: number }, obj: any, tolerance: number = 8): boolean {
  if (!obj) return false;

  if (obj.type === 'rect' || obj.type === 'sticky' || obj.type === 'text' || obj.type === 'triangle') {
    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    const width = obj.width ?? 100;
    const height = obj.height ?? 100;
    return (
      point.x >= left - tolerance &&
      point.x <= left + width + tolerance &&
      point.y >= top - tolerance &&
      point.y <= top + height + tolerance
    );
  }

  if (obj.type === 'circle') {
    const radius = obj.radius ?? (obj.width ? obj.width / 2 : 50);
    const centerX = (obj.left ?? 0) + radius;
    const centerY = (obj.top ?? 0) + radius;
    const distSq = (point.x - centerX) ** 2 + (point.y - centerY) ** 2;
    return distSq <= (radius + tolerance) ** 2;
  }

  if (obj.type === 'line' || obj.type === 'arrow') {
    const x1 = obj.x1 ?? obj.left ?? 0;
    const y1 = obj.y1 ?? obj.top ?? 0;
    const x2 = obj.x2 ?? (obj.left ?? 0) + (obj.width ?? 0);
    const y2 = obj.y2 ?? (obj.top ?? 0) + (obj.height ?? 0);
    return distanceToSegment(point.x, point.y, x1, y1, x2, y2) <= Math.max(tolerance, (obj.strokeWidth ?? 3) / 2 + 5);
  }

  if (obj.type === 'path') {
    if (Array.isArray(obj.points) && obj.points.length > 0) {
      const strokeTolerance = Math.max(tolerance, (obj.strokeWidth ?? 3) / 2 + 5);
      if (obj.points.length === 1) {
        const p = obj.points[0];
        const distSq = (point.x - p.x) ** 2 + (point.y - p.y) ** 2;
        return distSq <= strokeTolerance ** 2;
      }
      for (let i = 0; i < obj.points.length - 1; i++) {
        const p1 = obj.points[i];
        const p2 = obj.points[i + 1];
        if (distanceToSegment(point.x, point.y, p1.x, p1.y, p2.x, p2.y) <= strokeTolerance) {
          return true;
        }
      }
      return false;
    }
    if (obj.left !== undefined && obj.top !== undefined && obj.width !== undefined && obj.height !== undefined) {
      return (
        point.x >= obj.left - tolerance &&
        point.x <= obj.left + obj.width + tolerance &&
        point.y >= obj.top - tolerance &&
        point.y <= obj.top + obj.height + tolerance
      );
    }
    return false;
  }

  // Fallback to bounding box check only if explicit bounds exist
  if (obj.left !== undefined && obj.top !== undefined) {
    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    const width = obj.width ?? 0;
    const height = obj.height ?? 0;
    return (
      point.x >= left - tolerance &&
      point.x <= left + width + tolerance &&
      point.y >= top - tolerance &&
      point.y <= top + height + tolerance
    );
  }

  return false;
}

export interface FabricEngineOptions {
  virtualWidth?: number;
  virtualHeight?: number;
}

/**
 * Interactive Teaching Whiteboard Fabric Canvas Engine
 */
export class FabricWhiteboardEngine {
  private canvasElement?: HTMLCanvasElement;
  private virtualWidth: number;
  private virtualHeight: number;

  private activeTool: WhiteboardToolType = 'select';
  private strokeProperties: StrokeProperties;
  private previousOpacityBeforeHighlighter: number = 1.0;

  private objects: any[] = [];
  private selectedObjectIds: Set<string> = new Set();
  private backgroundImage: any | null = null;

  // Active freehand drawing state
  private isDrawing: boolean = false;
  private currentStrokePoints: Array<{ x: number; y: number }> = [];

  // Callbacks
  private objectAddedCallbacks: Array<(obj: any) => void> = [];
  private objectModifiedCallbacks: Array<(obj: any) => void> = [];
  private objectRemovedCallbacks: Array<(objId: string) => void> = [];
  private laserMoveCallbacks: Array<(point: { x: number; y: number }) => void> = [];

  // DOM listener teardown functions
  private domCleanupFns: Array<() => void> = [];

  // Native fabric canvas bridge (if present in window)
  private fabricCanvas?: any;

  constructor(canvasElement?: HTMLCanvasElement, options?: FabricEngineOptions) {
    this.virtualWidth = options?.virtualWidth && options.virtualWidth > 0
      ? options.virtualWidth
      : DEFAULT_VIRTUAL_WIDTH;
    this.virtualHeight = options?.virtualHeight && options.virtualHeight > 0
      ? options.virtualHeight
      : DEFAULT_VIRTUAL_HEIGHT;

    this.strokeProperties = { ...DEFAULT_STROKE_PROPERTIES };

    if (canvasElement) {
      this.canvasElement = canvasElement;
      try {
        canvasElement.width = this.virtualWidth;
        canvasElement.height = this.virtualHeight;
      } catch {}

      // Attempt to initialize window.fabric if available in browser
      if (typeof window !== 'undefined' && (window as any).fabric?.Canvas) {
        try {
          this.fabricCanvas = new (window as any).fabric.Canvas(canvasElement, {
            width: this.virtualWidth,
            height: this.virtualHeight,
            selection: true,
          });
        } catch {
          // Gracefully fall back to internal simulated engine in headless/JSDOM
          this.fabricCanvas = undefined;
        }
      }

      this.attachDomEvents(canvasElement);
    }
  }

  // ==========================================
  // Tool & Stroke Properties Management
  // ==========================================

  public setTool(tool: WhiteboardToolType, strokeProps?: Partial<StrokeProperties>): void {
    const prevTool = this.activeTool;
    this.activeTool = tool;

    if (tool === 'highlighter') {
      // Remember previous opacity if not already in highlighter mode
      if (prevTool !== 'highlighter') {
        this.previousOpacityBeforeHighlighter = this.strokeProperties.opacity ?? 1.0;
      }
      const targetOpacity = strokeProps?.opacity !== undefined
        ? strokeProps.opacity
        : DEFAULT_HIGHLIGHTER_OPACITY;
      this.setStrokeProperties({ ...strokeProps, opacity: targetOpacity });
    } else {
      // Revert highlighter opacity if switching back to normal drawing tool
      if (
        prevTool === 'highlighter' &&
        this.strokeProperties.opacity === DEFAULT_HIGHLIGHTER_OPACITY &&
        strokeProps?.opacity === undefined
      ) {
        this.setStrokeProperties({ opacity: this.previousOpacityBeforeHighlighter || 1.0 });
      }
      if (strokeProps) {
        this.setStrokeProperties(strokeProps);
      }
    }

    if (this.fabricCanvas) {
      try {
        const isFreehand = tool === 'pen' || tool === 'pencil' || tool === 'highlighter';
        this.fabricCanvas.isDrawingMode = isFreehand;
        this.fabricCanvas.selection = tool === 'select';
        if (isFreehand && this.fabricCanvas.freeDrawingBrush) {
          this.fabricCanvas.freeDrawingBrush.color = this.strokeProperties.color;
          this.fabricCanvas.freeDrawingBrush.width = this.strokeProperties.width;
        }
      } catch {}
    }
  }

  public getActiveTool(): WhiteboardToolType {
    return this.activeTool;
  }

  public setStrokeProperties(props: Partial<StrokeProperties>): void {
    if (!props || typeof props !== 'object') return;
    this.strokeProperties = {
      ...this.strokeProperties,
      ...props,
      width: typeof props.width === 'number' ? Math.max(1, props.width) : this.strokeProperties.width,
      opacity: typeof props.opacity === 'number'
        ? Math.max(0, Math.min(1, props.opacity))
        : this.strokeProperties.opacity,
    };
  }

  public getStrokeProperties(): StrokeProperties {
    return { ...this.strokeProperties };
  }

  // ==========================================
  // Background Image Management
  // ==========================================

  public async setBackgroundImage(dataUrl: string): Promise<void> {
    this.backgroundImage = {
      id: 'background-worksheet-image',
      type: 'image',
      src: dataUrl,
      left: 0,
      top: 0,
      width: this.virtualWidth,
      height: this.virtualHeight,
      selectable: false,
      evented: false,
      lockMovementX: true,
      lockMovementY: true,
      hasControls: false,
      hasBorders: false,
    };

    if (this.fabricCanvas && typeof this.fabricCanvas.setBackgroundImage === 'function') {
      try {
        await new Promise<void>((resolve) => {
          this.fabricCanvas.setBackgroundImage(
            dataUrl,
            () => {
              if (this.fabricCanvas.renderAll) this.fabricCanvas.renderAll();
              resolve();
            },
            { selectable: false, evented: false }
          );
        });
        return;
      } catch {
        // Fallback for headless environments
      }
    }

    return Promise.resolve();
  }

  public clearBackgroundImage(): void {
    this.backgroundImage = null;
    if (this.fabricCanvas) {
      try {
        this.fabricCanvas.backgroundImage = null;
        if (this.fabricCanvas.renderAll) this.fabricCanvas.renderAll();
      } catch {}
    }
  }

  public getBackgroundImage(): any | null {
    return this.backgroundImage ? deepClone(this.backgroundImage) : null;
  }

  // ==========================================
  // Canvas Clearing & Lifecycle
  // ==========================================

  public clearCurrentPage(keepBackground: boolean = false): void {
    const removedIds = this.objects.map((o) => o.id);
    this.objects = [];
    this.selectedObjectIds.clear();

    if (!keepBackground) {
      this.clearBackgroundImage();
    }

    for (const id of removedIds) {
      this.notifyObjectRemoved(id);
    }

    if (this.fabricCanvas) {
      try {
        if (typeof this.fabricCanvas.clear === 'function') {
          this.fabricCanvas.clear();
        }
      } catch {}
    }
  }

  // ==========================================
  // Serialization (Fabric.js v6 JSON Spec)
  // ==========================================

  public exportJson(): any {
    return {
      version: '6.0',
      objects: deepClone(this.objects),
      backgroundImage: this.backgroundImage ? deepClone(this.backgroundImage) : null,
      virtualWidth: this.virtualWidth,
      virtualHeight: this.virtualHeight,
    };
  }

  public async loadJson(json: any): Promise<void> {
    if (!json || typeof json !== 'object') {
      throw new Error('Invalid JSON provided to loadJson');
    }

    // Replace objects cleanly
    this.objects = Array.isArray(json.objects) ? deepClone(json.objects) : [];
    this.selectedObjectIds.clear();

    if (json.backgroundImage) {
      this.backgroundImage = deepClone(json.backgroundImage);
      this.backgroundImage.selectable = false;
      this.backgroundImage.evented = false;
    } else {
      this.backgroundImage = null;
    }

    if (typeof json.virtualWidth === 'number' && json.virtualWidth > 0) {
      this.virtualWidth = json.virtualWidth;
    }
    if (typeof json.virtualHeight === 'number' && json.virtualHeight > 0) {
      this.virtualHeight = json.virtualHeight;
    }

    return Promise.resolve();
  }

  // ==========================================
  // Vector Shape Generation
  // ==========================================

  public addShape(
    type: 'rect' | 'circle' | 'triangle' | 'line' | 'arrow',
    options?: any
  ): any {
    let shape: any;
    const id = options?.id || generateObjectId();

    switch (type) {
      case 'rect': {
        shape = {
          id,
          type: 'rect',
          left: options?.left ?? 100,
          top: options?.top ?? 100,
          width: options?.width ?? 200,
          height: options?.height ?? 150,
          fill: options?.fill ?? this.strokeProperties.fill ?? 'transparent',
          stroke: options?.stroke ?? this.strokeProperties.color,
          strokeWidth: options?.strokeWidth ?? this.strokeProperties.width,
          opacity: options?.opacity ?? this.strokeProperties.opacity ?? 1.0,
          rx: options?.rx ?? 0,
          ry: options?.ry ?? 0,
          selectable: options?.selectable ?? true,
          evented: options?.evented ?? true,
          createdAt: options?.createdAt ?? Date.now(),
          createdBy: options?.createdBy,
          ...options,
        };
        break;
      }
      case 'circle': {
        const radius = options?.radius ?? (options?.width ? options.width / 2 : 75);
        shape = {
          id,
          type: 'circle',
          left: options?.left ?? 100,
          top: options?.top ?? 100,
          radius,
          width: radius * 2,
          height: radius * 2,
          fill: options?.fill ?? this.strokeProperties.fill ?? 'transparent',
          stroke: options?.stroke ?? this.strokeProperties.color,
          strokeWidth: options?.strokeWidth ?? this.strokeProperties.width,
          opacity: options?.opacity ?? this.strokeProperties.opacity ?? 1.0,
          selectable: options?.selectable ?? true,
          evented: options?.evented ?? true,
          createdAt: options?.createdAt ?? Date.now(),
          createdBy: options?.createdBy,
          ...options,
        };
        break;
      }
      case 'triangle': {
        shape = {
          id,
          type: 'triangle',
          left: options?.left ?? 100,
          top: options?.top ?? 100,
          width: options?.width ?? 150,
          height: options?.height ?? 150,
          fill: options?.fill ?? this.strokeProperties.fill ?? 'transparent',
          stroke: options?.stroke ?? this.strokeProperties.color,
          strokeWidth: options?.strokeWidth ?? this.strokeProperties.width,
          opacity: options?.opacity ?? this.strokeProperties.opacity ?? 1.0,
          selectable: options?.selectable ?? true,
          evented: options?.evented ?? true,
          createdAt: options?.createdAt ?? Date.now(),
          createdBy: options?.createdBy,
          ...options,
        };
        break;
      }
      case 'line': {
        const x1 = options?.x1 ?? 100;
        const y1 = options?.y1 ?? 100;
        const x2 = options?.x2 ?? 300;
        const y2 = options?.y2 ?? 100;
        shape = {
          id,
          type: 'line',
          x1,
          y1,
          x2,
          y2,
          left: Math.min(x1, x2),
          top: Math.min(y1, y2),
          width: Math.abs(x2 - x1) || 1,
          height: Math.abs(y2 - y1) || 1,
          fill: options?.fill ?? 'transparent',
          stroke: options?.stroke ?? this.strokeProperties.color,
          strokeWidth: options?.strokeWidth ?? this.strokeProperties.width,
          opacity: options?.opacity ?? this.strokeProperties.opacity ?? 1.0,
          selectable: options?.selectable ?? true,
          evented: options?.evented ?? true,
          createdAt: options?.createdAt ?? Date.now(),
          createdBy: options?.createdBy,
          ...options,
        };
        break;
      }
      case 'arrow': {
        const x1 = options?.x1 ?? 100;
        const y1 = options?.y1 ?? 100;
        const x2 = options?.x2 ?? 300;
        const y2 = options?.y2 ?? 100;
        shape = {
          id,
          type: 'arrow',
          x1,
          y1,
          x2,
          y2,
          headLength: options?.headLength ?? 20,
          headAngle: options?.headAngle ?? 30,
          left: Math.min(x1, x2),
          top: Math.min(y1, y2),
          width: Math.abs(x2 - x1) || 1,
          height: Math.abs(y2 - y1) || 1,
          fill: options?.fill ?? this.strokeProperties.color,
          stroke: options?.stroke ?? this.strokeProperties.color,
          strokeWidth: options?.strokeWidth ?? this.strokeProperties.width,
          opacity: options?.opacity ?? this.strokeProperties.opacity ?? 1.0,
          selectable: options?.selectable ?? true,
          evented: options?.evented ?? true,
          createdAt: options?.createdAt ?? Date.now(),
          createdBy: options?.createdBy,
          ...options,
        };
        break;
      }
      default:
        throw new Error(`Unsupported shape type: ${type}`);
    }

    this.objects.push(shape);
    this.notifyObjectAdded(shape);
    return shape;
  }

  // ==========================================
  // Text & Sticky Notes
  // ==========================================

  public addText(text?: string, options?: any): any {
    const id = options?.id || generateObjectId();
    const content = text ?? options?.text ?? 'Text';

    const textObj = {
      id,
      type: 'text',
      text: content,
      left: options?.left ?? 100,
      top: options?.top ?? 100,
      fontSize: options?.fontSize ?? this.strokeProperties.fontSize ?? 24,
      fontFamily: options?.fontFamily ?? this.strokeProperties.fontFamily ?? 'Inter, system-ui, sans-serif',
      fill: options?.fill ?? options?.color ?? this.strokeProperties.color ?? '#000000',
      stroke: options?.stroke ?? null,
      strokeWidth: options?.strokeWidth ?? 0,
      opacity: options?.opacity ?? this.strokeProperties.opacity ?? 1.0,
      selectable: options?.selectable ?? true,
      evented: options?.evented ?? true,
      createdAt: options?.createdAt ?? Date.now(),
      createdBy: options?.createdBy,
      ...options,
    };

    this.objects.push(textObj);
    this.notifyObjectAdded(textObj);
    return textObj;
  }

  public addStickyNote(text?: string, color?: string, options?: any): any {
    const id = options?.id || generateObjectId();
    const content = text ?? options?.text ?? '';
    const noteColor = color ?? options?.color ?? DEFAULT_STICKY_COLOR;

    const stickyObj = {
      id,
      type: 'sticky',
      text: content,
      color: noteColor,
      fill: noteColor,
      left: options?.left ?? 150,
      top: options?.top ?? 150,
      width: options?.width ?? DEFAULT_STICKY_WIDTH,
      height: options?.height ?? DEFAULT_STICKY_HEIGHT,
      rx: options?.rx ?? 8,
      ry: options?.ry ?? 8,
      stroke: options?.stroke ?? '#E2E8F0',
      strokeWidth: options?.strokeWidth ?? 1,
      fontSize: options?.fontSize ?? 18,
      fontFamily: options?.fontFamily ?? this.strokeProperties.fontFamily ?? 'Inter, system-ui, sans-serif',
      textColor: options?.textColor ?? '#1E293B',
      opacity: options?.opacity ?? 1.0,
      selectable: options?.selectable ?? true,
      evented: options?.evented ?? true,
      createdAt: options?.createdAt ?? Date.now(),
      createdBy: options?.createdBy,
      ...options,
    };

    this.objects.push(stickyObj);
    this.notifyObjectAdded(stickyObj);
    return stickyObj;
  }

  // ==========================================
  // Freehand Drawing (Pen, Pencil, Highlighter)
  // ==========================================

  public addFreehandPath(points: Array<{ x: number; y: number }>, options?: any): any {
    if (!points || points.length === 0) return null;
    const tool = options?.tool ?? this.activeTool;
    const isHighlighter = tool === 'highlighter';
    const defaultOpacity = isHighlighter ? DEFAULT_HIGHLIGHTER_OPACITY : 1.0;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    for (const p of points) {
      if (p.x < minX) minX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.x > maxX) maxX = p.x;
      if (p.y > maxY) maxY = p.y;
    }

    const pathObj = {
      id: options?.id || generateObjectId(),
      type: 'path',
      path: pointsToSvgPath(points),
      points: deepClone(points),
      left: minX,
      top: minY,
      width: Math.max(1, maxX - minX),
      height: Math.max(1, maxY - minY),
      stroke: options?.stroke ?? this.strokeProperties.color,
      strokeWidth: options?.strokeWidth ?? (isHighlighter ? Math.max(20, this.strokeProperties.width) : this.strokeProperties.width),
      opacity: options?.opacity ?? this.strokeProperties.opacity ?? defaultOpacity,
      fill: null,
      strokeLineCap: 'round',
      strokeLineJoin: 'round',
      tool,
      selectable: options?.selectable ?? true,
      evented: options?.evented ?? true,
      createdAt: options?.createdAt ?? Date.now(),
      createdBy: options?.createdBy,
      ...options,
    };

    this.objects.push(pathObj);
    this.notifyObjectAdded(pathObj);
    return pathObj;
  }

  // ==========================================
  // Selection & Object Mutation
  // ==========================================

  public selectObject(idOrObj: string | any): void {
    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj?.id;
    if (!id) return;
    const obj = this.getObjectById(id);
    if (obj) {
      this.selectedObjectIds.add(id);
      obj.selected = true;
    }
  }

  public deselectAll(): void {
    for (const obj of this.objects) {
      obj.selected = false;
    }
    this.selectedObjectIds.clear();
  }

  public getSelectedObjects(): any[] {
    return this.objects.filter((obj) => this.selectedObjectIds.has(obj.id));
  }

  public deleteSelectedObjects(): boolean {
    if (this.selectedObjectIds.size === 0) {
      return false;
    }
    const toDelete = Array.from(this.selectedObjectIds);
    this.objects = this.objects.filter((obj) => !this.selectedObjectIds.has(obj.id));
    this.selectedObjectIds.clear();

    for (const id of toDelete) {
      this.notifyObjectRemoved(id);
    }
    return true;
  }

  public getObjects(): any[] {
    return [...this.objects];
  }

  public getObjectById(id: string): any | undefined {
    return this.objects.find((o) => o.id === id);
  }

  public addObject(obj: any): any {
    if (!obj) return null;
    const cloned = deepClone(obj);
    if (!cloned.id) {
      cloned.id = generateObjectId();
    }
    const existingIndex = this.objects.findIndex((o) => o.id === cloned.id);
    if (existingIndex >= 0) {
      this.objects[existingIndex] = cloned;
    } else {
      this.objects.push(cloned);
    }
    this.notifyObjectAdded(cloned);
    return cloned;
  }

  public removeObject(idOrObj: string | any): boolean {
    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj?.id;
    if (!id) return false;
    const initialLen = this.objects.length;
    this.objects = this.objects.filter((o) => o.id !== id);
    this.selectedObjectIds.delete(id);
    if (this.objects.length < initialLen) {
      this.notifyObjectRemoved(id);
      return true;
    }
    return false;
  }

  public modifyObject(objId: string, updates: any): any {
    const index = this.objects.findIndex((o) => o.id === objId);
    if (index === -1) return null;
    this.objects[index] = {
      ...this.objects[index],
      ...updates,
      id: objId,
    };
    const updated = this.objects[index];
    this.notifyObjectModified(updated);
    return updated;
  }

  // ==========================================
  // Laser Pointer Engine
  // ==========================================

  public onLaserMove(callback: (point: { x: number; y: number }) => void): () => void {
    this.laserMoveCallbacks.push(callback);
    return () => {
      this.laserMoveCallbacks = this.laserMoveCallbacks.filter((cb) => cb !== callback);
    };
  }

  public emitLaser(x: number, y: number): void {
    for (const cb of this.laserMoveCallbacks) {
      try {
        cb({ x, y });
      } catch (err) {
        console.error('Error in onLaserMove callback:', err);
      }
    }
  }

  // ==========================================
  // Event Subscriptions
  // ==========================================

  public onObjectAdded(callback: (obj: any) => void): void {
    this.objectAddedCallbacks.push(callback);
  }

  public onObjectModified(callback: (obj: any) => void): void {
    this.objectModifiedCallbacks.push(callback);
  }

  public onObjectRemoved(callback: (objId: string) => void): void {
    this.objectRemovedCallbacks.push(callback);
  }

  private notifyObjectAdded(obj: any): void {
    for (const cb of [...this.objectAddedCallbacks]) {
      try {
        cb(obj);
      } catch (err) {
        console.error('Error in onObjectAdded callback:', err);
      }
    }
  }

  private notifyObjectModified(obj: any): void {
    for (const cb of [...this.objectModifiedCallbacks]) {
      try {
        cb(obj);
      } catch (err) {
        console.error('Error in onObjectModified callback:', err);
      }
    }
  }

  private notifyObjectRemoved(objId: string): void {
    for (const cb of [...this.objectRemovedCallbacks]) {
      try {
        cb(objId);
      } catch (err) {
        console.error('Error in onObjectRemoved callback:', err);
      }
    }
  }

  // ==========================================
  // DOM Event Handling & Virtual Coordinate Mapping
  // ==========================================

  private attachDomEvents(canvas: HTMLCanvasElement): void {
    const handlePointerDown = (e: MouseEvent | PointerEvent) => {
      const pt = this.getEventVirtualPoint(e, canvas);
      if (!pt) return;

      if (this.activeTool === 'laser') {
        this.emitLaser(pt.x, pt.y);
        return;
      }

      if (this.activeTool === 'eraser') {
        this.eraseAtPoint(pt);
        return;
      }

      if (this.activeTool === 'select') {
        const hit = this.hitTest(pt);
        this.deselectAll();
        if (hit) {
          this.selectObject(hit);
        }
        return;
      }

      if (this.activeTool === 'pen' || this.activeTool === 'pencil' || this.activeTool === 'highlighter') {
        this.isDrawing = true;
        this.currentStrokePoints = [pt];
      }
    };

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      const pt = this.getEventVirtualPoint(e, canvas);
      if (!pt) return;

      if (this.activeTool === 'laser') {
        this.emitLaser(pt.x, pt.y);
        return;
      }

      if (this.activeTool === 'eraser' && (e.buttons === 1 || this.isDrawing)) {
        this.eraseAtPoint(pt);
        return;
      }

      if (this.isDrawing) {
        this.currentStrokePoints.push(pt);
      }
    };

    const handlePointerUp = () => {
      if (this.isDrawing && this.currentStrokePoints.length > 0) {
        this.addFreehandPath(this.currentStrokePoints);
      }
      this.isDrawing = false;
      this.currentStrokePoints = [];
    };

    canvas.addEventListener('pointerdown', handlePointerDown as EventListener);
    canvas.addEventListener('pointermove', handlePointerMove as EventListener);
    canvas.addEventListener('pointerup', handlePointerUp as EventListener);
    canvas.addEventListener('pointerleave', handlePointerUp as EventListener);

    this.domCleanupFns.push(() => {
      canvas.removeEventListener('pointerdown', handlePointerDown as EventListener);
      canvas.removeEventListener('pointermove', handlePointerMove as EventListener);
      canvas.removeEventListener('pointerup', handlePointerUp as EventListener);
      canvas.removeEventListener('pointerleave', handlePointerUp as EventListener);
    });
  }

  private getEventVirtualPoint(
    e: MouseEvent | PointerEvent,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } | null {
    try {
      const rect = typeof canvas.getBoundingClientRect === 'function'
        ? canvas.getBoundingClientRect()
        : { left: 0, top: 0, width: canvas.width || this.virtualWidth, height: canvas.height || this.virtualHeight };

      const screenX = e.clientX !== undefined ? e.clientX - rect.left : (e as any).offsetX ?? 0;
      const screenY = e.clientY !== undefined ? e.clientY - rect.top : (e as any).offsetY ?? 0;
      const containerWidth = rect.width > 0 ? rect.width : (canvas.width || this.virtualWidth);
      const containerHeight = rect.height > 0 ? rect.height : (canvas.height || this.virtualHeight);

      const transform = calculateViewportTransform(
        containerWidth,
        containerHeight,
        this.virtualWidth,
        this.virtualHeight
      );
      return screenToVirtualPoint(screenX, screenY, transform, true);
    } catch {
      return { x: 0, y: 0 };
    }
  }

  public hitTest(pt: { x: number; y: number }): any | null {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (isPointInObject(pt, obj)) {
        return obj;
      }
    }
    return null;
  }

  private eraseAtPoint(pt: { x: number; y: number }): void {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (isPointInObject(pt, obj)) {
        this.objects.splice(i, 1);
        this.selectedObjectIds.delete(obj.id);
        this.notifyObjectRemoved(obj.id);
        break;
      }
    }
  }

  // ==========================================
  // Teardown
  // ==========================================

  public destroy(): void {
    for (const cleanup of this.domCleanupFns) {
      try {
        cleanup();
      } catch {}
    }
    this.domCleanupFns = [];
    this.objectAddedCallbacks = [];
    this.objectModifiedCallbacks = [];
    this.objectRemovedCallbacks = [];
    this.laserMoveCallbacks = [];
    this.objects = [];
    this.selectedObjectIds.clear();
    this.backgroundImage = null;
    this.canvasElement = undefined;
    if (this.fabricCanvas && typeof this.fabricCanvas.dispose === 'function') {
      try {
        this.fabricCanvas.dispose();
      } catch {}
    }
  }

  public getVirtualDimensions(): { virtualWidth: number; virtualHeight: number } {
    return {
      virtualWidth: this.virtualWidth,
      virtualHeight: this.virtualHeight,
    };
  }
}
