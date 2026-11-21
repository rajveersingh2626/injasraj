/**
 * Touch Gesture Handler for Mobile & Tablet Classroom Whiteboard
 *
 * Implements multi-touch discrimination and gesture math:
 * - 1-finger touch: drawing with active tool ('draw')
 * - 2-finger touch: pinch-to-zoom ('pinch-zoom') or two-finger pan ('pan')
 * - 3+ finger touch / palm contact: rejected and ignored ('ignore')
 *
 * Calculates relative scale deltas and midpoint centers for smooth zooming,
 * and translation offsets (deltaX, deltaY) for smooth canvas panning.
 */

export type TouchGestureClassification = 'draw' | 'pinch-zoom' | 'pan' | 'ignore';

export interface TouchPoint {
  clientX: number;
  clientY: number;
}

export interface PinchZoomDelta {
  scaleDelta: number;
  centerScreenX: number;
  centerScreenY: number;
}

export interface PanDelta {
  deltaX: number;
  deltaY: number;
}

export interface TouchGestureResult {
  classification: TouchGestureClassification;
  pinchDelta?: PinchZoomDelta;
  panDelta?: PanDelta;
}

export interface TouchGestureHandlerOptions {
  /**
   * Distance difference threshold (in pixels) below which fingers are considered stationary.
   * Default: 0
   */
  threshold?: number;
}

/**
 * Calculates Euclidean distance between two touch points.
 */
export function getTouchDistance(p1: TouchPoint, p2: TouchPoint): number {
  return Math.hypot(p2.clientX - p1.clientX, p2.clientY - p1.clientY);
}

/**
 * Calculates center midpoint between two touch points.
 */
export function getTouchCenter(p1: TouchPoint, p2: TouchPoint): { x: number; y: number } {
  return {
    x: (p1.clientX + p2.clientX) / 2,
    y: (p1.clientY + p2.clientY) / 2,
  };
}

/**
 * Normalizes standard DOM TouchList or array of points into a clean TouchPoint array.
 */
export function normalizeTouches(
  touches: TouchList | Array<{ clientX: number; clientY: number }> | null | undefined
): TouchPoint[] {
  if (!touches) return [];
  const points: TouchPoint[] = [];
  const len = typeof touches.length === 'number' ? touches.length : 0;

  for (let i = 0; i < len; i++) {
    const item =
      (touches as any)[i] ??
      (typeof (touches as any).item === 'function' ? (touches as any).item(i) : undefined);

    if (
      item &&
      typeof item.clientX === 'number' &&
      !isNaN(item.clientX) &&
      typeof item.clientY === 'number' &&
      !isNaN(item.clientY)
    ) {
      points.push({
        clientX: item.clientX,
        clientY: item.clientY,
      });
    }
  }

  return points;
}

export class TouchGestureHandler {
  private prevDistance: number | null = null;
  private prevCenter: { x: number; y: number } | null = null;
  private initialDistance: number | null = null;
  private initialCenter: { x: number; y: number } | null = null;
  private currentClassification: TouchGestureClassification | null = null;
  private options: TouchGestureHandlerOptions;

  constructor(options: TouchGestureHandlerOptions = {}) {
    this.options = {
      threshold: 0,
      ...options,
    };
  }

  /**
   * Classifies gesture based on active touch count alone:
   * - 1 touch  -> 'draw'
   * - 2 touches -> 'pinch-zoom'
   * - 3+ touches -> 'ignore' (palm rejection)
   * - 0 / negative -> 'ignore'
   */
  classifyTouchCount(touchCount: number): TouchGestureClassification {
    if (touchCount === 1) {
      return 'draw';
    }
    if (touchCount === 2) {
      return this.currentClassification === 'pan' ? 'pan' : 'pinch-zoom';
    }
    return 'ignore';
  }

