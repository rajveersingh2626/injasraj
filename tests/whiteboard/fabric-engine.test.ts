import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  FabricWhiteboardEngine,
  DEFAULT_HIGHLIGHTER_OPACITY,
  DEFAULT_STICKY_COLOR,
  DEFAULT_STICKY_WIDTH,
  DEFAULT_STICKY_HEIGHT,
  DEFAULT_STROKE_PROPERTIES,
  isPointInObject,
} from '../../src/lib/whiteboard/fabric-engine';
import {
  DEFAULT_VIRTUAL_WIDTH,
  DEFAULT_VIRTUAL_HEIGHT,
} from '../../src/lib/whiteboard/viewport-transform';
import type { WhiteboardToolType, StrokeProperties } from '../../src/types/whiteboard';

describe('FabricWhiteboardEngine', () => {
  let engine: FabricWhiteboardEngine;

  beforeEach(() => {
    engine = new FabricWhiteboardEngine();
  });

  afterEach(() => {
    engine.destroy();
  });

  describe('Initialization & Coordinate Space', () => {
    it('initializes in canonical 1920x1080 virtual coordinate space by default', () => {
      const dimensions = engine.getVirtualDimensions();
      expect(dimensions.virtualWidth).toBe(DEFAULT_VIRTUAL_WIDTH);
      expect(dimensions.virtualHeight).toBe(DEFAULT_VIRTUAL_HEIGHT);
      expect(engine.getActiveTool()).toBe('select');
      expect(engine.getObjects()).toEqual([]);
      expect(engine.getBackgroundImage()).toBeNull();
    });

    it('supports custom virtual coordinate space options', () => {
      const custom = new FabricWhiteboardEngine(undefined, {
        virtualWidth: 2560,
        virtualHeight: 1440,
      });
      const dimensions = custom.getVirtualDimensions();
      expect(dimensions.virtualWidth).toBe(2560);
      expect(dimensions.virtualHeight).toBe(1440);
      custom.destroy();
    });

    it('safely attaches to an HTML5 Canvas element in JSDOM headless environment without throwing', () => {
      const canvas = document.createElement('canvas');
      const canvasEngine = new FabricWhiteboardEngine(canvas);

      expect(canvas.width).toBe(DEFAULT_VIRTUAL_WIDTH);
      expect(canvas.height).toBe(DEFAULT_VIRTUAL_HEIGHT);
      expect(canvasEngine.getObjects()).toEqual([]);
      canvasEngine.destroy();
    });

    it('initializes with default stroke properties', () => {
      const props = engine.getStrokeProperties();
      expect(props.color).toBe(DEFAULT_STROKE_PROPERTIES.color);
      expect(props.width).toBe(DEFAULT_STROKE_PROPERTIES.width);
      expect(props.opacity).toBe(1.0);
      expect(props.fill).toBe('transparent');
    });
  });

  describe('Tool Switching & Stroke Properties', () => {
    it('switches between whiteboard tools', () => {
      const tools: WhiteboardToolType[] = [
        'pen',
        'pencil',
        'highlighter',
        'eraser',
        'rect',
        'circle',
        'triangle',
        'line',
        'arrow',
        'text',
        'sticky',
        'laser',
        'select',
        'pan',
      ];

      for (const tool of tools) {
        engine.setTool(tool);
        expect(engine.getActiveTool()).toBe(tool);
      }
    });

    it('sets semi-transparent opacity (0.35) by default when switching to highlighter', () => {
      engine.setTool('highlighter');
      expect(engine.getActiveTool()).toBe('highlighter');
      expect(engine.getStrokeProperties().opacity).toBe(DEFAULT_HIGHLIGHTER_OPACITY);
    });

    it('allows custom opacity override when switching to highlighter', () => {
      engine.setTool('highlighter', { opacity: 0.5 });
      expect(engine.getStrokeProperties().opacity).toBe(0.5);
    });

    it('restores opacity to 1.0 when switching from highlighter back to pen', () => {
      engine.setTool('highlighter');
      expect(engine.getStrokeProperties().opacity).toBe(DEFAULT_HIGHLIGHTER_OPACITY);

      engine.setTool('pen');
      expect(engine.getActiveTool()).toBe('pen');
      expect(engine.getStrokeProperties().opacity).toBe(1.0);
    });

    it('updates stroke properties partially without altering untouched attributes', () => {
      engine.setStrokeProperties({ color: '#2563EB' });
      expect(engine.getStrokeProperties().color).toBe('#2563EB');
      expect(engine.getStrokeProperties().width).toBe(3);

      engine.setStrokeProperties({ width: 8, fill: '#EFF6FF' });
      expect(engine.getStrokeProperties().width).toBe(8);
      expect(engine.getStrokeProperties().fill).toBe('#EFF6FF');
      expect(engine.getStrokeProperties().color).toBe('#2563EB');
    });

    it('clamps stroke width and opacity defensively', () => {
      engine.setStrokeProperties({ width: -5 });
      expect(engine.getStrokeProperties().width).toBe(1);

      engine.setStrokeProperties({ opacity: 1.5 });
      expect(engine.getStrokeProperties().opacity).toBe(1.0);

      engine.setStrokeProperties({ opacity: -0.2 });
      expect(engine.getStrokeProperties().opacity).toBe(0.0);
    });
  });

  describe('Vector Geometric Shapes Generation', () => {
    it('creates a rectangle shape with stroke and fill properties', () => {
      const addedSpy = vi.fn();
      engine.onObjectAdded(addedSpy);

      engine.setStrokeProperties({ color: '#DC2626', width: 4, fill: '#FEE2E2' });
      const rect = engine.addShape('rect', { left: 200, top: 150, width: 300, height: 200 });

      expect(rect.type).toBe('rect');
      expect(rect.id).toBeDefined();
      expect(rect.left).toBe(200);
      expect(rect.top).toBe(150);
      expect(rect.width).toBe(300);
      expect(rect.height).toBe(200);
      expect(rect.stroke).toBe('#DC2626');
      expect(rect.strokeWidth).toBe(4);
      expect(rect.fill).toBe('#FEE2E2');
      expect(rect.selectable).toBe(true);

      expect(addedSpy).toHaveBeenCalledTimes(1);
      expect(addedSpy).toHaveBeenCalledWith(rect);
      expect(engine.getObjects()).toContainEqual(rect);
    });

    it('creates a circle shape with radius and center offset', () => {
      const circle = engine.addShape('circle', { left: 100, top: 100, radius: 50 });

      expect(circle.type).toBe('circle');
      expect(circle.radius).toBe(50);
      expect(circle.width).toBe(100);
      expect(circle.height).toBe(100);
      expect(engine.getObjects()).toHaveLength(1);
    });

    it('creates a triangle shape with width and height', () => {
      const triangle = engine.addShape('triangle', { left: 50, top: 50, width: 120, height: 160 });

      expect(triangle.type).toBe('triangle');
      expect(triangle.width).toBe(120);
      expect(triangle.height).toBe(160);
      expect(engine.getObjects()).toHaveLength(1);
    });

    it('creates a line shape with endpoints', () => {
      const line = engine.addShape('line', { x1: 50, y1: 50, x2: 250, y2: 150 });

      expect(line.type).toBe('line');
      expect(line.x1).toBe(50);
      expect(line.y1).toBe(50);
      expect(line.x2).toBe(250);
      expect(line.y2).toBe(150);
      expect(line.width).toBe(200);
      expect(line.height).toBe(100);
      expect(engine.getObjects()).toHaveLength(1);
    });

    it('creates an arrow shape with directional pointer', () => {
      const arrow = engine.addShape('arrow', {
        x1: 100,
        y1: 100,
        x2: 300,
        y2: 200,
        headLength: 25,
      });

      expect(arrow.type).toBe('arrow');
      expect(arrow.x1).toBe(100);
      expect(arrow.y1).toBe(100);
      expect(arrow.x2).toBe(300);
      expect(arrow.y2).toBe(200);
      expect(arrow.headLength).toBe(25);
      expect(engine.getObjects()).toHaveLength(1);
    });

    it('throws error when adding unsupported shape type', () => {
      // @ts-expect-error test unsupported shape type error handling
      expect(() => engine.addShape('hexagon')).toThrow(/unsupported shape type/i);
    });
  });

  describe('Text & Sticky Notes', () => {
    it('creates an editable text object with font styling', () => {
      const addedSpy = vi.fn();
      engine.onObjectAdded(addedSpy);

      const textObj = engine.addText('Quadratic Formula: x = (-b ± √(b²-4ac)) / 2a', {
        left: 200,
        top: 300,
        fontSize: 32,
        color: '#1E293B',
      });

      expect(textObj.type).toBe('text');
      expect(textObj.text).toContain('Quadratic Formula');
      expect(textObj.fontSize).toBe(32);
      expect(textObj.fill).toBe('#1E293B');
      expect(textObj.selectable).toBe(true);
      expect(addedSpy).toHaveBeenCalledTimes(1);
      expect(engine.getObjects()).toHaveLength(1);
    });

    it('creates a pastel sticky note container with default pastel yellow', () => {
      const addedSpy = vi.fn();
      engine.onObjectAdded(addedSpy);

      const note = engine.addStickyNote('Remember to review homework on page 3');

      expect(note.type).toBe('sticky');
      expect(note.text).toBe('Remember to review homework on page 3');
      expect(note.color).toBe(DEFAULT_STICKY_COLOR);
      expect(note.fill).toBe(DEFAULT_STICKY_COLOR);
      expect(note.width).toBe(DEFAULT_STICKY_WIDTH);
      expect(note.height).toBe(DEFAULT_STICKY_HEIGHT);
      expect(note.rx).toBe(8);
      expect(note.selectable).toBe(true);
      expect(addedSpy).toHaveBeenCalledTimes(1);
    });

    it('creates a pastel sticky note with custom color (e.g. pastel blue or green)', () => {
      const blueNote = engine.addStickyNote('Physics hints', '#BAE6FD');
      expect(blueNote.color).toBe('#BAE6FD');
      expect(blueNote.fill).toBe('#BAE6FD');

      const greenNote = engine.addStickyNote('Chemistry formulas', '#BBF7D0');
      expect(greenNote.color).toBe('#BBF7D0');
      expect(greenNote.fill).toBe('#BBF7D0');
    });
  });

  describe('Freehand Drawing & Path Generation', () => {
    it('creates freehand pen path with smooth curve points', () => {
      engine.setTool('pen', { color: '#16A34A', width: 5 });

      const points = [
        { x: 100, y: 100 },
        { x: 150, y: 120 },
        { x: 200, y: 180 },
        { x: 250, y: 220 },
      ];

      const pathObj = engine.addFreehandPath(points);
      expect(pathObj.type).toBe('path');
      expect(pathObj.tool).toBe('pen');
      expect(pathObj.stroke).toBe('#16A34A');
      expect(pathObj.strokeWidth).toBe(5);
      expect(pathObj.opacity).toBe(1.0);
      expect(pathObj.path).toContain('M 100 100');
      expect(pathObj.path).toContain('Q');
      expect(pathObj.points).toHaveLength(4);
    });

    it('creates freehand highlighter path with default 0.35 opacity and wide stroke', () => {
      engine.setTool('highlighter', { color: '#EAB308' });

      const points = [
        { x: 200, y: 300 },
        { x: 400, y: 300 },
      ];

      const highlighterPath = engine.addFreehandPath(points);
      expect(highlighterPath.type).toBe('path');
      expect(highlighterPath.tool).toBe('highlighter');
      expect(highlighterPath.stroke).toBe('#EAB308');
      expect(highlighterPath.opacity).toBe(DEFAULT_HIGHLIGHTER_OPACITY);
      expect(highlighterPath.strokeWidth).toBeGreaterThanOrEqual(20);
    });

    it('returns null when adding freehand path with empty points', () => {
      const res = engine.addFreehandPath([]);
      expect(res).toBeNull();
      expect(engine.getObjects()).toHaveLength(0);
    });
  });

  describe('Laser Pointer Engine', () => {
    it('emits pointer coordinates without creating permanent canvas objects', () => {
      const laserSpy = vi.fn();
      engine.onLaserMove(laserSpy);
      engine.setTool('laser');

      engine.emitLaser(450, 620);
      engine.emitLaser(460, 625);

      expect(laserSpy).toHaveBeenCalledTimes(2);
      expect(laserSpy).toHaveBeenNthCalledWith(1, { x: 450, y: 620 });
      expect(laserSpy).toHaveBeenNthCalledWith(2, { x: 460, y: 625 });

      // Verifies canvas object graph is 100% clean
      expect(engine.getObjects()).toHaveLength(0);
    });

    it('allows unsubscribing from laser events', () => {
      const laserSpy = vi.fn();
      const unsubscribe = engine.onLaserMove(laserSpy);

      engine.emitLaser(100, 200);
      expect(laserSpy).toHaveBeenCalledTimes(1);

      unsubscribe();
      engine.emitLaser(300, 400);
      expect(laserSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('Background Image & Page Clearing', () => {
    const mockDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('sets locked, unselectable, non-interactive background image', async () => {
      await engine.setBackgroundImage(mockDataUrl);
      const bg = engine.getBackgroundImage();

      expect(bg).not.toBeNull();
      expect(bg.src).toBe(mockDataUrl);
      expect(bg.selectable).toBe(false);
      expect(bg.evented).toBe(false);
      expect(bg.lockMovementX).toBe(true);
      expect(bg.lockMovementY).toBe(true);
    });

    it('clears background image when clearBackgroundImage is invoked', async () => {
      await engine.setBackgroundImage(mockDataUrl);
      expect(engine.getBackgroundImage()).not.toBeNull();

      engine.clearBackgroundImage();
      expect(engine.getBackgroundImage()).toBeNull();
    });

    it('preserves background image when clearCurrentPage(true) is called', async () => {
      await engine.setBackgroundImage(mockDataUrl);
      engine.addShape('rect', { width: 100, height: 100 });
      engine.addText('Worksheet Question 1');
      expect(engine.getObjects()).toHaveLength(2);

      const removedSpy = vi.fn();
      engine.onObjectRemoved(removedSpy);

      // Clear page while preserving background
      engine.clearCurrentPage(true);

      expect(engine.getObjects()).toHaveLength(0);
      expect(removedSpy).toHaveBeenCalledTimes(2);
      expect(engine.getBackgroundImage()).not.toBeNull();
      expect(engine.getBackgroundImage()?.src).toBe(mockDataUrl);
    });

    it('removes background image when clearCurrentPage(false) or clearCurrentPage() is called', async () => {
      await engine.setBackgroundImage(mockDataUrl);
      engine.addShape('circle', { radius: 30 });

      engine.clearCurrentPage(false);

      expect(engine.getObjects()).toHaveLength(0);
      expect(engine.getBackgroundImage()).toBeNull();
    });
  });

  describe('Selection, Modification & Deletion', () => {
    it('selects and deselects objects', () => {
      const rect = engine.addShape('rect');
      const circle = engine.addShape('circle');

      engine.selectObject(rect.id);
      expect(engine.getSelectedObjects()).toEqual([rect]);

      engine.selectObject(circle);
      expect(engine.getSelectedObjects()).toHaveLength(2);

      engine.deselectAll();
      expect(engine.getSelectedObjects()).toHaveLength(0);
    });

    it('deletes selected objects and triggers onObjectRemoved callback', () => {
      const rect = engine.addShape('rect');
      const circle = engine.addShape('circle');
      const text = engine.addText('Note');

      const removedSpy = vi.fn();
      engine.onObjectRemoved(removedSpy);

      engine.selectObject(rect.id);
      engine.selectObject(text.id);

      const deleted = engine.deleteSelectedObjects();
      expect(deleted).toBe(true);
      expect(removedSpy).toHaveBeenCalledTimes(2);
      expect(removedSpy).toHaveBeenCalledWith(rect.id);
      expect(removedSpy).toHaveBeenCalledWith(text.id);

      expect(engine.getObjects()).toHaveLength(1);
      expect(engine.getObjects()[0].id).toBe(circle.id);

      // Second deletion with nothing selected returns false
      expect(engine.deleteSelectedObjects()).toBe(false);
    });

    it('modifies an object by id and notifies onObjectModified', () => {
      const rect = engine.addShape('rect', { left: 100, top: 100 });
      const modifiedSpy = vi.fn();
      engine.onObjectModified(modifiedSpy);

      const updated = engine.modifyObject(rect.id, { left: 350, fill: '#059669' });

      expect(updated.left).toBe(350);
      expect(updated.fill).toBe('#059669');
      expect(modifiedSpy).toHaveBeenCalledTimes(1);
      expect(modifiedSpy).toHaveBeenCalledWith(updated);
    });

    it('returns null when modifying a non-existent object', () => {
      expect(engine.modifyObject('unknown-id', { left: 200 })).toBeNull();
    });

    it('removes an object by id and notifies onObjectRemoved', () => {
      const rect = engine.addShape('rect');
      const removedSpy = vi.fn();
      engine.onObjectRemoved(removedSpy);

      const removed = engine.removeObject(rect.id);
      expect(removed).toBe(true);
      expect(removedSpy).toHaveBeenCalledWith(rect.id);
      expect(engine.getObjects()).toHaveLength(0);

      expect(engine.removeObject('not-found')).toBe(false);
    });
  });

  describe('JSON Export & Reload Parity', () => {
    it('exports and reloads canvas state preserving shapes, text, sticky notes, and background image', async () => {
      const bgDataUrl = 'data:image/png;base64,mock-worksheet-data';
      await engine.setBackgroundImage(bgDataUrl);

      const rect = engine.addShape('rect', { left: 100, top: 150, width: 250, height: 180, fill: '#FEF3C7' });
      const circle = engine.addShape('circle', { left: 400, top: 200, radius: 60, stroke: '#2563EB' });
      const text = engine.addText('Trigonometry Lesson', { left: 50, top: 80, fontSize: 28 });
      const sticky = engine.addStickyNote('Check question 4', '#BAE6FD');

      const exportedJson = engine.exportJson();

      expect(exportedJson.version).toBe('6.0');
      expect(exportedJson.virtualWidth).toBe(DEFAULT_VIRTUAL_WIDTH);
      expect(exportedJson.virtualHeight).toBe(DEFAULT_VIRTUAL_HEIGHT);
      expect(exportedJson.objects).toHaveLength(4);
      expect(exportedJson.backgroundImage).not.toBeNull();
      expect(exportedJson.backgroundImage.src).toBe(bgDataUrl);

      // Deep clone check: mutating exportedJson does not alter engine
      exportedJson.objects[0].left = 9999;
      expect(engine.getObjectById(rect.id)?.left).toBe(100);

      // Create a fresh engine and reload the exported JSON
      const targetEngine = new FabricWhiteboardEngine();
      await targetEngine.loadJson(exportedJson);

      expect(targetEngine.getObjects()).toHaveLength(4);
      expect(targetEngine.getBackgroundImage()).not.toBeNull();
      expect(targetEngine.getBackgroundImage()?.src).toBe(bgDataUrl);
      expect(targetEngine.getObjectById(circle.id)?.radius).toBe(60);
      expect(targetEngine.getObjectById(text.id)?.text).toBe('Trigonometry Lesson');
      expect(targetEngine.getObjectById(sticky.id)?.color).toBe('#BAE6FD');

      targetEngine.destroy();
    });

    it('throws error when loadJson receives invalid payload', async () => {
      await expect(engine.loadJson(null)).rejects.toThrow(/invalid json/i);
      await expect(engine.loadJson(undefined)).rejects.toThrow(/invalid json/i);
    });
  });

  describe('Geometric Hit-Testing & Eraser', () => {
    it('accurately hit-tests rectangle, circle, and sticky notes', () => {
      const rect = { type: 'rect', left: 100, top: 100, width: 200, height: 100 };
      expect(isPointInObject({ x: 150, y: 150 }, rect)).toBe(true);
      expect(isPointInObject({ x: 50, y: 50 }, rect)).toBe(false);

      const circle = { type: 'circle', left: 300, top: 300, radius: 50, width: 100, height: 100 };
      expect(isPointInObject({ x: 350, y: 350 }, circle)).toBe(true);
      expect(isPointInObject({ x: 420, y: 420 }, circle)).toBe(false);

      const sticky = { type: 'sticky', left: 500, top: 500, width: 200, height: 180 };
      expect(isPointInObject({ x: 600, y: 600 }, sticky)).toBe(true);
      expect(isPointInObject({ x: 100, y: 100 }, sticky)).toBe(false);
    });

    it('accurately hit-tests lines and freehand paths with stroke tolerance', () => {
      const line = { type: 'line', x1: 100, y1: 100, x2: 300, y2: 100, strokeWidth: 4 };
      expect(isPointInObject({ x: 200, y: 102 }, line)).toBe(true);
      expect(isPointInObject({ x: 200, y: 150 }, line)).toBe(false);

      const path = {
        type: 'path',
        points: [
          { x: 100, y: 100 },
          { x: 150, y: 150 },
          { x: 200, y: 200 },
        ],
        strokeWidth: 6,
      };
      expect(isPointInObject({ x: 152, y: 148 }, path)).toBe(true);
      expect(isPointInObject({ x: 50, y: 50 }, path)).toBe(false);
    });
  });

  describe('DOM Pointer Events & Interactive Eraser / Drawing Simulation', () => {
    it('dispatches pointer events on canvas element to trigger drawing, selection, and object-level erasure', () => {
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      // Mock getBoundingClientRect
      canvas.getBoundingClientRect = () => ({
        left: 0,
        top: 0,
        width: 1920,
        height: 1080,
        right: 1920,
        bottom: 1080,
        x: 0,
        y: 0,
        toJSON: () => {},
      });

      const interactiveEngine = new FabricWhiteboardEngine(canvas);

      // 1. Drawing a freehand line with pen
      interactiveEngine.setTool('pen', { color: '#2563EB', width: 4 });

      canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 100, clientY: 100 }));
      canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 150, clientY: 150 }));
      canvas.dispatchEvent(new MouseEvent('pointerup', { clientX: 200, clientY: 200 }));

      expect(interactiveEngine.getObjects()).toHaveLength(1);
      const drawnPath = interactiveEngine.getObjects()[0];
      expect(drawnPath.type).toBe('path');
      expect(drawnPath.stroke).toBe('#2563EB');

      // 2. Select tool selection
      interactiveEngine.setTool('select');
      canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 150, clientY: 150 }));
      expect(interactiveEngine.getSelectedObjects()).toHaveLength(1);

      // 3. Laser tool moves
      const laserSpy = vi.fn();
      interactiveEngine.onLaserMove(laserSpy);
      interactiveEngine.setTool('laser');
      canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 400, clientY: 400 }));
      canvas.dispatchEvent(new MouseEvent('pointermove', { clientX: 410, clientY: 415 }));
      expect(laserSpy).toHaveBeenCalled();

      // 4. Object-level eraser removes hit object
      interactiveEngine.setTool('eraser');
      const removedSpy = vi.fn();
      interactiveEngine.onObjectRemoved(removedSpy);

      canvas.dispatchEvent(new MouseEvent('pointerdown', { clientX: 150, clientY: 150, buttons: 1 }));
      expect(interactiveEngine.getObjects()).toHaveLength(0);
      expect(removedSpy).toHaveBeenCalledWith(drawnPath.id);

      interactiveEngine.destroy();
    });
  });

  describe('Canvas 2D Visual Rendering Engine', () => {
    function createMockContext(): any {
      return {
        clearRect: vi.fn(),
        save: vi.fn(),
        restore: vi.fn(),
        translate: vi.fn(),
        scale: vi.fn(),
        fillRect: vi.fn(),
        strokeRect: vi.fn(),
        beginPath: vi.fn(),
        closePath: vi.fn(),
        moveTo: vi.fn(),
        lineTo: vi.fn(),
        quadraticCurveTo: vi.fn(),
        arc: vi.fn(),
        rect: vi.fn(),
        roundRect: vi.fn(),
        stroke: vi.fn(),
        fill: vi.fn(),
        fillText: vi.fn(),
        measureText: vi.fn(() => ({ width: 50 })),
        drawImage: vi.fn(),
        setLineDash: vi.fn(),
      };
    }

    it('renders virtual canvas boundary, grid, objects, and selection cleanly', async () => {
      const mockCtx = createMockContext();
      const testEngine = new FabricWhiteboardEngine();

      testEngine.setGridType('lines');
      expect(testEngine.getGridType()).toBe('lines');

      // Add objects of various types
      testEngine.addShape('rect', { left: 10, top: 10, width: 100, height: 80, fill: '#ff0000' });
      testEngine.addShape('circle', { left: 200, top: 200, radius: 40 });
      testEngine.addShape('triangle', { left: 400, top: 200, width: 80, height: 80 });
      testEngine.addShape('line', { x1: 50, y1: 50, x2: 250, y2: 50 });
      testEngine.addShape('arrow', { x1: 50, y1: 100, x2: 250, y2: 100 });
      testEngine.addText('Hello World', { left: 300, top: 50 });
      testEngine.addStickyNote('Note Content', '#FEF08A', { left: 500, top: 100 });
      testEngine.addFreehandPath([{ x: 10, y: 10 }, { x: 20, y: 20 }]);

      // Select one object
      const allObjs = testEngine.getObjects();
      testEngine.selectObject(allObjs[0].id);

      testEngine.render(mockCtx);

      expect(mockCtx.clearRect).toHaveBeenCalled();
      expect(mockCtx.save).toHaveBeenCalled();
      expect(mockCtx.fillRect).toHaveBeenCalled();
      expect(mockCtx.stroke).toHaveBeenCalled();
      expect(mockCtx.restore).toHaveBeenCalled();

      testEngine.destroy();
    });

    it('handles background image and dots grid type', async () => {
      const mockCtx = createMockContext();
      const testEngine = new FabricWhiteboardEngine();
      testEngine.setGridType('dots');
      await testEngine.setBackgroundImage('data:image/png;base64,mock');

      testEngine.render(mockCtx);
      expect(mockCtx.arc).toHaveBeenCalled(); // dots grid
      testEngine.destroy();
    });

    it('handles canvas attachment, resize, and requestRender debouncing', async () => {
      const canvas = document.createElement('canvas');
      const testEngine = new FabricWhiteboardEngine();
      testEngine.attachCanvas(canvas);

      expect(canvas.width).toBe(DEFAULT_VIRTUAL_WIDTH);
      expect(canvas.height).toBe(DEFAULT_VIRTUAL_HEIGHT);

      testEngine.resize(1280, 720);
      expect(canvas.width).toBe(1280);
      expect(canvas.height).toBe(720);

      // requestRender should not throw in headless environment
      expect(() => testEngine.requestRender()).not.toThrow();

      testEngine.destroy();
    });
  });
});
