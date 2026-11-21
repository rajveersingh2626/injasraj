import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LaserTrailEngine } from '../../src/lib/whiteboard/laser-trail';

describe('LaserTrailEngine', () => {
  let engine: LaserTrailEngine;

  beforeEach(() => {
    engine = new LaserTrailEngine();
  });

  describe('Initialization & Lifespan', () => {
    it('initializes with default lifespan of 1200ms', () => {
      expect(engine.getLifespan()).toBe(1200);
      expect(engine.getActivePoints()).toEqual([]);
    });

    it('initializes with custom lifespan', () => {
      const customEngine = new LaserTrailEngine(800);
      expect(customEngine.getLifespan()).toBe(800);
    });

    it('falls back to 1200ms default when provided invalid or non-positive lifespan', () => {
      const negativeEngine = new LaserTrailEngine(-500);
      expect(negativeEngine.getLifespan()).toBe(1200);

      const zeroEngine = new LaserTrailEngine(0);
      expect(zeroEngine.getLifespan()).toBe(1200);

      // @ts-expect-error test invalid parameter type fallback
      const invalidEngine = new LaserTrailEngine('invalid');
      expect(invalidEngine.getLifespan()).toBe(1200);
    });
  });

  describe('addPoint', () => {
    it('records points with given coordinates and current system timestamp by default', () => {
      const before = Date.now();
      engine.addPoint(150, 250);
      const after = Date.now();

      const active = engine.getActivePoints();
      expect(active).toHaveLength(1);
      expect(active[0].x).toBe(150);
      expect(active[0].y).toBe(250);
      expect(active[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(active[0].timestamp).toBeLessThanOrEqual(after);
    });

    it('records points with explicit custom timestamp', () => {
      const customTime = 1700000000000;
      engine.addPoint(100, 200, customTime);

      const active = engine.getActivePoints(customTime);
      expect(active).toHaveLength(1);
      expect(active[0].x).toBe(100);
      expect(active[0].y).toBe(200);
      expect(active[0].timestamp).toBe(customTime);
    });

    it('preserves multiple points added in sequence', () => {
      const baseTime = 1000000;
      engine.addPoint(10, 20, baseTime);
      engine.addPoint(30, 40, baseTime + 100);
      engine.addPoint(50, 60, baseTime + 200);

      const active = engine.getActivePoints(baseTime + 250);
      expect(active).toHaveLength(3);
      expect(active[0]).toMatchObject({ x: 10, y: 20, timestamp: baseTime });
      expect(active[1]).toMatchObject({ x: 30, y: 40, timestamp: baseTime + 100 });
      expect(active[2]).toMatchObject({ x: 50, y: 60, timestamp: baseTime + 200 });
    });
  });

  describe('Pruning of Expired Points', () => {
    it('prunes points strictly older than lifespanMs', () => {
      const baseTime = 1000000;
      // Lifespan is 1200ms
      // Point 1: 1500ms old (should be pruned)
      engine.addPoint(10, 10, baseTime - 1500);
      // Point 2: 1201ms old (should be pruned)
      engine.addPoint(20, 20, baseTime - 1201);
      // Point 3: 1200ms old (boundary condition: age == lifespanMs, NOT > lifespanMs, retained)
      engine.addPoint(30, 30, baseTime - 1200);
      // Point 4: 600ms old (active)
      engine.addPoint(40, 40, baseTime - 600);
      // Point 5: 0ms old (active)
      engine.addPoint(50, 50, baseTime);

      const active = engine.getActivePoints(baseTime);
      expect(active).toHaveLength(3);
      expect(active.map((p) => p.x)).toEqual([30, 40, 50]);
    });

    it('progressively prunes older points as time elapses', () => {
      const baseTime = 5000000;
      engine.addPoint(10, 10, baseTime);
      engine.addPoint(20, 20, baseTime + 500);
      engine.addPoint(30, 30, baseTime + 1000);

      // At baseTime + 600: all 3 points active (ages: 600, 100, -400)
      expect(engine.getActivePoints(baseTime + 600)).toHaveLength(3);

      // At baseTime + 1300: first point age is 1300ms (> 1200ms), pruned
      const active1 = engine.getActivePoints(baseTime + 1300);
      expect(active1).toHaveLength(2);
      expect(active1.map((p) => p.x)).toEqual([20, 30]);

      // At baseTime + 1800: second point age is 1300ms, pruned
      const active2 = engine.getActivePoints(baseTime + 1800);
      expect(active2).toHaveLength(1);
      expect(active2[0].x).toBe(30);

      // At baseTime + 2300: third point age is 1300ms, all pruned
      const active3 = engine.getActivePoints(baseTime + 2300);
      expect(active3).toHaveLength(0);
    });

    it('pruning permanently updates internal queue', () => {
      const baseTime = 1000000;
      engine.addPoint(10, 10, baseTime - 2000); // Expired
      engine.addPoint(20, 20, baseTime); // Active

      // First call prunes point 1
      const firstCall = engine.getActivePoints(baseTime);
      expect(firstCall).toHaveLength(1);

      // Second call at same time confirms point 1 is gone
      const secondCall = engine.getActivePoints(baseTime);
      expect(secondCall).toHaveLength(1);
      expect(secondCall[0].x).toBe(20);
    });
  });

  describe('Opacity Decay Calculation', () => {
    it('computes linear opacity decay proportional to age', () => {
      const lifespan = 1200;
      engine = new LaserTrailEngine(lifespan);
      const currentTime = 2000000;

      // Fresh point: age 0ms -> opacity 1.0
      engine.addPoint(0, 0, currentTime);
      // Quarter-aged point: age 300ms -> opacity 1 - (300/1200) = 0.75
      engine.addPoint(25, 25, currentTime - 300);
      // Half-aged point: age 600ms -> opacity 1 - (600/1200) = 0.5
      engine.addPoint(50, 50, currentTime - 600);
      // Three-quarter-aged point: age 900ms -> opacity 1 - (900/1200) = 0.25
      engine.addPoint(75, 75, currentTime - 900);
      // Full-lifespan point: age 1200ms -> opacity 1 - (1200/1200) = 0.0
      engine.addPoint(100, 100, currentTime - 1200);

      const active = engine.getActivePoints(currentTime);
      expect(active).toHaveLength(5);

      expect(active[0].opacity).toBe(1.0);
      expect(active[1].opacity).toBeCloseTo(0.75, 5);
      expect(active[2].opacity).toBeCloseTo(0.5, 5);
      expect(active[3].opacity).toBeCloseTo(0.25, 5);
      expect(active[4].opacity).toBeCloseTo(0.0, 5);
    });

    it('clamps opacity to [0, 1] range even with clock skew or future timestamps', () => {
      const baseTime = 1000000;
      // Point with future timestamp (currentTime < timestamp -> age < 0)
      engine.addPoint(10, 10, baseTime + 500);

      const active = engine.getActivePoints(baseTime);
      expect(active).toHaveLength(1);
      expect(active[0].opacity).toBe(1.0);
    });

    it('computes correct opacity with custom lifespanMs values', () => {
      const customLifespan = 500;
      const customEngine = new LaserTrailEngine(customLifespan);
      const now = 1000000;

      customEngine.addPoint(10, 10, now - 100); // 80% opacity
      customEngine.addPoint(20, 20, now - 250); // 50% opacity
      customEngine.addPoint(30, 30, now - 400); // 20% opacity

      const active = customEngine.getActivePoints(now);
      expect(active[0].opacity).toBeCloseTo(0.8, 5);
      expect(active[1].opacity).toBeCloseTo(0.5, 5);
      expect(active[2].opacity).toBeCloseTo(0.2, 5);
    });
  });

  describe('clear', () => {
    it('completely empties active points from the queue', () => {
      const now = Date.now();
      engine.addPoint(10, 20, now);
      engine.addPoint(30, 40, now);
      engine.addPoint(50, 60, now);

      expect(engine.getActivePoints(now)).toHaveLength(3);

      engine.clear();

      expect(engine.getActivePoints(now)).toEqual([]);
    });

    it('allows continuing to record points normally after clear()', () => {
      const now = 2000000;
      engine.addPoint(1, 1, now);
      engine.clear();
      expect(engine.getActivePoints(now)).toHaveLength(0);

      engine.addPoint(99, 99, now);
      const active = engine.getActivePoints(now);
      expect(active).toHaveLength(1);
      expect(active[0]).toMatchObject({ x: 99, y: 99, opacity: 1 });
    });
  });

  describe('Rapid Point Insertion & Performance', () => {
    it('handles rapid insertion of 10,000 points without performance degradation', () => {
      const baseTime = 1000000;
      const pointCount = 10000;

      const startTime = performance.now();
      for (let i = 0; i < pointCount; i++) {
        // Points spaced 0.1ms apart across 1000ms total duration
        engine.addPoint(i % 1000, (i * 2) % 1000, baseTime + i * 0.1);
      }
      const insertionDuration = performance.now() - startTime;

      // Rapid insertion of 10,000 points must finish in < 50ms
      expect(insertionDuration).toBeLessThan(50);

      // Query active points at end of trajectory
      const queryStart = performance.now();
      const activePoints = engine.getActivePoints(baseTime + 1000);
      const queryDuration = performance.now() - queryStart;

      // Retrieval and opacity calculation should be sub-millisecond or fast (< 30ms)
      expect(queryDuration).toBeLessThan(30);
      expect(activePoints.length).toBeGreaterThan(0);
    });

    it('successfully prunes bulk points when time advances beyond lifespan', () => {
      const baseTime = 1000000;
      const pointCount = 5000;

      for (let i = 0; i < pointCount; i++) {
        engine.addPoint(i, i, baseTime + i);
      }

      // At baseTime + 5000 + 1200 (all points expired)
      const afterExpiry = engine.getActivePoints(baseTime + 5000 + 1201);
      expect(afterExpiry).toHaveLength(0);

      // Confirm queue was cleared to zero
      expect(engine.getActivePoints(baseTime + 5000 + 1201)).toHaveLength(0);
    });
  });

  describe('Data Immutability & Safety', () => {
    it('ensures returned active points array is safe from external mutations', () => {
      const now = 1000000;
      engine.addPoint(10, 20, now);

      const active = engine.getActivePoints(now);
      expect(active).toHaveLength(1);

      // Mutate returned object
      active[0].x = 999;
      active.push({ x: 888, y: 888, timestamp: now, opacity: 1 });

      // Next query should retain original data
      const nextActive = engine.getActivePoints(now);
      expect(nextActive).toHaveLength(1);
      expect(nextActive[0].x).toBe(10);
    });
  });
});
