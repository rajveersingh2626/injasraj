/**
 * Geometric & Hit-Testing Utilities for Whiteboard Canvas Engine
 */

/**
 * Deep clones an object safely via JSON serialization.
 */
export function deepClone<T>(obj: T): T {
  if (obj === undefined || obj === null) {
    return obj;
  }
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Generates an RFC4122-compliant or secure unique ID for canvas objects.
 */
export function generateObjectId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return 'obj-' + crypto.randomUUID();
  }
  return 'obj-' + Math.random().toString(36).substring(2, 11) + '-' + Date.now().toString(36);
}

/**
 * Generates smooth SVG path string from point stream using quadratic bezier interpolation.
 */
export function pointsToSvgPath(points: Array<{ x: number; y: number }>): string {
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
export function distanceToSegment(
  px: number,
  py: number,
  x1: number,
  y1: number,
  x2: number,
  y2: number
): number {
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
export function isPointInObject(
  point: { x: number; y: number },
  obj: any,
  tolerance: number = 8
): boolean {
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
    const x2 = obj.x2 ?? (x1 + (obj.width ?? 100));
    const y2 = obj.y2 ?? (y1 + (obj.height ?? 100));
    return distanceToSegment(point.x, point.y, x1, y1, x2, y2) <= tolerance + (obj.strokeWidth || 3) / 2;
  }

  if (obj.type === 'path') {
    if (Array.isArray(obj.points) && obj.points.length > 0) {
      for (let i = 0; i < obj.points.length - 1; i++) {
        const p1 = obj.points[i];
        const p2 = obj.points[i + 1];
        if (distanceToSegment(point.x, point.y, p1.x, p1.y, p2.x, p2.y) <= tolerance + (obj.strokeWidth || 3) / 2) {
          return true;
        }
      }
      return false;
    }
  }

  return false;
}
