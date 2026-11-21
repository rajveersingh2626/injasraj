import { LaserPoint } from '@/types/whiteboard';

/**
 * LaserTrailEngine
 *
 * Implements an Excalidraw-grade decaying trajectory for the whiteboard laser pointer.
 * Maintains a rolling timestamped queue of coordinate points and calculates elapsed
 * age and decaying opacity across the trajectory lifetime.
 */
export class LaserTrailEngine {
  private lifespanMs: number;
  private points: LaserPoint[] = [];

  constructor(lifespanMs: number = 1200) {
    this.lifespanMs = typeof lifespanMs === 'number' && lifespanMs > 0 ? lifespanMs : 1200;
  }

  /**
   * Appends a coordinate point to the laser trajectory queue.
   */
  addPoint(x: number, y: number, timestamp: number = Date.now()): void {
    this.points.push({ x, y, timestamp });
  }

  /**
   * Prunes points older than lifespanMs relative to currentTime, computes decayed
   * opacity for each surviving point (clamped between 0 and 1), and returns them.
   */
  getActivePoints(currentTime: number = Date.now()): LaserPoint[] {
    // Prune expired points where (currentTime - pt.timestamp) > lifespanMs
    this.points = this.points.filter((pt) => currentTime - pt.timestamp <= this.lifespanMs);

    return this.points.map((pt) => {
      const age = currentTime - pt.timestamp;
      const rawOpacity = 1 - age / this.lifespanMs;
      const opacity = Math.min(1, Math.max(0, rawOpacity));

      return {
        x: pt.x,
        y: pt.y,
        timestamp: pt.timestamp,
        opacity,
      };
    });
  }

  /**
   * Clears all points in the queue immediately.
   */
  clear(): void {
    this.points = [];
  }

  /**
   * Returns configured trail lifespan in milliseconds.
   */
  getLifespan(): number {
    return this.lifespanMs;
  }
}