  /**
   * Handles touchstart event to initialize tracking state and determine gesture intent.
   */
  handleTouchStart(
    touches: TouchList | Array<{ clientX: number; clientY: number }>
  ): TouchGestureClassification {
    const points = normalizeTouches(touches);
    const count = points.length;

    if (count === 1) {
      this.resetTwoFingerState();
      this.currentClassification = 'draw';
      return 'draw';
    }

    if (count === 2) {
      const p0 = points[0];
      const p1 = points[1];
      const dist = getTouchDistance(p0, p1);
      const center = getTouchCenter(p0, p1);

      this.prevDistance = dist;
      this.prevCenter = center;
      this.initialDistance = dist;
      this.initialCenter = center;
      this.currentClassification = 'pinch-zoom';
      return 'pinch-zoom';
    }

    // 3+ fingers or 0: palm rejection / ignore
    this.resetTwoFingerState();
    this.currentClassification = 'ignore';
    return 'ignore';
  }

  /**
   * Handles touchmove event.
   * Discriminates between drawing (1 touch), pinch-zoom or pan (2 touches), and palm contact (3+ touches).
   * Computes incremental scaleDelta and pan deltas (deltaX, deltaY).
   */
  handleTouchMove(
    touches: TouchList | Array<{ clientX: number; clientY: number }>
  ): TouchGestureResult {
    const points = normalizeTouches(touches);
    const count = points.length;

    if (count === 1) {
      this.resetTwoFingerState();
      this.currentClassification = 'draw';
      return { classification: 'draw' };
    }

    if (count === 2) {
      const p0 = points[0];
      const p1 = points[1];
      const currDist = getTouchDistance(p0, p1);
      const currCenter = getTouchCenter(p0, p1);

      // If previous state wasn't established (e.g. touchstart was skipped or interrupted)
      if (this.prevDistance === null || this.prevCenter === null) {
        this.prevDistance = currDist;
        this.prevCenter = currCenter;
        this.currentClassification = 'pinch-zoom';
        return {
          classification: 'pinch-zoom',
          pinchDelta: {
            scaleDelta: 1.0,
            centerScreenX: currCenter.x,
            centerScreenY: currCenter.y,
          },
        };
      }

      const prevDist = this.prevDistance;
      const prevCenter = this.prevCenter;

      const deltaX = currCenter.x - prevCenter.x;
      const deltaY = currCenter.y - prevCenter.y;
      const panDist = Math.hypot(deltaX, deltaY);
      const distDelta = Math.abs(currDist - prevDist);
      const scaleDelta = prevDist > 0 ? currDist / prevDist : 1.0;

      // Update baseline state for subsequent frame deltas
      this.prevDistance = currDist;
      this.prevCenter = currCenter;

      // Discrimination heuristic:
      // When pan movement strictly dominates distance change, it is a two-finger translation/pan.
      // Otherwise (spreading apart or pinching closer), it is a pinch-to-zoom gesture.
      if (panDist > distDelta) {
        this.currentClassification = 'pan';
        return {
          classification: 'pan',
          panDelta: {
            deltaX,
            deltaY,
          },
        };
      } else {
        this.currentClassification = 'pinch-zoom';
        return {
          classification: 'pinch-zoom',
          pinchDelta: {
            scaleDelta,
            centerScreenX: currCenter.x,
            centerScreenY: currCenter.y,
          },
          panDelta: deltaX !== 0 || deltaY !== 0 ? { deltaX, deltaY } : undefined,
        };
      }
    }

    // 3+ fingers or 0 fingers: palm rejection
    this.resetTwoFingerState();
    this.currentClassification = 'ignore';
    return { classification: 'ignore' };
  }

  /**
   * Resets all touch tracking state when all touches end or are cancelled.
   */
  handleTouchEnd(): void {
    this.resetTwoFingerState();
    this.currentClassification = null;
  }

  /**
   * Returns current active classification, or null if idle.
   */
  getCurrentClassification(): TouchGestureClassification | null {
    return this.currentClassification;
  }

  /**
   * Returns whether a multi-touch gesture is currently active.
   */
  isMultiTouchActive(): boolean {
    return this.prevDistance !== null && this.prevCenter !== null;
  }

  /**
   * Resets 2-finger gesture calculation baseline.
   */
  private resetTwoFingerState(): void {
    this.prevDistance = null;
    this.prevCenter = null;
    this.initialDistance = null;
    this.initialCenter = null;
  }
}
