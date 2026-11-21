import { describe, it, expect } from 'vitest';
import { FabricWhiteboardEngine } from '../../src/lib/whiteboard/fabric-engine';

describe('Excalidraw Smart Arrowhead Binding & Centered Shape Text', () => {
  it('binds arrow endpoints to shapes and recalculates arrow coordinates when shape moves', () => {
    const engine = new FabricWhiteboardEngine();

    // 1. Create a rectangle at (100, 100) with width 200, height 100
    const rect = engine.addObject({
      id: 'rect-1',
      type: 'rect',
      left: 100,
      top: 100,
      width: 200,
      height: 100,
    });

    // 2. Create an arrow pointing towards rect
    const arrow = engine.addObject({
      id: 'arrow-1',
      type: 'arrow',
      x1: 50,
      y1: 50,
      x2: 100,
      y2: 150, // touching left side middle of rect (left: 100, top: 100 + 50)
    });

    // 3. Bind arrow's end to the rect's left side
    engine.bindArrowToShape('arrow-1', 'rect-1', 'end', 'left');

    const boundArrow = engine.getObjectById('arrow-1');
    expect(boundArrow.endBinding).toEqual({
      targetId: 'rect-1',
      side: 'left',
    });

    // 4. Move rectangle by dx: +50, dy: +40 -> now left: 150, top: 140
    engine.modifyObject('rect-1', { left: 150, top: 140 });

    // Arrow's end coordinate should automatically follow rect's left anchor point
    // left anchor = (left: 150, top + height/2: 140 + 50 = 190)
    const updatedArrow = engine.getObjectById('arrow-1');
    expect(updatedArrow.x2).toBe(150);
    expect(updatedArrow.y2).toBe(190);
  });

  it('sets and updates centered text inside geometric shapes', () => {
    const engine = new FabricWhiteboardEngine();

    const rect = engine.addObject({
      id: 'rect-box',
      type: 'rect',
      left: 200,
      top: 200,
      width: 180,
      height: 80,
    });

    engine.updateShapeText('rect-box', 'Decision Block');

    const updatedRect = engine.getObjectById('rect-box');
    expect(updatedRect.text).toBe('Decision Block');
  });
});
