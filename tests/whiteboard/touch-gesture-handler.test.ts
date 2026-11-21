import { describe, it, expect, beforeEach } from 'vitest';
import {
  TouchGestureHandler,
  getTouchDistance,
  getTouchCenter,
  normalizeTouches,
  type TouchPoint,
} from '../../src/lib/whiteboard/touch-gesture-handler';

describe('TouchGestureHandler (Mobile & Tablet Native Hardening)', () => {
  let handler: TouchGestureHandler;

  beforeEach(() => {
    handler = new TouchGestureHandler();
  });

  describe('classifyTouchCount', () => {
    it('classifies 1 touch as "draw"', () => {
      expect(handler.classifyTouchCount(1)).toBe('draw');
    });

    it('classifies 2 touches as "pinch-zoom"', () => {
      expect(handler.classifyTouchCount(2)).toBe('pinch-zoom');
    });

    it('classifies 3+ touches as "ignore" for palm rejection', () => {
      expect(handler.classifyTouchCount(3)).toBe('ignore');
      expect(handler.classifyTouchCount(4)).toBe('ignore');
      expect(handler.classifyTouchCount(5)).toBe('ignore');
      expect(handler.classifyTouchCount(10)).toBe('ignore');
    });

    it('classifies 0 or negative touches as "ignore"', () => {
      expect(handler.classifyTouchCount(0)).toBe('ignore');
      expect(handler.classifyTouchCount(-1)).toBe('ignore');
    });

    it('returns "pan" if current active gesture is classified as pan', () => {
      // Simulate two-finger pan
      handler.handleTouchStart([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      handler.handleTouchMove([
        { clientX: 130, clientY: 140 },
        { clientX: 230, clientY: 140 },
      ]);
      expect(handler.classifyTouchCount(2)).toBe('pan');
    });
  });

  describe('1-Finger Touch (Drawing)', () => {
    it('returns "draw" on touchstart with 1 touch', () => {
      const classification = handler.handleTouchStart([{ clientX: 150, clientY: 250 }]);
      expect(classification).toBe('draw');
      expect(handler.getCurrentClassification()).toBe('draw');
      expect(handler.isMultiTouchActive()).toBe(false);
    });

    it('returns { classification: "draw" } on touchmove with 1 touch', () => {
      handler.handleTouchStart([{ clientX: 150, clientY: 250 }]);
      const result = handler.handleTouchMove([{ clientX: 160, clientY: 260 }]);
      expect(result).toEqual({ classification: 'draw' });
      expect(result.pinchDelta).toBeUndefined();
      expect(result.panDelta).toBeUndefined();
    });
  });

  describe('2-Finger Touch: Spreading Apart (Pinch-to-Zoom In)', () => {
    it('returns "pinch-zoom" on touchstart with 2 touches', () => {
      const classification = handler.handleTouchStart([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      expect(classification).toBe('pinch-zoom');
      expect(handler.isMultiTouchActive()).toBe(true);
    });

    it('returns "pinch-zoom" with scaleDelta > 1 when fingers spread apart', () => {
      // Initial distance = 100px, center = (150, 100)
      handler.handleTouchStart([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);

      // Move fingers outward: distance = 140px, center = (150, 100)
      const result = handler.handleTouchMove([
        { clientX: 80, clientY: 100 },
        { clientX: 220, clientY: 100 },
      ]);

      expect(result.classification).toBe('pinch-zoom');
      expect(result.pinchDelta).toBeDefined();
      expect(result.pinchDelta!.scaleDelta).toBeGreaterThan(1);
      expect(result.pinchDelta!.scaleDelta).toBeCloseTo(1.4, 4);
      expect(result.pinchDelta!.centerScreenX).toBe(150);
      expect(result.pinchDelta!.centerScreenY).toBe(100);
      expect(result.panDelta).toBeUndefined();
    });
  });

  describe('2-Finger Touch: Pinching Closer (Pinch-to-Zoom Out)', () => {
    it('returns "pinch-zoom" with scaleDelta < 1 when fingers pinch closer', () => {
      // Initial distance = 200px, center = (200, 150)
      handler.handleTouchStart([
        { clientX: 100, clientY: 150 },
        { clientX: 300, clientY: 150 },
      ]);

      // Move fingers inward: distance = 100px, center = (200, 150)
      const result = handler.handleTouchMove([
        { clientX: 150, clientY: 150 },
        { clientX: 250, clientY: 150 },
      ]);

      expect(result.classification).toBe('pinch-zoom');
      expect(result.pinchDelta).toBeDefined();
      expect(result.pinchDelta!.scaleDelta).toBeLessThan(1);
      expect(result.pinchDelta!.scaleDelta).toBeCloseTo(0.5, 4);
      expect(result.pinchDelta!.centerScreenX).toBe(200);
      expect(result.pinchDelta!.centerScreenY).toBe(150);
      expect(result.panDelta).toBeUndefined();
    });
  });

  describe('2-Finger Touch: Translation (Two-Finger Pan)', () => {
    it('returns "pan" with correct deltaX and deltaY when fingers move together', () => {
      // Initial: distance = 100px, center = (150, 100)
      handler.handleTouchStart([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);

      // Translate both fingers by (+25, +40)
      // New touches: (125, 140) and (225, 140) -> distance remains 100px, center becomes (175, 140)
      const result = handler.handleTouchMove([
        { clientX: 125, clientY: 140 },
        { clientX: 225, clientY: 140 },
      ]);

      expect(result.classification).toBe('pan');
      expect(result.panDelta).toBeDefined();
      expect(result.panDelta!.deltaX).toBe(25);
      expect(result.panDelta!.deltaY).toBe(40);
      expect(result.pinchDelta).toBeUndefined();
    });

    it('calculates negative deltaX and deltaY correctly for pan gestures', () => {
      handler.handleTouchStart([
        { clientX: 300, clientY: 300 },
        { clientX: 400, clientY: 300 },
      ]);

      // Translate left & up by (-30, -50)
      const result = handler.handleTouchMove([
        { clientX: 270, clientY: 250 },
        { clientX: 370, clientY: 250 },
      ]);

      expect(result.classification).toBe('pan');
      expect(result.panDelta).toEqual({ deltaX: -30, deltaY: -50 });
      expect(result.pinchDelta).toBeUndefined();
    });
  });

  describe('Consecutive Frame-by-Frame Deltas', () => {
    it('computes incremental deltas over multiple consecutive move events', () => {
      // Step 1: Start at distance 100
      handler.handleTouchStart([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);

      // Step 2: Expand to distance 150 (scale = 1.5)
      const move1 = handler.handleTouchMove([
        { clientX: 75, clientY: 100 },
        { clientX: 225, clientY: 100 },
      ]);
      expect(move1.classification).toBe('pinch-zoom');
      expect(move1.pinchDelta!.scaleDelta).toBeCloseTo(1.5, 4);

      // Step 3: Expand from 150 to 180 (incremental scale = 180 / 150 = 1.2)
      const move2 = handler.handleTouchMove([
        { clientX: 60, clientY: 100 },
        { clientX: 240, clientY: 100 },
      ]);
      expect(move2.classification).toBe('pinch-zoom');
      expect(move2.pinchDelta!.scaleDelta).toBeCloseTo(1.2, 4);

      // Step 4: Now translate without changing distance (distance stays 180)
      const move3 = handler.handleTouchMove([
        { clientX: 70, clientY: 120 },
        { clientX: 250, clientY: 120 },
      ]);
      expect(move3.classification).toBe('pan');
      expect(move3.panDelta).toEqual({ deltaX: 10, deltaY: 20 });
    });
  });

  describe('Accidental 3+ Finger Contact & Palm Rejection', () => {
    it('returns "ignore" on touchstart with 3 or more touches', () => {
      const result3 = handler.handleTouchStart([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
        { clientX: 150, clientY: 200 },
      ]);
      expect(result3).toBe('ignore');

      const result4 = handler.handleTouchStart([
        { clientX: 50, clientY: 50 },
        { clientX: 100, clientY: 50 },
        { clientX: 150, clientY: 50 },
        { clientX: 200, clientY: 50 },
      ]);
      expect(result4).toBe('ignore');
    });

    it('returns { classification: "ignore" } on touchmove with 3+ touches', () => {
      const result = handler.handleTouchMove([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
        { clientX: 150, clientY: 200 },
      ]);
      expect(result).toEqual({ classification: 'ignore' });
      expect(result.pinchDelta).toBeUndefined();
      expect(result.panDelta).toBeUndefined();
    });

    it('resets multi-touch tracking if a 3rd touch intervenes during a 2-finger gesture', () => {
      handler.handleTouchStart([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      expect(handler.isMultiTouchActive()).toBe(true);

      // Palm contacts the screen -> 3 touches
      const palmResult = handler.handleTouchMove([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
        { clientX: 500, clientY: 500 },
      ]);
      expect(palmResult.classification).toBe('ignore');
      expect(handler.isMultiTouchActive()).toBe(false);
    });
  });

  describe('Reset on Touch End', () => {
    it('resets internal state completely when handleTouchEnd is called', () => {
      handler.handleTouchStart([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      expect(handler.isMultiTouchActive()).toBe(true);
      expect(handler.getCurrentClassification()).toBe('pinch-zoom');

      handler.handleTouchEnd();

      expect(handler.isMultiTouchActive()).toBe(false);
      expect(handler.getCurrentClassification()).toBeNull();
    });

    it('begins a fresh gesture cleanly after touch end without jumping', () => {
      // First gesture: 2-finger zoom
      handler.handleTouchStart([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      handler.handleTouchMove([
        { clientX: 80, clientY: 100 },
        { clientX: 220, clientY: 100 },
      ]);
      handler.handleTouchEnd();

      // Second gesture: 1-finger draw at different location
      const drawStart = handler.handleTouchStart([{ clientX: 500, clientY: 500 }]);
      expect(drawStart).toBe('draw');

      const drawMove = handler.handleTouchMove([{ clientX: 510, clientY: 510 }]);
      expect(drawMove).toEqual({ classification: 'draw' });
    });
  });

  describe('TouchList Compatibility & Defensive Edge Cases', () => {
    it('handles DOM TouchList mock object with item(i) and length', () => {
      const mockTouchList = {
        0: { clientX: 100, clientY: 200 },
        1: { clientX: 300, clientY: 200 },
        length: 2,
        item(index: number) {
          return (this as any)[index];
        },
      } as unknown as TouchList;

      const classification = handler.handleTouchStart(mockTouchList);
      expect(classification).toBe('pinch-zoom');

      const moveTouchList = {
        0: { clientX: 80, clientY: 200 },
        1: { clientX: 320, clientY: 200 },
        length: 2,
        item(index: number) {
          return (this as any)[index];
        },
      } as unknown as TouchList;

      const result = handler.handleTouchMove(moveTouchList);
      expect(result.classification).toBe('pinch-zoom');
      expect(result.pinchDelta!.scaleDelta).toBeCloseTo(240 / 200, 4);
    });

    it('safely handles empty array or null touches without throwing', () => {
      expect(handler.handleTouchStart([])).toBe('ignore');
      expect(handler.handleTouchMove([])).toEqual({ classification: 'ignore' });
      expect(handler.handleTouchStart(null as any)).toBe('ignore');
      expect(handler.handleTouchMove(undefined as any)).toEqual({ classification: 'ignore' });
    });

    it('filters out touches with invalid or NaN coordinates', () => {
      const corruptedTouches = [
        { clientX: NaN, clientY: 100 },
        { clientX: 100, clientY: 100 },
      ] as any;

      // Only 1 valid touch point remains -> classified as draw
      expect(handler.handleTouchStart(corruptedTouches)).toBe('draw');
    });

    it('handles touchmove without preceding touchstart by initializing baseline', () => {
      const result = handler.handleTouchMove([
        { clientX: 100, clientY: 100 },
        { clientX: 200, clientY: 100 },
      ]);
      expect(result.classification).toBe('pinch-zoom');
      expect(result.pinchDelta!.scaleDelta).toBe(1.0);
      expect(result.pinchDelta!.centerScreenX).toBe(150);
      expect(result.pinchDelta!.centerScreenY).toBe(100);
    });
  });

  describe('Pure Geometry Helper Utilities', () => {
    it('calculates getTouchDistance accurately', () => {
      const p1: TouchPoint = { clientX: 0, clientY: 0 };
      const p2: TouchPoint = { clientX: 30, clientY: 40 };
      expect(getTouchDistance(p1, p2)).toBe(50);
    });

    it('calculates getTouchCenter accurately', () => {
      const p1: TouchPoint = { clientX: 100, clientY: 200 };
      const p2: TouchPoint = { clientX: 300, clientY: 400 };
      const center = getTouchCenter(p1, p2);
      expect(center).toEqual({ x: 200, y: 300 });
    });

    it('normalizes touch arrays and strips malformed entries', () => {
      const normalized = normalizeTouches([
        { clientX: 10, clientY: 20 },
        { clientX: NaN, clientY: 30 },
        null as any,
        { clientX: 40, clientY: 50 },
      ]);
      expect(normalized).toEqual([
        { clientX: 10, clientY: 20 },
        { clientX: 40, clientY: 50 },
      ]);
    });
  });
});
