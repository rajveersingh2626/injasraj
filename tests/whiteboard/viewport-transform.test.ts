import { describe, it, expect } from 'vitest';
import {
  calculateViewportTransform,
  screenToVirtualPoint,
  virtualToScreenPoint,
  clampZoom,
  isPointInViewport,
  calculateFitToWidth,
  calculateScrollClampBounds,
  clampPanOffset,
  DEFAULT_SCROLL_MARGIN,
  DEFAULT_VIRTUAL_WIDTH,
  DEFAULT_VIRTUAL_HEIGHT,
  type ViewportBounds,
} from '../../src/lib/whiteboard/viewport-transform';

describe('ViewportTransform Engine', () => {
  describe('calculateViewportTransform', () => {
    it('calculates uniform scale and letterboxing for 1080p desktop (1920x1080)', () => {
      const transform = calculateViewportTransform(1920, 1080);
      expect(transform.scale).toBe(1.0);
      expect(transform.offsetX).toBe(0);
      expect(transform.offsetY).toBe(0);
      expect(transform.renderedWidth).toBe(1920);
      expect(transform.renderedHeight).toBe(1080);
      expect(transform.containerWidth).toBe(1920);
      expect(transform.containerHeight).toBe(1080);
      expect(transform.virtualWidth).toBe(DEFAULT_VIRTUAL_WIDTH);
      expect(transform.virtualHeight).toBe(DEFAULT_VIRTUAL_HEIGHT);
    });

    it('calculates 0.5x uniform scaling for 960x540 viewport', () => {
      const transform = calculateViewportTransform(960, 540);
      expect(transform.scale).toBe(0.5);
      expect(transform.offsetX).toBe(0);
      expect(transform.offsetY).toBe(0);
      expect(transform.renderedWidth).toBe(960);
      expect(transform.renderedHeight).toBe(540);
    });

    it('calculates 2.0x uniform scaling for 4K 16:9 viewport (3840x2160)', () => {
      const transform = calculateViewportTransform(3840, 2160);
      expect(transform.scale).toBe(2.0);
      expect(transform.offsetX).toBe(0);
      expect(transform.offsetY).toBe(0);
      expect(transform.renderedWidth).toBe(3840);
      expect(transform.renderedHeight).toBe(2160);
    });

    it('calculates letterboxing (vertical offsets) for 4:3 iPad viewport (1024x768)', () => {
      const transform = calculateViewportTransform(1024, 768);
      // scale = min(1024/1920, 768/1080) = min(0.5333..., 0.7111...) = 1024/1920
      const expectedScale = 1024 / 1920;
      expect(transform.scale).toBeCloseTo(expectedScale, 5);
      expect(transform.renderedWidth).toBe(1024);
      expect(transform.renderedHeight).toBeCloseTo(1080 * expectedScale, 5); // 576
      expect(transform.offsetX).toBe(0);
      // offsetY = (768 - 576) / 2 = 96
      expect(transform.offsetY).toBeCloseTo(96, 5);
    });

    it('calculates pillarboxing (horizontal offsets) for ultrawide monitor (2560x1080)', () => {
      const transform = calculateViewportTransform(2560, 1080);
      // scale = min(2560/1920, 1080/1080) = 1.0
      expect(transform.scale).toBe(1.0);
      expect(transform.renderedWidth).toBe(1920);
      expect(transform.renderedHeight).toBe(1080);
      // offsetX = (2560 - 1920) / 2 = 320
      expect(transform.offsetX).toBe(320);
      expect(transform.offsetY).toBe(0);
    });

    it('calculates transform for 9:16 mobile portrait viewport (390x844)', () => {
      const transform = calculateViewportTransform(390, 844);
      // scale = min(390/1920, 844/1080) = 390 / 1920 = 0.203125
      const expectedScale = 390 / 1920;
      expect(transform.scale).toBeCloseTo(expectedScale, 5);
      expect(transform.renderedWidth).toBe(390);
      expect(transform.renderedHeight).toBeCloseTo(1080 * expectedScale, 5); // 219.375
      expect(transform.offsetX).toBe(0);
      // offsetY = (844 - 219.375) / 2 = 312.3125
      expect(transform.offsetY).toBeCloseTo((844 - 1080 * expectedScale) / 2, 5);
    });

    it('calculates transform for landscape phone viewport (844x390)', () => {
      const transform = calculateViewportTransform(844, 390);
      // scale = min(844/1920, 390/1080) = 390/1080
      const expectedScale = 390 / 1080;
      expect(transform.scale).toBeCloseTo(expectedScale, 5);
      expect(transform.renderedHeight).toBe(390);
      expect(transform.renderedWidth).toBeCloseTo(1920 * expectedScale, 5);
      expect(transform.offsetY).toBe(0);
      expect(transform.offsetX).toBeCloseTo((844 - 1920 * expectedScale) / 2, 5);
    });

    it('supports custom virtual canvas resolutions', () => {
      const transform = calculateViewportTransform(800, 600, 400, 300);
      expect(transform.virtualWidth).toBe(400);
      expect(transform.virtualHeight).toBe(300);
      expect(transform.scale).toBe(2.0);
      expect(transform.offsetX).toBe(0);
      expect(transform.offsetY).toBe(0);
      expect(transform.renderedWidth).toBe(800);
      expect(transform.renderedHeight).toBe(600);
    });

    it('handles zero or negative container dimensions gracefully', () => {
      const transformZero = calculateViewportTransform(0, 0);
      expect(transformZero.scale).toBe(0);
      expect(transformZero.renderedWidth).toBe(0);
      expect(transformZero.renderedHeight).toBe(0);
      expect(transformZero.offsetX).toBe(0);
      expect(transformZero.offsetY).toBe(0);

      const transformNegative = calculateViewportTransform(-100, 500);
      expect(transformNegative.scale).toBe(0);
      expect(transformNegative.renderedWidth).toBe(0);
    });
  });

  describe('screenToVirtualPoint', () => {
    it('accurately maps screen touch coordinates into canonical 1920x1080 coordinates (0.5x)', () => {
      const transform = calculateViewportTransform(960, 540);
      const virtualPt = screenToVirtualPoint(480, 270, transform);
      expect(virtualPt.x).toBe(960);
      expect(virtualPt.y).toBe(540);
    });

    it('maps screen origin and boundaries correctly on 1:1 desktop', () => {
      const transform = calculateViewportTransform(1920, 1080);
      expect(screenToVirtualPoint(0, 0, transform)).toEqual({ x: 0, y: 0 });
      expect(screenToVirtualPoint(1920, 1080, transform)).toEqual({ x: 1920, y: 1080 });
      expect(screenToVirtualPoint(960, 540, transform)).toEqual({ x: 960, y: 540 });
    });

    it('accounts for letterbox offset on 4:3 iPad viewport (1024x768)', () => {
      const transform = calculateViewportTransform(1024, 768);
      // On iPad, offsetY = 96.
      // Top-left of the canvas is at (0, 96).
      const topLeft = screenToVirtualPoint(0, 96, transform);
      expect(topLeft.x).toBeCloseTo(0, 5);
      expect(topLeft.y).toBeCloseTo(0, 5);

      // Center of canvas is at (512, 384)
      const center = screenToVirtualPoint(512, 384, transform);
      expect(center.x).toBeCloseTo(960, 5);
      expect(center.y).toBeCloseTo(540, 5);
    });

    it('accounts for pillarbox offset on ultrawide viewport (2560x1080)', () => {
      const transform = calculateViewportTransform(2560, 1080);
      // On ultrawide, offsetX = 320.
      // Top-left of canvas is at (320, 0)
      const topLeft = screenToVirtualPoint(320, 0, transform);
      expect(topLeft.x).toBe(0);
      expect(topLeft.y).toBe(0);

      // Center is at (1280, 540)
      const center = screenToVirtualPoint(1280, 540, transform);
      expect(center.x).toBe(960);
      expect(center.y).toBe(540);
    });

    it('clamps points within [0, virtualWidth] and [0, virtualHeight]', () => {
      const transform = calculateViewportTransform(1024, 768);
      // Click inside top black bar (screenY = 20, which is < offsetY = 96)
      const inTopBar = screenToVirtualPoint(512, 20, transform);
      expect(inTopBar.y).toBe(0);
      expect(inTopBar.x).toBeCloseTo(960, 5);

      // Click inside bottom black bar (screenY = 750, > offsetY + renderedHeight = 672)
      const inBottomBar = screenToVirtualPoint(512, 750, transform);
      expect(inBottomBar.y).toBe(1080);

      // Out of bounds negative coordinates
      const negativeCoords = screenToVirtualPoint(-100, -50, transform);
      expect(negativeCoords.x).toBe(0);
      expect(negativeCoords.y).toBe(0);

      // Out of bounds excessively large coordinates
      const hugeCoords = screenToVirtualPoint(5000, 5000, transform);
      expect(hugeCoords.x).toBe(1920);
      expect(hugeCoords.y).toBe(1080);
    });

    it('allows unclamped points when clamp = false is explicitly specified', () => {
      const transform = calculateViewportTransform(1920, 1080);
      const unclamped = screenToVirtualPoint(-100, 2000, transform, false);
      expect(unclamped.x).toBe(-100);
      expect(unclamped.y).toBe(2000);
    });

    it('handles scale <= 0 gracefully', () => {
      const zeroTransform: ViewportBounds = {
        scale: 0,
        offsetX: 0,
        offsetY: 0,
        renderedWidth: 0,
        renderedHeight: 0,
        containerWidth: 0,
        containerHeight: 0,
        virtualWidth: 1920,
        virtualHeight: 1080,
      };
      const pt = screenToVirtualPoint(100, 100, zeroTransform);
      expect(pt).toEqual({ x: 0, y: 0 });
    });
  });

  describe('virtualToScreenPoint', () => {
    it('maps canonical 1920x1080 origin and extremes to screen pixels at 1:1 scale', () => {
      const transform = calculateViewportTransform(1920, 1080);
      expect(virtualToScreenPoint(0, 0, transform)).toEqual({ x: 0, y: 0 });
      expect(virtualToScreenPoint(1920, 1080, transform)).toEqual({ x: 1920, y: 1080 });
      expect(virtualToScreenPoint(960, 540, transform)).toEqual({ x: 960, y: 540 });
    });

    it('maps virtual coordinates accurately under letterboxing (1024x768 iPad)', () => {
      const transform = calculateViewportTransform(1024, 768);
      // (0, 0) virtual -> screen (0, 96)
      const screenOrigin = virtualToScreenPoint(0, 0, transform);
      expect(screenOrigin.x).toBe(0);
      expect(screenOrigin.y).toBeCloseTo(96, 5);

      // (960, 540) virtual -> screen (512, 384)
      const screenCenter = virtualToScreenPoint(960, 540, transform);
      expect(screenCenter.x).toBeCloseTo(512, 5);
      expect(screenCenter.y).toBeCloseTo(384, 5);

      // (1920, 1080) virtual -> screen (1024, 672)
      const screenBottomRight = virtualToScreenPoint(1920, 1080, transform);
      expect(screenBottomRight.x).toBeCloseTo(1024, 5);
      expect(screenBottomRight.y).toBeCloseTo(672, 5);
    });

    it('maps virtual coordinates accurately under pillarboxing (2560x1080 ultrawide)', () => {
      const transform = calculateViewportTransform(2560, 1080);
      // (0, 0) virtual -> screen (320, 0)
      const screenOrigin = virtualToScreenPoint(0, 0, transform);
      expect(screenOrigin.x).toBe(320);
      expect(screenOrigin.y).toBe(0);

      // (960, 540) virtual -> screen (1280, 540)
      const screenCenter = virtualToScreenPoint(960, 540, transform);
      expect(screenCenter.x).toBe(1280);
      expect(screenCenter.y).toBe(540);
    });
  });

  describe('Round-trip transformation parity', () => {
    const testCases: [string, number, number][] = [
      ['1080p Desktop', 1920, 1080],
      ['4K Display', 3840, 2160],
      ['Half-size 16:9', 960, 540],
      ['4:3 iPad (1024x768)', 1024, 768],
      ['iPad Pro 11-inch (1194x834)', 1194, 834],
      ['Ultrawide 21:9 (2560x1080)', 2560, 1080],
      ['Portrait iPhone (390x844)', 390, 844],
      ['Landscape Phone (844x390)', 844, 390],
    ];

    testCases.forEach(([label, w, h]) => {
      it(`maintains virtual -> screen -> virtual parity for ${label}`, () => {
        const transform = calculateViewportTransform(w, h);
        const testPoints = [
          { x: 0, y: 0 },
          { x: 1920, y: 0 },
          { x: 0, y: 1080 },
          { x: 1920, y: 1080 },
          { x: 960, y: 540 },
          { x: 420.5, y: 318.25 },
          { x: 1337.7, y: 888.8 },
        ];

        for (const pt of testPoints) {
          const screen = virtualToScreenPoint(pt.x, pt.y, transform);
          const backToVirtual = screenToVirtualPoint(screen.x, screen.y, transform);
          expect(backToVirtual.x).toBeCloseTo(pt.x, 3);
          expect(backToVirtual.y).toBeCloseTo(pt.y, 3);
        }
      });

      it(`maintains screen -> virtual -> screen parity within canvas bounds for ${label}`, () => {
        const transform = calculateViewportTransform(w, h);
        const screenTestPoints = [
          { x: transform.offsetX, y: transform.offsetY },
          { x: transform.offsetX + transform.renderedWidth, y: transform.offsetY },
          { x: transform.offsetX, y: transform.offsetY + transform.renderedHeight },
          {
            x: transform.offsetX + transform.renderedWidth,
            y: transform.offsetY + transform.renderedHeight,
          },
          {
            x: transform.offsetX + transform.renderedWidth / 2,
            y: transform.offsetY + transform.renderedHeight / 2,
          },
        ];

        for (const pt of screenTestPoints) {
          const virtual = screenToVirtualPoint(pt.x, pt.y, transform);
          const backToScreen = virtualToScreenPoint(virtual.x, virtual.y, transform);
          expect(backToScreen.x).toBeCloseTo(pt.x, 3);
          expect(backToScreen.y).toBeCloseTo(pt.y, 3);
        }
      });
    });
  });

  describe('clampZoom', () => {
    it('clamps zoom below minimum zoom level (default 0.5)', () => {
      expect(clampZoom(0.1)).toBe(0.5);
      expect(clampZoom(0.49)).toBe(0.5);
    });

    it('clamps zoom above maximum zoom level (default 3.0)', () => {
      expect(clampZoom(3.5)).toBe(3.0);
      expect(clampZoom(10)).toBe(3.0);
    });

    it('preserves zoom values within normal range', () => {
      expect(clampZoom(1.0)).toBe(1.0);
      expect(clampZoom(1.75)).toBe(1.75);
      expect(clampZoom(2.5)).toBe(2.5);
    });

    it('respects custom minZoom and maxZoom bounds', () => {
      expect(clampZoom(0.05, 0.1, 5.0)).toBe(0.1);
      expect(clampZoom(4.2, 0.1, 5.0)).toBe(4.2);
      expect(clampZoom(7.5, 0.1, 5.0)).toBe(5.0);
    });

    it('handles inverted minZoom and maxZoom gracefully', () => {
      expect(clampZoom(0.2, 3.0, 0.5)).toBe(0.5);
      expect(clampZoom(4.0, 3.0, 0.5)).toBe(3.0);
      expect(clampZoom(1.5, 3.0, 0.5)).toBe(1.5);
    });

    it('handles NaN or invalid zoom numbers by defaulting safely', () => {
      expect(clampZoom(NaN)).toBe(1.0);
      expect(clampZoom(NaN, 2.0, 5.0)).toBe(2.0); // clamped to minZoom
    });
  });

  describe('isPointInViewport', () => {
    it('correctly determines whether a screen point lies within the rendered canvas bounds', () => {
      const transform = calculateViewportTransform(1024, 768); // iPad: offsetY=96, height=576
      // Center is inside
      expect(isPointInViewport(512, 384, transform)).toBe(true);
      // Top bar is outside
      expect(isPointInViewport(512, 50, transform)).toBe(false);
      // Bottom bar is outside
      expect(isPointInViewport(512, 700, transform)).toBe(false);
      // Boundary edge is inside
      expect(isPointInViewport(0, 96, transform)).toBe(true);
      expect(isPointInViewport(1024, 672, transform)).toBe(true);
    });
  });

  describe('calculateFitToWidth', () => {
    it('calculates fit-to-width scale factor for various screen widths', () => {
      // 1264px container with 64px padding -> 1200px available / 1200px page = 1.0
      expect(calculateFitToWidth(1264, 1200, 64)).toBe(1.0);

      // Laptop 1440px container with 64px padding -> 1376px / 1200px = 1.15
      expect(calculateFitToWidth(1440, 1200, 64)).toBe(1.15);

      // Mobile / tablet 768px container with 64px padding -> 704px / 1200px = 0.59
      expect(calculateFitToWidth(768, 1200, 64)).toBe(0.59);
    });

    it('clamps fit-to-width gracefully between minimum and maximum bounds', () => {
      expect(calculateFitToWidth(100, 1200, 64)).toBe(0.3); // Clamped to min 0.3
      expect(calculateFitToWidth(4000, 1200, 64)).toBe(2.0); // Clamped to max 2.0
    });
  });

  describe('calculateScrollClampBounds & clampPanOffset', () => {
    it('calculates scroll bounds for non-overflowing canvas', () => {
      // 1000x800 container, 800x600 rendered canvas at 1x scale
      const bounds = calculateScrollClampBounds(1000, 800, 800, 600, 1.0, 64);
      expect(bounds.minPanX).toBe(-64);
      expect(bounds.maxPanX).toBe(64);
      expect(bounds.minPanY).toBe(-64);
      expect(bounds.maxPanY).toBe(64);
    });

    it('calculates scroll bounds dynamically for zoomed-in / tall portrait stage', () => {
      // 1000x800 container, 800x1200 rendered canvas at 1.5x scale -> scaled: 1200x1800
      // overflowX = (1200 - 1000) / 2 = 100
      // overflowY = (1800 - 800) / 2 = 500
      const bounds = calculateScrollClampBounds(1000, 800, 800, 1200, 1.5, 64);
      expect(bounds.minPanX).toBe(-164);
      expect(bounds.maxPanX).toBe(164);
      expect(bounds.minPanY).toBe(-564);
      expect(bounds.maxPanY).toBe(564);
    });

    it('clamps extreme over-scroll values into comfortable boundary range', () => {
      // User attempts to pan into empty void (e.g., panX = -9999, panY = 8888)
      const clamped = clampPanOffset(-9999, 8888, 1000, 800, 800, 1200, 1.5, 64);
      expect(clamped.x).toBe(-164);
      expect(clamped.y).toBe(564);
    });

    it('preserves valid in-bounds pan coordinates without modification', () => {
      const clamped = clampPanOffset(50, -100, 1000, 800, 800, 1200, 1.5, 64);
      expect(clamped.x).toBe(50);
      expect(clamped.y).toBe(-100);
    });

    it('handles zero or invalid container dimensions defensively', () => {
      const bounds = calculateScrollClampBounds(0, 0, 800, 600, 1.0, 64);
      expect(bounds.minPanX).toBe(-64);
      expect(bounds.maxPanX).toBe(64);

      const clamped = clampPanOffset(NaN, Infinity, 0, 0, 800, 600, 1.0, 64);
      expect(clamped.x).toBe(0);
      expect(clamped.y).toBe(64);
    });
  });
});
