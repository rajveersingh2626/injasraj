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

import {
  deepClone,
  generateObjectId,
  pointsToSvgPath,
  distanceToSegment,
  isPointInObject,
} from './engine/geometry';
import {
  DEFAULT_STICKY_COLOR,
  DEFAULT_STICKY_WIDTH,
  DEFAULT_STICKY_HEIGHT,
  drawVirtualGrid,
  drawPointsPath,
  renderCanvasObject,
} from './engine/shape-renderers';

export {
  deepClone,
  generateObjectId,
  pointsToSvgPath,
  distanceToSegment,
  isPointInObject,
  DEFAULT_STICKY_COLOR,
  DEFAULT_STICKY_WIDTH,
  DEFAULT_STICKY_HEIGHT,
};

export const DEFAULT_HIGHLIGHTER_OPACITY = 0.35;

export const DEFAULT_STROKE_PROPERTIES: StrokeProperties = {
  color: '#000000',
  width: 3,
  opacity: 1.0,
  fill: 'transparent',
  fontSize: 24,
  fontFamily: 'Inter, system-ui, sans-serif',
};

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
  private lockedObjectIds: Set<string> = new Set();
  private defaultRoughness: number = 0;
  private backgroundImage: any | null = null;

  // Active freehand drawing state
  private isDrawing: boolean = false;
  private currentStrokePoints: Array<{ x: number; y: number }> = [];

  // Active shape drawing state
  private isDrawingShape: boolean = false;
  private shapeStartPoint: { x: number; y: number } | null = null;
  private activeShapeType: WhiteboardToolType | null = null;
  private currentShapePreview: {
    type: WhiteboardToolType;
    start: { x: number; y: number };
    current: { x: number; y: number };
  } | null = null;

  // Object dragging and resizing state in 'select' mode
  private isDraggingObject: boolean = false;
  private dragHandleType: 'nw' | 'ne' | 'se' | 'sw' | 'move' | null = null;
  private dragStartPoint: { x: number; y: number } | null = null;
  private dragInitialBounds: { left: number; top: number; width: number; height: number } | null = null;
  private draggedObject: any | null = null;

  // 2D Rendering Engine State
  private renderRequested: boolean = false;
  private animFrameId: any = null;
  private gridType: 'none' | 'dots' | 'lines' | 'grid' = 'none';
  private cachedBgImageElement: HTMLImageElement | null = null;
  private cachedBgImageSrc: string | null = null;

  // Callbacks
  private objectAddedCallbacks: Array<(obj: any) => void> = [];
  private objectModifiedCallbacks: Array<(obj: any) => void> = [];
  private objectRemovedCallbacks: Array<(objId: string) => void> = [];
  private laserMoveCallbacks: Array<(point: { x: number; y: number }) => void> = [];
  private lastRemovedObject: any | null = null;

  // DOM listener teardown functions
  private domCleanupFns: Array<() => void> = [];
  private cachedCanvasRect: DOMRect | { left: number; top: number; width: number; height: number } | null = null;

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
      this.requestRender();
    }
  }

  public attachCanvas(canvasElement: HTMLCanvasElement): void {
    if (this.canvasElement === canvasElement) return;
    this.canvasElement = canvasElement;
    try {
      canvasElement.width = this.virtualWidth;
      canvasElement.height = this.virtualHeight;
    } catch {}
    this.attachDomEvents(canvasElement);
    this.requestRender();
  }

  public resize(width?: number, height?: number): void {
    if (this.canvasElement) {
      if (width && width > 0) this.canvasElement.width = width;
      if (height && height > 0) this.canvasElement.height = height;
    }
    this.requestRender();
  }

  public setGridType(grid: 'none' | 'dots' | 'lines' | 'grid'): void {
    this.gridType = grid;
    this.requestRender();
  }

  public getGridType(): 'none' | 'dots' | 'lines' | 'grid' {
    return this.gridType;
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

    this.requestRender();
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
    this.requestRender();
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

    if (typeof Image !== 'undefined') {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.cachedBgImageElement = img;
          this.cachedBgImageSrc = dataUrl;
          this.requestRender();
        };
        img.src = dataUrl;
        if (img.complete && img.naturalWidth > 0) {
          this.cachedBgImageElement = img;
          this.cachedBgImageSrc = dataUrl;
        }
      } catch {}
    }

    this.requestRender();

    if (this.fabricCanvas && typeof this.fabricCanvas.setBackgroundImage === 'function') {
      try {
        await Promise.race([
          new Promise<void>((resolve) => {
            this.fabricCanvas.setBackgroundImage(
              dataUrl,
              () => {
                if (this.fabricCanvas.renderAll) this.fabricCanvas.renderAll();
                resolve();
              },
              { selectable: false, evented: false }
            );
          }),
          new Promise<void>((resolve) => setTimeout(resolve, 300)),
        ]);
        return;
      } catch {
        // Fallback for headless environments
      }
    }

    return Promise.resolve();
  }

  public clearBackgroundImage(): void {
    this.backgroundImage = null;
    this.cachedBgImageElement = null;
    this.cachedBgImageSrc = null;
    this.requestRender();
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

    this.requestRender();

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

  public exportDataUrl(type: string = 'image/png', quality: number = 0.92): string | null {
    if (!this.canvasElement) return null;
    try {
      return this.canvasElement.toDataURL(type, quality);
    } catch {
      return null;
    }
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
      if (this.backgroundImage.src && typeof Image !== 'undefined') {
        try {
          const src = this.backgroundImage.src;
          const img = new Image();
          img.crossOrigin = 'anonymous';
          img.onload = () => {
            this.cachedBgImageElement = img;
            this.cachedBgImageSrc = src;
            this.requestRender();
          };
          img.src = src;
          if (img.complete && img.naturalWidth > 0) {
            this.cachedBgImageElement = img;
            this.cachedBgImageSrc = src;
          }
        } catch {}
      }
    } else {
      this.backgroundImage = null;
      this.cachedBgImageElement = null;
      this.cachedBgImageSrc = null;
    }

    if (typeof json.virtualWidth === 'number' && json.virtualWidth > 0) {
      this.virtualWidth = json.virtualWidth;
    }
    if (typeof json.virtualHeight === 'number' && json.virtualHeight > 0) {
      this.virtualHeight = json.virtualHeight;
    }

    this.requestRender();
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
    this.requestRender();
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
    this.requestRender();
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
    this.requestRender();
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
    this.requestRender();
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
      this.requestRender();
    }
  }

  public deselectAll(): void {
    for (const obj of this.objects) {
      obj.selected = false;
    }
    this.selectedObjectIds.clear();
    this.requestRender();
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
    this.requestRender();
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
    if (cloned.roughness === undefined && this.defaultRoughness > 0) {
      cloned.roughness = this.defaultRoughness;
    }
    const existingIndex = this.objects.findIndex((o) => o.id === cloned.id);
    if (existingIndex >= 0) {
      this.objects[existingIndex] = cloned;
    } else {
      this.objects.push(cloned);
    }
    this.notifyObjectAdded(cloned);
    this.requestRender();
    return cloned;
  }

  public addMathFormula(latex: string, svgDataUrl: string, options?: any): any {
    const formulaObj = {
      id: generateObjectId(),
      type: 'formula',
      latex,
      src: svgDataUrl,
      left: options?.left ?? 400,
      top: options?.top ?? 300,
      width: options?.width ?? 420,
      height: options?.height ?? 120,
      selectable: true,
      ...options,
    };
    return this.addObject(formulaObj);
  }

  public addImageObject(
    src: string,
    options?: {
      left?: number;
      top?: number;
      width?: number;
      height?: number;
      id?: string;
      [key: string]: any;
    }
  ): any {
    const imgObj = {
      id: options?.id || generateObjectId(),
      type: 'image',
      src,
      left: options?.left ?? 200,
      top: options?.top ?? 150,
      width: options?.width ?? 400,
      height: options?.height ?? 300,
      selectable: options?.selectable ?? true,
      evented: options?.evented ?? true,
      _onLoad: () => this.requestRender(),
      ...options,
    };
    return this.addObject(imgObj);
  }

  public removeObject(idOrObj: string | any): boolean {
    const id = typeof idOrObj === 'string' ? idOrObj : idOrObj?.id;
    if (!id) return false;
    if (this.isObjectLocked(id)) return false;
    const targetObj = this.objects.find((o) => o.id === id);
    this.lastRemovedObject = targetObj ? deepClone(targetObj) : null;
    const initialLen = this.objects.length;
    this.objects = this.objects.filter((o) => o.id !== id);
    this.selectedObjectIds.delete(id);
    if (this.objects.length < initialLen) {
      this.notifyObjectRemoved(id);
      this.requestRender();
      return true;
    }
    return false;
  }

  public getLastRemovedObject(): any | null {
    return this.lastRemovedObject;
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
    this.updateBoundArrows(objId, updated);
    this.notifyObjectModified(updated);
    this.requestRender();
    return updated;
  }

  public getShapeAnchorPoint(
    shape: any,
    side: 'top' | 'bottom' | 'left' | 'right'
  ): { x: number; y: number } {
    const left = shape.left ?? 0;
    const top = shape.top ?? 0;
    const width = shape.width ?? 100;
    const height = shape.height ?? 100;

    if (shape.type === 'circle') {
      const radius = shape.radius ?? (shape.width ? shape.width / 2 : 50);
      const cx = left + radius;
      const cy = top + radius;
      switch (side) {
        case 'left': return { x: cx - radius, y: cy };
        case 'right': return { x: cx + radius, y: cy };
        case 'top': return { x: cx, y: cy - radius };
        case 'bottom': return { x: cx, y: cy + radius };
      }
    }

    switch (side) {
      case 'left':
        return { x: left, y: top + height / 2 };
      case 'right':
        return { x: left + width, y: top + height / 2 };
      case 'top':
        return { x: left + width / 2, y: top };
      case 'bottom':
        return { x: left + width / 2, y: top + height };
    }
  }

  public bindArrowToShape(
    arrowId: string,
    shapeId: string,
    end: 'start' | 'end',
    side: 'top' | 'bottom' | 'left' | 'right' = 'left'
  ): any {
    const arrow = this.getObjectById(arrowId);
    const shape = this.getObjectById(shapeId);
    if (!arrow || !shape) return null;

    const anchor = this.getShapeAnchorPoint(shape, side);
    if (end === 'start') {
      arrow.startBinding = { targetId: shapeId, side };
      arrow.x1 = anchor.x;
      arrow.y1 = anchor.y;
    } else {
      arrow.endBinding = { targetId: shapeId, side };
      arrow.x2 = anchor.x;
      arrow.y2 = anchor.y;
    }

    this.notifyObjectModified(arrow);
    this.requestRender();
    return arrow;
  }

  public updateBoundArrows(shapeId: string, shapeObj?: any): void {
    const shape = shapeObj || this.getObjectById(shapeId);
    if (!shape) return;

    for (const obj of this.objects) {
      if (obj.type === 'arrow' || obj.type === 'line') {
        let modified = false;
        if (obj.startBinding && obj.startBinding.targetId === shapeId) {
          const pt = this.getShapeAnchorPoint(shape, obj.startBinding.side);
          obj.x1 = pt.x;
          obj.y1 = pt.y;
          modified = true;
        }
        if (obj.endBinding && obj.endBinding.targetId === shapeId) {
          const pt = this.getShapeAnchorPoint(shape, obj.endBinding.side);
          obj.x2 = pt.x;
          obj.y2 = pt.y;
          modified = true;
        }
        if (modified) {
          this.notifyObjectModified(obj);
        }
      }
    }
  }

  public updateShapeText(shapeId: string, text: string): any {
    return this.modifyObject(shapeId, { text });
  }

  // ==========================================
  // Excalidraw Suite: Roughness, Lock, Marquee, Z-Order
  // ==========================================

  public setDefaultRoughness(r: number): void {
    this.defaultRoughness = r;
  }

  public getDefaultRoughness(): number {
    return this.defaultRoughness;
  }

  public selectObjectsInBounds(bounds: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  }): any[] {
    const matched: any[] = [];
    this.selectedObjectIds.clear();

    for (const obj of this.objects) {
      const left = obj.left ?? obj.x1 ?? 0;
      const top = obj.top ?? obj.y1 ?? 0;
      const width =
        obj.width ??
        (obj.radius
          ? obj.radius * 2
          : obj.x2 !== undefined
          ? Math.abs(obj.x2 - obj.x1)
          : 100);
      const height =
        obj.height ??
        (obj.radius
          ? obj.radius * 2
          : obj.y2 !== undefined
          ? Math.abs(obj.y2 - obj.y1)
          : 100);

      const cx = left + width / 2;
      const cy = top + height / 2;

      if (
        cx >= bounds.minX &&
        cx <= bounds.maxX &&
        cy >= bounds.minY &&
        cy <= bounds.maxY
      ) {
        matched.push(obj);
        this.selectedObjectIds.add(obj.id);
      }
    }
    this.requestRender();
    return matched;
  }

  public getSelectedObjectIds(): Set<string> {
    return this.selectedObjectIds;
  }

  public lockObject(id: string): void {
    this.lockedObjectIds.add(id);
    const obj = this.getObjectById(id);
    if (obj) obj.locked = true;
    this.requestRender();
  }

  public unlockObject(id: string): void {
    this.lockedObjectIds.delete(id);
    const obj = this.getObjectById(id);
    if (obj) obj.locked = false;
    this.requestRender();
  }

  public isObjectLocked(id: string): boolean {
    return this.lockedObjectIds.has(id) || Boolean(this.getObjectById(id)?.locked);
  }

  public bringForward(id: string): boolean {
    const idx = this.objects.findIndex((o) => o.id === id);
    if (idx === -1 || idx >= this.objects.length - 1) return false;
    const temp = this.objects[idx];
    this.objects[idx] = this.objects[idx + 1];
    this.objects[idx + 1] = temp;
    this.notifyObjectModified(this.objects[idx + 1]);
    this.requestRender();
    return true;
  }

  public sendBackward(id: string): boolean {
    const idx = this.objects.findIndex((o) => o.id === id);
    if (idx <= 0) return false;
    const temp = this.objects[idx];
    this.objects[idx] = this.objects[idx - 1];
    this.objects[idx - 1] = temp;
    this.notifyObjectModified(this.objects[idx - 1]);
    this.requestRender();
    return true;
  }

  public bringToFront(id: string): boolean {
    const idx = this.objects.findIndex((o) => o.id === id);
    if (idx === -1 || idx === this.objects.length - 1) return false;
    const [obj] = this.objects.splice(idx, 1);
    this.objects.push(obj);
    this.notifyObjectModified(obj);
    this.requestRender();
    return true;
  }

  public sendToBack(id: string): boolean {
    const idx = this.objects.findIndex((o) => o.id === id);
    if (idx <= 0) return false;
    const [obj] = this.objects.splice(idx, 1);
    this.objects.unshift(obj);
    this.notifyObjectModified(obj);
    this.requestRender();
    return true;
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
      try {
        if ('pointerId' in e && typeof canvas.setPointerCapture === 'function') {
          canvas.setPointerCapture(e.pointerId);
        }
      } catch {}

      this.cachedCanvasRect = typeof canvas.getBoundingClientRect === 'function' ? canvas.getBoundingClientRect() : null;

      const pt = this.getEventVirtualPoint(e, canvas);
      if (!pt) return;

      if (this.activeTool === 'pan') {
        return;
      }

      if (this.activeTool === 'laser') {
        this.emitLaser(pt.x, pt.y);
        return;
      }

      if (this.activeTool === 'eraser') {
        this.eraseAtPoint(pt);
        return;
      }

      if (this.activeTool === 'select') {
        const selectedList = this.getSelectedObjects();
        let targetHandle: 'nw' | 'ne' | 'se' | 'sw' | 'move' | null = null;
        let targetObj: any = null;

        for (const sel of selectedList) {
          const handle = this.getSelectionHandleAt(pt, sel);
          if (handle) {
            targetHandle = handle;
            targetObj = sel;
            break;
          }
        }

        if (targetHandle && targetObj) {
          this.isDraggingObject = true;
          this.dragHandleType = targetHandle;
          this.dragStartPoint = pt;
          this.draggedObject = targetObj;
          this.dragInitialBounds = {
            left: targetObj.left ?? 0,
            top: targetObj.top ?? 0,
            width: targetObj.type === 'circle' ? (targetObj.radius ?? 50) * 2 : (targetObj.width ?? 100),
            height: targetObj.type === 'circle' ? (targetObj.radius ?? 50) * 2 : (targetObj.height ?? 100),
          };
          return;
        }

        const hit = this.hitTest(pt);
        this.deselectAll();
        if (hit) {
          this.selectObject(hit);
          this.isDraggingObject = true;
          this.dragHandleType = 'move';
          this.dragStartPoint = pt;
          this.draggedObject = hit;
          this.dragInitialBounds = {
            left: hit.left ?? 0,
            top: hit.top ?? 0,
            width: hit.type === 'circle' ? (hit.radius ?? 50) * 2 : (hit.width ?? 100),
            height: hit.type === 'circle' ? (hit.radius ?? 50) * 2 : (hit.height ?? 100),
          };
        }
        return;
      }

      if (this.activeTool === 'text') {
        this.addText('Text', { left: pt.x, top: pt.y });
        return;
      }

      if (this.activeTool === 'sticky') {
        this.addStickyNote('Note', undefined, { left: pt.x, top: pt.y });
        return;
      }

      if (
        this.activeTool === 'rect' ||
        this.activeTool === 'circle' ||
        this.activeTool === 'triangle' ||
        this.activeTool === 'line' ||
        this.activeTool === 'arrow'
      ) {
        this.shapeStartPoint = pt;
        this.activeShapeType = this.activeTool;
        this.isDrawingShape = true;
        this.currentShapePreview = {
          type: this.activeTool,
          start: pt,
          current: pt,
        };
        this.requestRender();
        return;
      }

      if (this.activeTool === 'pen' || this.activeTool === 'pencil' || this.activeTool === 'highlighter') {
        this.isDrawing = true;
        this.currentStrokePoints = [pt];
        this.requestRender();
      }
    };

    const handlePointerMove = (e: MouseEvent | PointerEvent) => {
      const pt = this.getEventVirtualPoint(e, canvas);
      if (!pt) return;

      if (this.activeTool === 'pan') {
        return;
      }

      if (this.activeTool === 'laser') {
        this.emitLaser(pt.x, pt.y);
        return;
      }

      if (this.isDraggingObject && this.draggedObject && this.dragStartPoint && this.dragInitialBounds) {
        const dx = pt.x - this.dragStartPoint.x;
        const dy = pt.y - this.dragStartPoint.y;
        const init = this.dragInitialBounds;
        const obj = this.draggedObject;

        if (this.dragHandleType === 'move') {
          obj.left = Math.round(init.left + dx);
          obj.top = Math.round(init.top + dy);
        } else if (this.dragHandleType === 'se') {
          const nw = Math.max(20, Math.round(init.width + dx));
          const nh = Math.max(20, Math.round(init.height + dy));
          obj.width = nw;
          obj.height = nh;
          if (obj.type === 'circle') {
            obj.radius = Math.round(Math.max(nw, nh) / 2);
          }
        } else if (this.dragHandleType === 'sw') {
          const nw = Math.max(20, Math.round(init.width - dx));
          const nh = Math.max(20, Math.round(init.height + dy));
          obj.left = Math.round(init.left + (init.width - nw));
          obj.width = nw;
          obj.height = nh;
          if (obj.type === 'circle') {
            obj.radius = Math.round(Math.max(nw, nh) / 2);
          }
        } else if (this.dragHandleType === 'ne') {
          const nw = Math.max(20, Math.round(init.width + dx));
          const nh = Math.max(20, Math.round(init.height - dy));
          obj.top = Math.round(init.top + (init.height - nh));
          obj.width = nw;
          obj.height = nh;
          if (obj.type === 'circle') {
            obj.radius = Math.round(Math.max(nw, nh) / 2);
          }
        } else if (this.dragHandleType === 'nw') {
          const nw = Math.max(20, Math.round(init.width - dx));
          const nh = Math.max(20, Math.round(init.height - dy));
          obj.left = Math.round(init.left + (init.width - nw));
          obj.top = Math.round(init.top + (init.height - nh));
          obj.width = nw;
          obj.height = nh;
          if (obj.type === 'circle') {
            obj.radius = Math.round(Math.max(nw, nh) / 2);
          }
        }
        this.requestRender();
        return;
      }

      if (this.activeTool === 'eraser' && (e.buttons === 1 || this.isDrawing)) {
        this.eraseAtPoint(pt);
        return;
      }

      if (this.isDrawingShape && this.currentShapePreview && this.activeShapeType) {
        this.currentShapePreview = {
          type: this.activeShapeType,
          start: this.currentShapePreview.start,
          current: pt,
        };
        this.requestRender();
        return;
      }

      if (this.isDrawing) {
        this.currentStrokePoints.push(pt);
        this.requestRender();
      }
    };

    const handlePointerUp = (e?: MouseEvent | PointerEvent) => {
      if (this.isDraggingObject && this.draggedObject) {
        this.notifyObjectModified(this.draggedObject);
        this.isDraggingObject = false;
        this.dragHandleType = null;
        this.dragStartPoint = null;
        this.dragInitialBounds = null;
        this.draggedObject = null;
        this.requestRender();
        return;
      }
      if (this.isDrawingShape && this.shapeStartPoint && this.activeShapeType) {
        const pt = (e ? this.getEventVirtualPoint(e, canvas) : null) || this.currentShapePreview?.current || this.shapeStartPoint;
        const start = this.shapeStartPoint;
        const isClick = Math.abs(pt.x - start.x) < 5 && Math.abs(pt.y - start.y) < 5;
        const width = isClick ? 150 : Math.max(1, Math.abs(pt.x - start.x));
        const height = isClick ? 100 : Math.max(1, Math.abs(pt.y - start.y));
        const left = isClick ? start.x : Math.min(start.x, pt.x);
        const top = isClick ? start.y : Math.min(start.y, pt.y);
        const x1 = start.x;
        const y1 = start.y;
        const x2 = isClick ? start.x + 150 : pt.x;
        const y2 = isClick ? start.y : pt.y;
        const radius = this.activeShapeType === 'circle' ? (isClick ? 50 : Math.max(width, height) / 2) : undefined;

        this.addShape(this.activeShapeType as any, {
          left,
          top,
          width: this.activeShapeType === 'circle' ? (radius ? radius * 2 : width) : width,
          height: this.activeShapeType === 'circle' ? (radius ? radius * 2 : height) : height,
          radius,
          x1,
          y1,
          x2,
          y2,
        });

        this.isDrawingShape = false;
        this.shapeStartPoint = null;
        this.activeShapeType = null;
        this.currentShapePreview = null;
        this.requestRender();
        return;
      }

      if (this.isDrawing && this.currentStrokePoints.length > 0) {
        this.addFreehandPath(this.currentStrokePoints);
      }
      this.isDrawing = false;
      this.currentStrokePoints = [];
      this.cachedCanvasRect = null;
      this.requestRender();
    };

    canvas.addEventListener('pointerdown', handlePointerDown as EventListener);
    canvas.addEventListener('pointermove', handlePointerMove as EventListener);
    canvas.addEventListener('pointerup', handlePointerUp as EventListener);
    canvas.addEventListener('pointerleave', handlePointerUp as EventListener);

    if (typeof window !== 'undefined') {
      window.addEventListener('pointerup', handlePointerUp as EventListener);
      this.domCleanupFns.push(() => {
        window.removeEventListener('pointerup', handlePointerUp as EventListener);
      });
    }

    this.domCleanupFns.push(() => {
      canvas.removeEventListener('pointerdown', handlePointerDown as EventListener);
      canvas.removeEventListener('pointermove', handlePointerMove as EventListener);
      canvas.removeEventListener('pointerup', handlePointerUp as EventListener);
      canvas.removeEventListener('pointerleave', handlePointerUp as EventListener);
    });
  }

  private getEventVirtualPoint(
    e: MouseEvent | PointerEvent | TouchEvent,
    canvas: HTMLCanvasElement
  ): { x: number; y: number } | null {
    try {
      const rect = this.cachedCanvasRect || (typeof canvas.getBoundingClientRect === 'function'
        ? canvas.getBoundingClientRect()
        : { left: 0, top: 0, width: canvas.width || this.virtualWidth, height: canvas.height || this.virtualHeight });

      let clientX = (e as any).clientX;
      let clientY = (e as any).clientY;
      if ((clientX === undefined || isNaN(clientX)) && (e as any).touches && (e as any).touches.length > 0) {
        clientX = (e as any).touches[0].clientX;
        clientY = (e as any).touches[0].clientY;
      } else if ((clientX === undefined || isNaN(clientX)) && (e as any).changedTouches && (e as any).changedTouches.length > 0) {
        clientX = (e as any).changedTouches[0].clientX;
        clientY = (e as any).changedTouches[0].clientY;
      }

      const screenX = typeof clientX === 'number' && !isNaN(clientX) ? clientX - rect.left : (e as any).offsetX ?? 0;
      const screenY = typeof clientY === 'number' && !isNaN(clientY) ? clientY - rect.top : (e as any).offsetY ?? 0;
      const containerWidth = rect.width > 0 ? rect.width : (canvas.width || this.virtualWidth);
      const containerHeight = rect.height > 0 ? rect.height : (canvas.height || this.virtualHeight);

      const transform = calculateViewportTransform(
        containerWidth,
        containerHeight,
        this.virtualWidth,
        this.virtualHeight
      );
      // Unclamped coordinates allow drawing and panning infinitely in any direction (-∞ to +∞)
      return screenToVirtualPoint(screenX, screenY, transform, false);
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

  public getSelectionHandleAt(
    pt: { x: number; y: number },
    obj: any
  ): 'nw' | 'ne' | 'se' | 'sw' | 'move' | null {
    if (!obj) return null;
    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    const width = obj.type === 'circle' ? (obj.radius ?? 50) * 2 : (obj.width ?? 100);
    const height = obj.type === 'circle' ? (obj.radius ?? 50) * 2 : (obj.height ?? 100);
    const pad = 4;
    const handleThreshold = 14;

    const corners: Record<'nw' | 'ne' | 'sw' | 'se', { x: number; y: number }> = {
      nw: { x: left - pad, y: top - pad },
      ne: { x: left + width + pad, y: top - pad },
      sw: { x: left - pad, y: top + height + pad },
      se: { x: left + width + pad, y: top + height + pad },
    };

    for (const [corner, c] of Object.entries(corners) as ['nw' | 'ne' | 'sw' | 'se', { x: number; y: number }][]) {
      if (Math.abs(pt.x - c.x) <= handleThreshold && Math.abs(pt.y - c.y) <= handleThreshold) {
        return corner;
      }
    }

    if (isPointInObject(pt, obj, 8)) {
      return 'move';
    }

    return null;
  }

  private eraseAtPoint(pt: { x: number; y: number }): void {
    for (let i = this.objects.length - 1; i >= 0; i--) {
      const obj = this.objects[i];
      if (isPointInObject(pt, obj)) {
        this.lastRemovedObject = deepClone(obj);
        this.objects.splice(i, 1);
        this.selectedObjectIds.delete(obj.id);
        this.notifyObjectRemoved(obj.id);
        this.requestRender();
        break;
      }
    }
  }

  // ==========================================
  // HTML5 2D Canvas Visual Rendering Engine
  // ==========================================

  /**
   * Schedules a canvas redraw on the next animation frame with debouncing.
   */
  public requestRender(): void {
    if (this.renderRequested) return;
    this.renderRequested = true;

    if (typeof requestAnimationFrame !== 'undefined') {
      this.animFrameId = requestAnimationFrame(() => {
        this.renderRequested = false;
        this.animFrameId = null;
        this.render();
      });
    } else {
      this.animFrameId = setTimeout(() => {
        this.renderRequested = false;
        this.animFrameId = null;
        this.render();
      }, 16);
    }
  }

  /**
   * Synchronously paints the canonical 1920x1080 canvas scene onto the canvas context.
   * Safe to call in headless/JSDOM environments without throwing.
   */
  public render(ctx?: CanvasRenderingContext2D): void {
    let context: CanvasRenderingContext2D | null = null;
    try {
      context = ctx || (this.canvasElement?.getContext?.('2d') as CanvasRenderingContext2D | null);
    } catch {
      context = null;
    }
    if (!context) return;

    try {
      const width = this.canvasElement?.width || this.virtualWidth;
      const height = this.canvasElement?.height || this.virtualHeight;

      // Calculate viewport transform to scale & center 1920x1080 virtual canvas
      const viewport = calculateViewportTransform(
        width,
        height,
        this.virtualWidth,
        this.virtualHeight
      );

      // Clear the physical canvas bounds
      context.clearRect(0, 0, width, height);

      context.save();
      context.translate(viewport.offsetX, viewport.offsetY);
      context.scale(viewport.scale, viewport.scale);

      // 1. Draw infinite white canvas background (-∞ to +∞)
      context.fillStyle = '#FFFFFF';
      context.fillRect(-100000, -100000, 200000, 200000);

      // 2. Draw optional grid lines or dots
      this.drawVirtualGrid(context);

      // 3. Draw background image if loaded
      this.drawBackgroundImage(context);

      // 4. Render all persistent canvas objects in Z-order
      for (const obj of this.objects) {
        this.drawObject(context, obj);
      }

      // 5. Draw active freehand stroke preview if currently drawing
      if (this.isDrawing && this.currentStrokePoints.length > 0) {
        this.drawActiveStrokePreview(context);
      }

      // 5b. Draw active shape preview in real-time if currently drawing shape
      if (this.isDrawingShape && this.currentShapePreview) {
        this.drawActiveShapePreview(context);
      }

      // 6. Draw selection boundary and resize handles for selected objects
      for (const objId of this.selectedObjectIds) {
        const obj = this.getObjectById(objId);
        if (obj) {
          this.drawSelectionOutline(context, obj);
        }
      }

      context.restore();
    } catch (err) {
      // Gracefully prevent rendering glitches from breaking event handlers
      console.error('Error during canvas render:', err);
    }
  }

  private drawVirtualGrid(context: CanvasRenderingContext2D): void {
    drawVirtualGrid(context, this.gridType, this.virtualWidth, this.virtualHeight);
  }

  private drawBackgroundImage(context: CanvasRenderingContext2D): void {
    if (!this.backgroundImage || !this.backgroundImage.src) return;

    const src = this.backgroundImage.src;
    const left = this.backgroundImage.left ?? 0;
    const top = this.backgroundImage.top ?? 0;
    const width = this.backgroundImage.width ?? this.virtualWidth;
    const height = this.backgroundImage.height ?? this.virtualHeight;

    const renderWithAspect = (img: HTMLImageElement) => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const imgAspect = img.naturalWidth / img.naturalHeight;
        const canvasAspect = width / height;
        let drawW = width;
        let drawH = height;
        let drawX = left;
        let drawY = top;

        if (imgAspect < canvasAspect) {
          // Portrait / tall document: fit height, center horizontally
          drawH = height;
          drawW = Math.round(drawH * imgAspect);
          drawX = left + Math.round((width - drawW) / 2);
        } else if (imgAspect > canvasAspect * 1.05) {
          // Wider document: fit width, center vertically
          drawW = width;
          drawH = Math.round(drawW / imgAspect);
          drawY = top + Math.round((height - drawH) / 2);
        }

        if (drawX > left || drawY > top) {
          context.save();
          context.fillStyle = '#ffffff';
          context.shadowColor = 'rgba(0, 0, 0, 0.15)';
          context.shadowBlur = 16;
          context.shadowOffsetY = 4;
          context.fillRect(drawX, drawY, drawW, drawH);
          context.restore();
        }
        context.drawImage(img, drawX, drawY, drawW, drawH);
      } else {
        context.drawImage(img, left, top, width, height);
      }
    };

    if (this.cachedBgImageElement && this.cachedBgImageSrc === src) {
      try {
        renderWithAspect(this.cachedBgImageElement);
      } catch {}
      return;
    }

    if (typeof Image !== 'undefined') {
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.cachedBgImageElement = img;
          this.cachedBgImageSrc = src;
          this.requestRender();
        };
        img.src = src;
        if (img.complete && img.naturalWidth > 0) {
          this.cachedBgImageElement = img;
          this.cachedBgImageSrc = src;
          renderWithAspect(img);
        }
      } catch {}
    }
  }

  private drawObject(context: CanvasRenderingContext2D, obj: any): void {
    renderCanvasObject(context, obj);
  }

  private drawPointsPath(context: CanvasRenderingContext2D, points: Array<{ x: number; y: number }>): void {
    drawPointsPath(context, points);
  }

  private drawActiveStrokePreview(context: CanvasRenderingContext2D): void {
    if (this.currentStrokePoints.length === 0) return;
    context.save();
    const isHighlighter = this.activeTool === 'highlighter';
    context.globalAlpha = isHighlighter
      ? (this.strokeProperties.opacity ?? DEFAULT_HIGHLIGHTER_OPACITY)
      : (this.strokeProperties.opacity ?? 1.0);
    context.strokeStyle = this.strokeProperties.color;
    context.lineWidth = isHighlighter
      ? Math.max(20, this.strokeProperties.width)
      : this.strokeProperties.width;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    this.drawPointsPath(context, this.currentStrokePoints);
    context.restore();
  }

  private drawActiveShapePreview(context: CanvasRenderingContext2D): void {
    if (!this.currentShapePreview) return;
    const { type, start, current } = this.currentShapePreview;
    const left = Math.min(start.x, current.x);
    const top = Math.min(start.y, current.y);
    const width = Math.max(1, Math.abs(current.x - start.x));
    const height = Math.max(1, Math.abs(current.y - start.y));

    let previewObj: any = null;
    if (type === 'rect') {
      previewObj = {
        type: 'rect',
        left,
        top,
        width,
        height,
        fill: this.strokeProperties.fill ?? 'transparent',
        stroke: this.strokeProperties.color,
        strokeWidth: this.strokeProperties.width,
        opacity: this.strokeProperties.opacity ?? 1.0,
      };
    } else if (type === 'circle') {
      const radius = Math.max(width, height) / 2;
      previewObj = {
        type: 'circle',
        left,
        top,
        radius,
        width: radius * 2,
        height: radius * 2,
        fill: this.strokeProperties.fill ?? 'transparent',
        stroke: this.strokeProperties.color,
        strokeWidth: this.strokeProperties.width,
        opacity: this.strokeProperties.opacity ?? 1.0,
      };
    } else if (type === 'triangle') {
      previewObj = {
        type: 'triangle',
        left,
        top,
        width,
        height,
        fill: this.strokeProperties.fill ?? 'transparent',
        stroke: this.strokeProperties.color,
        strokeWidth: this.strokeProperties.width,
        opacity: this.strokeProperties.opacity ?? 1.0,
      };
    } else if (type === 'line') {
      previewObj = {
        type: 'line',
        x1: start.x,
        y1: start.y,
        x2: current.x,
        y2: current.y,
        stroke: this.strokeProperties.color,
        strokeWidth: this.strokeProperties.width,
        opacity: this.strokeProperties.opacity ?? 1.0,
      };
    } else if (type === 'arrow') {
      previewObj = {
        type: 'arrow',
        x1: start.x,
        y1: start.y,
        x2: current.x,
        y2: current.y,
        headLength: 20,
        headAngle: 30,
        fill: this.strokeProperties.color,
        stroke: this.strokeProperties.color,
        strokeWidth: this.strokeProperties.width,
        opacity: this.strokeProperties.opacity ?? 1.0,
      };
    }

    if (previewObj) {
      this.drawObject(context, previewObj);
    }
  }

  private drawSelectionOutline(context: CanvasRenderingContext2D, obj: any): void {
    const left = obj.left ?? 0;
    const top = obj.top ?? 0;
    const width = obj.type === 'circle' ? (obj.radius ?? 50) * 2 : (obj.width ?? 100);
    const height = obj.type === 'circle' ? (obj.radius ?? 50) * 2 : (obj.height ?? 100);
    const pad = 4;

    context.save();
    context.strokeStyle = '#3B82F6';
    context.lineWidth = 1.5;
    if (typeof context.setLineDash === 'function') {
      context.setLineDash([4, 4]);
    }
    context.strokeRect(left - pad, top - pad, width + pad * 2, height + pad * 2);

    if (typeof context.setLineDash === 'function') {
      context.setLineDash([]);
    }
    context.fillStyle = '#FFFFFF';
    context.strokeStyle = '#2563EB';
    context.lineWidth = 1;
    const handleSize = 6;
    const corners = [
      { x: left - pad - handleSize / 2, y: top - pad - handleSize / 2 },
      { x: left + width + pad - handleSize / 2, y: top - pad - handleSize / 2 },
      { x: left - pad - handleSize / 2, y: top + height + pad - handleSize / 2 },
      { x: left + width + pad - handleSize / 2, y: top + height + pad - handleSize / 2 },
    ];
    for (const c of corners) {
      context.fillRect(c.x, c.y, handleSize, handleSize);
      context.strokeRect(c.x, c.y, handleSize, handleSize);
    }
    context.restore();
  }

  // ==========================================
  // Teardown
  // ==========================================

  public destroy(): void {
    if (this.animFrameId) {
      if (typeof cancelAnimationFrame !== 'undefined') {
        try {
          cancelAnimationFrame(this.animFrameId);
        } catch {}
      }
      clearTimeout(this.animFrameId);
      this.animFrameId = null;
    }
    this.renderRequested = false;

    this.isDrawingShape = false;
    this.shapeStartPoint = null;
    this.activeShapeType = null;
    this.currentShapePreview = null;

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
