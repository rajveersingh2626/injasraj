import { describe, it, expect, vi } from 'vitest';
import { FabricWhiteboardEngine } from '../../src/lib/whiteboard/fabric-engine';

describe('Infinite Workable Canvas (Unconstrained Coordinates)', () => {
  it('allows adding freehand paths with negative and unbounded coordinates without clipping', () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1920;
    canvas.height = 1080;

    const engine = new FabricWhiteboardEngine(canvas, {
      virtualWidth: 1920,
      virtualHeight: 1080,
    });

    // Add path spanning negative and extended coordinates (-500 to +3000)
    const points = [
      { x: -500, y: -200 },
      { x: 0, y: 0 },
      { x: 1920, y: 1080 },
      { x: 3000, y: 2500 },
    ];

    const added = engine.addFreehandPath(points);
    expect(added).toBeDefined();
    expect(added.points).toEqual(points);
    expect(added.points[0].x).toBe(-500);
    expect(added.points[3].x).toBe(3000);

    const objects = engine.getObjects();
    expect(objects.length).toBe(1);
    expect(objects[0].points).toEqual(points);

    engine.destroy();
  });

  it('allows placing shapes and notes outside the canonical 1920x1080 frame without clamping', () => {
    const canvas = document.createElement('canvas');
    const engine = new FabricWhiteboardEngine(canvas);

    const shape = engine.addShape('rect', {
      left: -800,
      top: -400,
      width: 300,
      height: 200,
    });

    expect(shape.left).toBe(-800);
    expect(shape.top).toBe(-400);

    const note = engine.addStickyNote('Outside margin note', undefined, {
      left: 2500,
      top: 1500,
    });

    expect(note.left).toBe(2500);
    expect(note.top).toBe(1500);

    engine.destroy();
  });
});
