import { describe, it, expect } from 'vitest';
import { FabricWhiteboardEngine } from '../../src/lib/whiteboard/fabric-engine';

describe('Excalidraw Complete Suite (Roughness, Marquee Multi-Select, Lock & Z-Order)', () => {
  it('supports hand-drawn roughness on geometric objects', () => {
    const engine = new FabricWhiteboardEngine();

    const rect = engine.addObject({
      id: 'sketch-rect',
      type: 'rect',
      left: 100,
      top: 100,
      width: 200,
      height: 100,
      roughness: 1.5,
    });

    expect(rect.roughness).toBe(1.5);

    // Can toggle default sketch style
    engine.setDefaultRoughness(2.0);
    expect(engine.getDefaultRoughness()).toBe(2.0);
  });

  it('selects multiple objects using marquee bounding box', () => {
    const engine = new FabricWhiteboardEngine();

    engine.addObject({ id: 'obj-1', type: 'rect', left: 10, top: 10, width: 50, height: 50 });
    engine.addObject({ id: 'obj-2', type: 'rect', left: 80, top: 20, width: 50, height: 50 });
    engine.addObject({ id: 'obj-3', type: 'rect', left: 300, top: 300, width: 50, height: 50 });

    // Marquee enclose obj-1 and obj-2, excluding obj-3
    const selected = engine.selectObjectsInBounds({
      minX: 0,
      minY: 0,
      maxX: 150,
      maxY: 100,
    });

    expect(selected.map((o) => o.id)).toEqual(['obj-1', 'obj-2']);
    expect(Array.from(engine.getSelectedObjectIds())).toEqual(['obj-1', 'obj-2']);
  });

  it('locks and unlocks objects, preventing deletion and modification when locked', () => {
    const engine = new FabricWhiteboardEngine();

    const circle = engine.addObject({
      id: 'locked-circle',
      type: 'circle',
      left: 100,
      top: 100,
      radius: 40,
    });

    engine.lockObject('locked-circle');
    expect(engine.isObjectLocked('locked-circle')).toBe(true);

    // Attempting to remove locked object should fail
    const removed = engine.removeObject('locked-circle');
    expect(removed).toBe(false);
    expect(engine.getObjectById('locked-circle')).toBeDefined();

    // Unlock object
    engine.unlockObject('locked-circle');
    expect(engine.isObjectLocked('locked-circle')).toBe(false);

    // Now removal succeeds
    const removedAfterUnlock = engine.removeObject('locked-circle');
    expect(removedAfterUnlock).toBe(true);
    expect(engine.getObjectById('locked-circle')).toBeUndefined();
  });

  it('reorders objects in layer Z-index (bringForward, sendBackward, bringToFront, sendToBack)', () => {
    const engine = new FabricWhiteboardEngine();

    engine.addObject({ id: 'layer-A', type: 'rect' });
    engine.addObject({ id: 'layer-B', type: 'rect' });
    engine.addObject({ id: 'layer-C', type: 'rect' });

    // Initial order: [A, B, C]
    expect(engine.getObjects().map((o) => o.id)).toEqual(['layer-A', 'layer-B', 'layer-C']);

    // Send C backward -> [A, C, B]
    engine.sendBackward('layer-C');
    expect(engine.getObjects().map((o) => o.id)).toEqual(['layer-A', 'layer-C', 'layer-B']);

    // Send C to back -> [C, A, B]
    engine.sendToBack('layer-C');
    expect(engine.getObjects().map((o) => o.id)).toEqual(['layer-C', 'layer-A', 'layer-B']);

    // Bring C forward -> [A, C, B]
    engine.bringForward('layer-C');
    expect(engine.getObjects().map((o) => o.id)).toEqual(['layer-A', 'layer-C', 'layer-B']);

    // Bring A to front -> [C, B, A]
    engine.bringToFront('layer-A');
    expect(engine.getObjects().map((o) => o.id)).toEqual(['layer-C', 'layer-B', 'layer-A']);
  });
});
