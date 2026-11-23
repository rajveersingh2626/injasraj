/**
 * Canvas Coordinate Transform, Aspect Ratio & Fit-to-Screen Engine
 *
 * Provides the mathematical transformation layer to enforce a canonical 1920x1080
 * coordinate space across heterogeneous devices (desktops, 4:3 iPads, and portrait phones)
 * with uniform letterboxing/pillarboxing, bidirectional screen-to-virtual coordinate mapping,
 * and pinch-to-zoom bounds clamping.
 */

export const DEFAULT_VIRTUAL_WIDTH = 1920;
export const DEFAULT_VIRTUAL_HEIGHT = 1080;
export const DEFAULT_PORTRAIT_WIDTH = 1200;
export const DEFAULT_PORTRAIT_HEIGHT = 1600; // Standard 3:4 portrait document aspect ratio
export const PORTRAIT_PAGE_GAP = 40; // Vertical spacing between stacked document pages in px
export const DEFAULT_MIN_ZOOM = 0.5;
export const DEFAULT_MAX_ZOOM = 3.0;
export const ZOOM_PRESETS = [0.75, 1.0, 1.25, 1.5];

/**
 * Calculates a crisp fit-to-width zoom scale factor for portrait document stages
 * ensuring both student and teacher view the exact same document framing with comfortable margins.
 */
export function calculateFitToWidth(
  containerWidth: number,
  pageWidth: number = DEFAULT_PORTRAIT_WIDTH,
  horizontalMargin: number = 64
): number {
  if (containerWidth <= horizontalMargin) return 1.0;
  const availableWidth = containerWidth - horizontalMargin;
  const scale = availableWidth / pageWidth;
  return Math.min(2.0, Math.max(0.3, parseFloat(scale.toFixed(2))));
}

export interface ViewportBounds {
  scale: number;
  offsetX: number;
  offsetY: number;
  renderedWidth: number;
  renderedHeight: number;
  containerWidth: number;
  containerHeight: number;
  virtualWidth: number;
  virtualHeight: number;
}

export interface Point {
  x: number;
  y: number;
}

/**
 * Calculates uniform scale factor and centering offsets to fit a canonical
 * virtual canvas (default 1920x1080) into an arbitrary container element.
 *
 * Applies letterboxing (offsetY > 0) when the container is taller than 16:9,
 * or pillarboxing (offsetX > 0) when the container is wider than 16:9.
 */
export function calculateViewportTransform(
  containerWidth: number,
  containerHeight: number,
  virtualWidth: number = DEFAULT_VIRTUAL_WIDTH,
  virtualHeight: number = DEFAULT_VIRTUAL_HEIGHT
): ViewportBounds {
  const vWidth = virtualWidth > 0 ? virtualWidth : DEFAULT_VIRTUAL_WIDTH;
  const vHeight = virtualHeight > 0 ? virtualHeight : DEFAULT_VIRTUAL_HEIGHT;

  if (containerWidth <= 0 || containerHeight <= 0) {
    return {
      scale: 0,
      offsetX: 0,
      offsetY: 0,
      renderedWidth: 0,
      renderedHeight: 0,
      containerWidth: Math.max(0, containerWidth),
      containerHeight: Math.max(0, containerHeight),
      virtualWidth: vWidth,
      virtualHeight: vHeight,
    };
  }

  const scaleX = containerWidth / vWidth;
  const scaleY = containerHeight / vHeight;
  const scale = Math.min(scaleX, scaleY);

  const renderedWidth = vWidth * scale;
  const renderedHeight = vHeight * scale;

  const offsetX = (containerWidth - renderedWidth) / 2;
  const offsetY = (containerHeight - renderedHeight) / 2;

  return {
    scale,
    offsetX,
    offsetY,
    renderedWidth,
    renderedHeight,
    containerWidth,
    containerHeight,
    virtualWidth: vWidth,
    virtualHeight: vHeight,
  };
}

/**
 * Maps screen / pointer / touch coordinates into canonical virtual coordinates.
 * By default, clamps the resulting point within [0, virtualWidth] and [0, virtualHeight].
 *
 * @param screenX Pixel coordinate X relative to container top-left
 * @param screenY Pixel coordinate Y relative to container top-left
 * @param transform Viewport transformation bounds calculated for the container
 * @param clamp Whether to constrain output point within the virtual canvas (default true)
 */
export function screenToVirtualPoint(
  screenX: number,
  screenY: number,
  transform: ViewportBounds,
  clamp: boolean = true
): Point {
  if (transform.scale <= 0) {
    return { x: 0, y: 0 };
  }

  const rawX = (screenX - transform.offsetX) / transform.scale;
  const rawY = (screenY - transform.offsetY) / transform.scale;

  if (!clamp) {
    return { x: rawX, y: rawY };
  }

  const clampedX = Math.max(0, Math.min(transform.virtualWidth, rawX));
  const clampedY = Math.max(0, Math.min(transform.virtualHeight, rawY));

  return { x: clampedX, y: clampedY };
}

/**
 * Maps a canonical virtual coordinate back into DOM screen pixel coordinates.
 * Used for positioning laser pointer overlays, selection borders, and tooltips.
 *
 * @param virtualX Canonical virtual X coordinate (0 - virtualWidth)
 * @param virtualY Canonical virtual Y coordinate (0 - virtualHeight)
 * @param transform Viewport transformation bounds calculated for the container
 */
export function virtualToScreenPoint(
  virtualX: number,
  virtualY: number,
  transform: ViewportBounds
): Point {
  const screenX = transform.offsetX + virtualX * transform.scale;
  const screenY = transform.offsetY + virtualY * transform.scale;

  return { x: screenX, y: screenY };
}

/**
 * Clamps a zoom level within minimum and maximum limits.
 * Handles NaN, infinity, and inverted min/max bounds defensively.
 */
export function clampZoom(
  zoom: number,
  minZoom: number = DEFAULT_MIN_ZOOM,
  maxZoom: number = DEFAULT_MAX_ZOOM
): number {
  const actualMin = Math.min(minZoom, maxZoom);
  const actualMax = Math.max(minZoom, maxZoom);

  if (Number.isNaN(zoom) || !Number.isFinite(zoom)) {
    return Math.max(actualMin, Math.min(actualMax, 1.0));
  }

  return Math.max(actualMin, Math.min(actualMax, zoom));
}

/**
 * Checks whether a screen-space coordinate falls within the rendered canvas rectangle
 * (excluding letterbox / pillarbox margins).
 */
export function isPointInViewport(
  screenX: number,
  screenY: number,
  transform: ViewportBounds
): boolean {
  if (transform.scale <= 0) return false;

  return (
    screenX >= transform.offsetX &&
    screenX <= transform.offsetX + transform.renderedWidth &&
    screenY >= transform.offsetY &&
    screenY <= transform.offsetY + transform.renderedHeight
  );
}
