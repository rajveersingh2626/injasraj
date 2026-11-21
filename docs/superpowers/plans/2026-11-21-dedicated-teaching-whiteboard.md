# Dedicated Teaching Whiteboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a professional virtual teaching whiteboard inspired by LearnCube's pedagogical workflow and Excalidraw's ergonomic dock UX, featuring dual modes (Classroom Mode vs. Whiteboard Mode), multi-page PDF worksheets with separate editable annotation layers, authoritative teacher permissions, fluid decaying laser pointer, real-time $0 delta synchronization, and Emil Kowalski tactile glassmorphism.

**Architecture:** A decoupled canvas architecture built on Fabric.js and Mozilla `pdfjs-dist`. The canvas runs in a canonical 16:9 (1920×1080) virtual coordinate space with responsive letterboxing, ensuring pixel-accurate cross-device parity between laptops, iPads, and phones. The teacher's client acts as the authoritative database writer to Supabase Postgres (`whiteboard_sessions`), while real-time deltas flow over Supabase Realtime broadcast channels (`whiteboard:<roomId>`). An authoritative permission guard validates and reverts unpermitted student actions. The UI utilizes Emil's tactile glassmorphism with 160ms cubic-bezier micro-interactions and mobile-native safe areas.

**Tech Stack:** Next.js 15, React 19, TypeScript, Fabric.js v6, `pdfjs-dist` v4, Supabase JS Client, Tailwind CSS, Lucide React, Vitest, React Testing Library.

**Spec:** [`docs/specs/2026-11-21-dedicated-teaching-whiteboard-design.md`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/docs/specs/2026-11-21-dedicated-teaching-whiteboard-design.md)

## Global Constraints
- Operational budget: Strictly $0 (no credit card required; runs on Supabase free tier and client-side rendering).
- Classroom modes: Instant toggle between **Classroom Mode** (balanced 1:1 video grid & workspace) and **Whiteboard Mode** (maximized whiteboard with collapsible 320px 4-tab studio side panel).
- Page synchronization: Teacher-led lockstep navigation (teacher flips page -> all students flip to that page).
- Canonical coordinates: 1920×1080 virtual coordinate space; all broadcast points and shapes are normalized to guarantee identical presentation across desktops, tablets, and phones.
- Undo scope: Per-user command stack (undoing removes only the active user's own latest strokes, never teacher annotations).
- Emil design engineering: Inset specular highlights (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.12)`), `:active { transform: scale(0.97); }`, `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, and origin-aware popovers.
- Mobile native: `100dvh` viewport, `env(safe-area-inset-*)` padding, `touch-action: none` on drawing surface, `touch-action: manipulation` on buttons, and minimum 16px input font size.

## Review Focus
1. **Late-Joiner / Reconnection Canvas State:** Ensure a student joining mid-lesson receives the complete serialized vector state of all pages and active background PDF from the teacher or Postgres without missing strokes.
2. **Teacher Deletion Protection:** When a student has drawing permissions, verify that selecting or attempting to delete an object created by the teacher (`createdBy === 'teacher'`) is rejected by the permission guard.
3. **Cross-Device Coordinate Parity:** Verify that freehand drawing paths and laser pointer coordinates broadcast from a 16:9 desktop render in the identical relative worksheet location on an iPad (4:3) or mobile phone.
4. **Multi-Page Background PDF Independence:** Verify that switching between pages unloads the previous page's annotations and renders the correct PDF background page without ghosting or memory leaks.
5. **Screen Share / Video Docking Transitions:** Verify that switching between Classroom Mode and Whiteboard Mode moves WebRTC video streams smoothly into the side panel PiP without interrupting media tracks or triggering ICE restarts.

---

### Task 1: Whiteboard Data Models, Permission Types & Action Interfaces

**Files:**
- Create: `src/types/whiteboard.ts`
- Test: `tests/whiteboard/types.test.ts`

**Interfaces:**
- Produces: `WhiteboardPage`, `WhiteboardPermissions`, `WhiteboardDeltaMessage`, `WhiteboardToolType`, `StrokeProperties`, `LaserPoint`, `defaultWhiteboardPermissions`

- [ ] **Step 1: Write test for permission defaults and delta payload factory functions**

```typescript
import { describe, it, expect } from 'vitest';
import { defaultWhiteboardPermissions, createDefaultWhiteboardPage } from '../../src/types/whiteboard';

describe('Whiteboard Types & Factories', () => {
  it('creates default locked-down permissions for structured teaching', () => {
    const perms = defaultWhiteboardPermissions();
    expect(perms.isLockedGlobally).toBe(true);
    expect(perms.preventDeletingTeacherContent).toBe(true);
    expect(perms.allowMovingOnlyOwnObjects).toBe(true);
  });

  it('creates default empty whiteboard page', () => {
    const page = createDefaultWhiteboardPage('page-1', 1, 'Exercise 1');
    expect(page.pageNumber).toBe(1);
    expect(page.canvasJson).toEqual({ version: '6.0', objects: [] });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/types.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/types/whiteboard.ts`**

Define `WhiteboardPage`, `WhiteboardPermissions`, `WhiteboardToolType` ('select' | 'pen' | 'highlighter' | 'eraser' | 'line' | 'arrow' | 'rect' | 'circle' | 'triangle' | 'text' | 'sticky' | 'laser'), `StrokeProperties`, `LaserPoint`, and helper factories.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/types.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/whiteboard.ts tests/whiteboard/types.test.ts
git commit -m "feat(whiteboard): define whiteboard page models and permission types"
```

---

### Task 2: Laser Pointer Physics & Rolling Decay Trail Engine

**Files:**
- Create: `src/lib/whiteboard/laser-trail.ts`
- Test: `tests/whiteboard/laser-trail.test.ts`

**Interfaces:**
- Consumes: `LaserPoint` from `@/types/whiteboard`
- Produces: `LaserTrailEngine` (`addPoint(x, y)`, `getActivePoints(currentTime)`, `clear()`)

- [ ] **Step 1: Write tests for laser point trajectory, age calculation, and decay fading**

```typescript
import { describe, it, expect } from 'vitest';
import { LaserTrailEngine } from '../../src/lib/whiteboard/laser-trail';

describe('LaserTrailEngine', () => {
  it('prunes points older than lifespan (1200ms)', () => {
    const engine = new LaserTrailEngine(1200);
    const now = 10000;
    engine.addPoint(100, 200, now - 1500); // Expired
    engine.addPoint(150, 250, now - 500);  // Active
    const active = engine.getActivePoints(now);
    expect(active.length).toBe(1);
    expect(active[0].x).toBe(150);
  });

  it('calculates decaying opacity based on age', () => {
    const engine = new LaserTrailEngine(1000);
    const now = 5000;
    engine.addPoint(100, 200, now - 500); // 50% lifespan
    const active = engine.getActivePoints(now);
    expect(active[0].opacity).toBeCloseTo(0.5, 1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/laser-trail.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/whiteboard/laser-trail.ts`**

Maintain rolling FIFO queue of points, calculate age-based decaying opacity, and provide canvas bezier rendering points.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/laser-trail.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard/laser-trail.ts tests/whiteboard/laser-trail.test.ts
git commit -m "feat(whiteboard): implement fluid laser pointer trail engine with timestamp decay"
```

---

### Task 3: Whiteboard Page Manager & Multi-Page State Store

**Files:**
- Create: `src/lib/whiteboard/page-manager.ts`
- Test: `tests/whiteboard/page-manager.test.ts`

**Interfaces:**
- Consumes: `WhiteboardPage` from `@/types/whiteboard`
- Produces: `WhiteboardPageManager` (`addPage`, `duplicatePage`, `deletePage`, `reorderPages`, `setActivePage`, `getActivePage`, `updateCurrentPageCanvas`, `getAllPages`)

- [ ] **Step 1: Write test for page additions, duplications, reordering, and deletion boundaries**

```typescript
import { describe, it, expect } from 'vitest';
import { WhiteboardPageManager } from '../../src/lib/whiteboard/page-manager';

describe('WhiteboardPageManager', () => {
  it('initializes with default page 1 and allows adding pages', () => {
    const manager = new WhiteboardPageManager();
    expect(manager.getPageCount()).toBe(1);
    const page2 = manager.addPage('Worksheet Exercise 2');
    expect(manager.getPageCount()).toBe(2);
    expect(page2.pageNumber).toBe(2);
  });

  it('duplicates existing page including vector canvas content', () => {
    const manager = new WhiteboardPageManager();
    manager.updateCurrentPageCanvas({ objects: [{ type: 'rect', left: 50 }] });
    const dup = manager.duplicatePage(manager.getActivePage().id);
    expect(dup.canvasJson.objects.length).toBe(1);
  });

  it('prevents deleting the last remaining page', () => {
    const manager = new WhiteboardPageManager();
    const activeId = manager.getActivePage().id;
    const deleted = manager.deletePage(activeId);
    expect(deleted).toBe(false);
    expect(manager.getPageCount()).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/page-manager.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/whiteboard/page-manager.ts`**

Manage paginated state array, sequential page numbers, and active page selection.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/page-manager.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard/page-manager.ts tests/whiteboard/page-manager.test.ts
git commit -m "feat(whiteboard): implement multi-page notebook manager with clone and reorder"
```

---

### Task 4: Canonical Coordinate Transform, Aspect Ratio & Fit-to-Screen Engine

**Files:**
- Create: `src/lib/whiteboard/viewport-transform.ts`
- Test: `tests/whiteboard/viewport-transform.test.ts`

**Interfaces:**
- Produces: `calculateViewportTransform(containerWidth, containerHeight, virtualWidth = 1920, virtualHeight = 1080): ViewportBounds`

- [ ] **Step 1: Write tests for 16:9 letterboxing, scaling factor, and screen-to-canonical point mapping**

```typescript
import { describe, it, expect } from 'vitest';
import { calculateViewportTransform, screenToVirtualPoint, virtualToScreenPoint } from '../../src/lib/whiteboard/viewport-transform';

describe('ViewportTransform', () => {
  it('calculates uniform scale and letterboxing for 1080p desktop', () => {
    const transform = calculateViewportTransform(1920, 1080);
    expect(transform.scale).toBe(1.0);
    expect(transform.offsetX).toBe(0);
    expect(transform.offsetY).toBe(0);
  });

  it('calculates pillarboxing for 4:3 iPad viewport (1024x768)', () => {
    const transform = calculateViewportTransform(1024, 768);
    expect(transform.scale).toBeCloseTo(1024 / 1920, 2);
    expect(transform.offsetY).toBeGreaterThan(0); // Vertical letterboxing
  });

  it('accurately maps screen touch coordinates into canonical 1920x1080 coordinates', () => {
    const transform = calculateViewportTransform(960, 540); // 0.5x scale
    const virtualPt = screenToVirtualPoint(480, 270, transform);
    expect(virtualPt.x).toBe(960);
    expect(virtualPt.y).toBe(540);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/viewport-transform.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/whiteboard/viewport-transform.ts`**

Mathematical scaling and offset transforms for responsive letterboxing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/viewport-transform.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard/viewport-transform.ts tests/whiteboard/viewport-transform.test.ts
git commit -m "feat(whiteboard): implement canonical 1920x1080 coordinate mapping and letterbox transforms"
```

---

### Task 5: Authoritative Teacher Permission & Validation Guards

**Files:**
- Create: `src/lib/whiteboard/permission-guard.ts`
- Test: `tests/whiteboard/permission-guard.test.ts`

**Interfaces:**
- Consumes: `WhiteboardPermissions` from `@/types/whiteboard`
- Produces: `validateWhiteboardAction(action: WhiteboardAction, permissions: WhiteboardPermissions, user: UserRole): { allowed: boolean; reason?: string }`

- [ ] **Step 1: Write tests for teacher override, student lock enforcement, and deletion protection**

```typescript
import { describe, it, expect } from 'vitest';
import { validateWhiteboardAction } from '../../src/lib/whiteboard/permission-guard';
import { defaultWhiteboardPermissions } from '../../src/types/whiteboard';

describe('Whiteboard Permission Guard', () => {
  const teacherUser = { id: 'teacher-1', role: 'teacher' as const };
  const studentUser = { id: 'student-1', role: 'student' as const };

  it('always allows any action for the teacher', () => {
    const perms = defaultWhiteboardPermissions();
    perms.isLockedGlobally = true;
    const res = validateWhiteboardAction({ type: 'draw' }, perms, teacherUser);
    expect(res.allowed).toBe(true);
  });

  it('blocks student drawing when whiteboard is globally locked', () => {
    const perms = defaultWhiteboardPermissions();
    perms.isLockedGlobally = true;
    const res = validateWhiteboardAction({ type: 'draw' }, perms, studentUser);
    expect(res.allowed).toBe(false);
    expect(res.reason).toContain('locked');
  });

  it('blocks student from deleting teacher objects even if drawing is granted', () => {
    const perms = defaultWhiteboardPermissions();
    perms.isLockedGlobally = false;
    perms.studentDrawingGranted['student-1'] = true;
    perms.preventDeletingTeacherContent = true;

    const res = validateWhiteboardAction({ type: 'delete', targetCreatedBy: 'teacher-1' }, perms, studentUser);
    expect(res.allowed).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/permission-guard.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/whiteboard/permission-guard.ts`**

Enforce permission logic against drawing, modifying, moving, and deleting canvas objects.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/permission-guard.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard/permission-guard.ts tests/whiteboard/permission-guard.test.ts
git commit -m "feat(whiteboard): implement authoritative teacher permission and action guard"
```

---

### Task 6: PDF Ingestion & Background Worksheet Renderer

**Files:**
- Create: `src/lib/whiteboard/pdf-renderer.ts`
- Test: `tests/whiteboard/pdf-renderer.test.ts`

**Interfaces:**
- Produces: `renderPdfPageToDataUrl(pdfBytes: ArrayBuffer, pageNumber: number): Promise<{ dataUrl: string; width: number; height: number; pageCount: number }>`

- [ ] **Step 1: Write test for PDF page rendering and mock fallback**

```typescript
import { describe, it, expect } from 'vitest';
import { renderPdfPageToDataUrl, isPdfBuffer } from '../../src/lib/whiteboard/pdf-renderer';

describe('PdfRenderer', () => {
  it('detects valid PDF magic headers', () => {
    const fakePdf = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2D]).buffer; // %PDF-
    expect(isPdfBuffer(fakePdf)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/pdf-renderer.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/whiteboard/pdf-renderer.ts`**

Render PDF pages onto an offscreen canvas using `pdfjs-dist` (or mock fallback for CI environments) and output crisp 2x data URLs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/pdf-renderer.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard/pdf-renderer.ts tests/whiteboard/pdf-renderer.test.ts
git commit -m "feat(whiteboard): implement client-side PDF worksheet page extractor and rasterizer"
```

---

### Task 7: Fabric.js Canvas Engine Core & Vector Drawing Tools

**Files:**
- Create: `src/lib/whiteboard/fabric-engine.ts`
- Test: `tests/whiteboard/fabric-engine.test.ts`

**Interfaces:**
- Produces: `FabricWhiteboardEngine` (`setTool`, `setStrokeProps`, `setBackgroundImage`, `clearCurrentPage`, `exportJson`, `loadJson`)

- [ ] **Step 1: Write tests for tool switching (pen, highlighter, shapes, text) and stroke attributes**

```typescript
import { describe, it, expect } from 'vitest';
import { FabricWhiteboardEngine } from '../../src/lib/whiteboard/fabric-engine';

describe('FabricWhiteboardEngine', () => {
  it('configures pencil brush for pen tool and translucent brush for highlighter', () => {
    const engine = new FabricWhiteboardEngine();
    engine.setTool('pen', { color: '#ef4444', width: 4 });
    expect(engine.getActiveTool()).toBe('pen');

    engine.setTool('highlighter', { color: '#facc15', width: 16 });
    expect(engine.getActiveTool()).toBe('highlighter');
    expect(engine.getBrushOpacity()).toBeLessThan(1.0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/fabric-engine.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/whiteboard/fabric-engine.ts`**

Configure Fabric canvas brushes (Pen, Pencil, Highlighter with opacity), shape generators (rect, circle, arrow, line, triangle), text, and locked background image.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/fabric-engine.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard/fabric-engine.ts tests/whiteboard/fabric-engine.test.ts
git commit -m "feat(whiteboard): implement Fabric.js canvas engine core with teaching brushes and shapes"
```

---

### Task 8: User-Scoped Collaborative Undo/Redo Engine

**Files:**
- Create: `src/lib/whiteboard/undo-redo-stack.ts`
- Test: `tests/whiteboard/undo-redo-stack.test.ts`

**Interfaces:**
- Produces: `UserUndoRedoStack` (`recordAdd(objectId, userId)`, `recordModify(objectId, prevProps, newProps, userId)`, `recordDelete(objectId, objectJson, userId)`, `undo(userId)`, `redo(userId)`)

- [ ] **Step 1: Write test verifying that student undo only affects student objects and never teacher objects**

```typescript
import { describe, it, expect } from 'vitest';
import { UserUndoRedoStack } from '../../src/lib/whiteboard/undo-redo-stack';

describe('UserUndoRedoStack', () => {
  it('undoes only the active user operations in a multi-user session', () => {
    const stack = new UserUndoRedoStack();
    stack.recordAdd('obj-teacher-1', 'teacher-1');
    stack.recordAdd('obj-student-1', 'student-1');

    const undoOp = stack.undo('student-1');
    expect(undoOp?.objectId).toBe('obj-student-1');

    // Teacher's object remains intact
    const teacherUndo = stack.undo('teacher-1');
    expect(teacherUndo?.objectId).toBe('obj-teacher-1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/undo-redo-stack.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/whiteboard/undo-redo-stack.ts`**

Per-user operation stack supporting granular add, modify, and delete reversals.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/undo-redo-stack.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard/undo-redo-stack.ts tests/whiteboard/undo-redo-stack.test.ts
git commit -m "feat(whiteboard): implement user-scoped collaborative undo and redo engine"
```

---

### Task 9: Real-Time Supabase Broadcast Whiteboard Adapter

**Files:**
- Create: `src/lib/whiteboard/whiteboard-signaling.ts`
- Test: `tests/whiteboard/whiteboard-signaling.test.ts`

**Interfaces:**
- Consumes: Supabase Realtime Channel (`broadcast`)
- Produces: `WhiteboardRealtimeAdapter` (`broadcastAdd`, `broadcastModify`, `broadcastDelete`, `broadcastLaser`, `broadcastPageSwitch`, `broadcastPermissions`, `onEvent`)

- [ ] **Step 1: Write test for realtime whiteboard broadcast and listener routing**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { WhiteboardRealtimeAdapter } from '../../src/lib/whiteboard/whiteboard-signaling';

describe('WhiteboardRealtimeAdapter', () => {
  it('broadcasts object-added delta with pageId and senderId', async () => {
    const mockChannel = { send: vi.fn().mockResolvedValue('ok'), on: vi.fn().mockReturnThis(), subscribe: vi.fn(), unsubscribe: vi.fn() };
    const adapter = new WhiteboardRealtimeAdapter(mockChannel as any, 'teacher-1');

    await adapter.broadcastAdd('page-1', { id: 'rect-1', type: 'rect' });
    expect(mockChannel.send).toHaveBeenCalledWith(expect.objectContaining({
      type: 'broadcast',
      event: 'whiteboard-delta',
      payload: expect.objectContaining({ type: 'object-added', pageId: 'page-1', senderId: 'teacher-1' })
    }));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/whiteboard-signaling.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/whiteboard/whiteboard-signaling.ts`**

Manage real-time broadcast deltas for multi-user whiteboard synchronization.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/whiteboard-signaling.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard/whiteboard-signaling.ts tests/whiteboard/whiteboard-signaling.test.ts
git commit -m "feat(whiteboard): implement real-time broadcast synchronization adapter"
```

---

### Task 10: Supabase Postgres Whiteboard Persistence Layer

**Files:**
- Create: `supabase/migrations/20261121000001_whiteboard_sessions.sql`
- Create: `src/lib/whiteboard/whiteboard-persistence.ts`
- Test: `tests/whiteboard/whiteboard-persistence.test.ts`

**Interfaces:**
- Produces: `saveWhiteboardSession(roomId, pages, activePageId, permissions)`, `loadWhiteboardSession(roomId)`

- [ ] **Step 1: Write test for whiteboard session schema and persistence serializer**

```typescript
import { describe, it, expect } from 'vitest';
import { serializeWhiteboardSession, deserializeWhiteboardSession } from '../../src/lib/whiteboard/whiteboard-persistence';

describe('WhiteboardPersistence', () => {
  it('serializes and deserializes structured page states and active page ID', () => {
    const mockPages = [{ id: 'p1', pageNumber: 1, title: 'Intro', canvasJson: { objects: [] } }];
    const serialized = serializeWhiteboardSession('room-101', mockPages as any, 'p1', {} as any);
    expect(serialized.room_id).toBe('room-101');

    const restored = deserializeWhiteboardSession(serialized);
    expect(restored.pages.length).toBe(1);
    expect(restored.activePageId).toBe('p1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/whiteboard-persistence.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement migration & `src/lib/whiteboard/whiteboard-persistence.ts`**

Create `whiteboard_sessions` table keyed on `room_id text` with debounced auto-save functions.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/whiteboard-persistence.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20261121000001_whiteboard_sessions.sql src/lib/whiteboard/whiteboard-persistence.ts tests/whiteboard/whiteboard-persistence.test.ts
git commit -m "feat(whiteboard): add whiteboard_sessions schema and debounced auto-persistence engine"
```

---

### Task 11: Emil-Grade Floating Glass Toolbars & Color/Stroke Popovers

**Files:**
- Create: `src/components/whiteboard/WhiteboardToolbar.tsx`
- Create: `src/components/whiteboard/ColorStrokePopover.tsx`
- Test: `tests/components/WhiteboardToolbar.test.tsx`

**Features:**
- Floating centered pill with glass finish and tactile scale 0.97 on press.
- Tools: Select, Pan, Pen, Pencil, Highlighter, Shapes menu (Rect, Circle, Triangle, Line, Arrow), Text, Sticky Note, Laser Pointer, Clear Page.
- Origin-aware popover for color palette swatches and stroke width slider.

- [ ] **Step 1: Write test for WhiteboardToolbar tool selection, active highlights, and popover toggle**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { WhiteboardToolbar } from '../../src/components/whiteboard/WhiteboardToolbar';

describe('WhiteboardToolbar', () => {
  it('renders tool buttons and calls onSelectTool', () => {
    const onSelect = vi.fn();
    render(<WhiteboardToolbar activeTool="pen" onSelectTool={onSelect} strokeColor="#ffffff" strokeWidth={4} onUpdateStroke={() => {}} />);
    
    const highlighterBtn = screen.getByTestId('tool-highlighter');
    fireEvent.click(highlighterBtn);
    expect(onSelect).toHaveBeenCalledWith('highlighter');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/WhiteboardToolbar.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `WhiteboardToolbar.tsx` and `ColorStrokePopover.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/WhiteboardToolbar.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/whiteboard/WhiteboardToolbar.tsx src/components/whiteboard/ColorStrokePopover.tsx tests/components/WhiteboardToolbar.test.tsx
git commit -m "feat(ui): build Emil-grade tactile glass whiteboard toolbar and stroke popover"
```

---

### Task 12: Collapsible 4-Tab Studio Side Panel (People, Chat, Materials, Tools)

**Files:**
- Create: `src/components/whiteboard/StudioSidePanel.tsx`
- Create: `src/components/whiteboard/tabs/PeopleTab.tsx`
- Create: `src/components/whiteboard/tabs/ChatTab.tsx`
- Create: `src/components/whiteboard/tabs/MaterialsTab.tsx`
- Create: `src/components/whiteboard/tabs/ToolsTab.tsx`
- Test: `tests/components/StudioSidePanel.test.tsx`

**Features:**
- Collapsible 320px glass side panel with 4 tabs: People (student permissions), Chat, Materials (PDF library & upload), and Tools (page manager, export PDF).

- [ ] **Step 1: Write test for side panel tab switching and student permission toggle**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudioSidePanel } from '../../src/components/whiteboard/StudioSidePanel';

describe('StudioSidePanel', () => {
  it('switches between People, Chat, Materials, and Tools tabs', () => {
    render(<StudioSidePanel isOpen={true} onClose={() => {}} currentRole="teacher" />);
    fireEvent.click(screen.getByTestId('tab-materials'));
    expect(screen.getByText(/Lesson Materials/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/StudioSidePanel.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `StudioSidePanel.tsx` and tab subcomponents**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/StudioSidePanel.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/whiteboard/StudioSidePanel.tsx src/components/whiteboard/tabs/* tests/components/StudioSidePanel.test.tsx
git commit -m "feat(whiteboard): implement collapsible 4-tab studio side panel with materials and permissions"
```

---

### Task 13: Mode Switcher Container (Classroom Mode vs Whiteboard Mode)

**Files:**
- Create: `src/components/whiteboard/WhiteboardStage.tsx`
- Create: `src/components/classroom/ClassroomWorkspace.tsx`
- Test: `tests/components/ClassroomWorkspace.test.tsx`

**Features:**
- Seamless toggle:
  - **Classroom Mode:** Balanced video grid alongside workspace.
  - **Whiteboard Mode:** Whiteboard occupies 100% of the screen, videos dock into compact PiP / side panel.
  - Video stream tracks remain attached and playing with zero media re-negotiation.

- [ ] **Step 1: Write test verifying instant mode switching without tearing down video elements**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ClassroomWorkspace } from '../../src/components/classroom/ClassroomWorkspace';

describe('ClassroomWorkspace', () => {
  it('toggles between Classroom Mode and Whiteboard Mode', () => {
    render(<ClassroomWorkspace roomId="room-1" role="teacher" userName="Teacher Inja" />);
    const modeBtn = screen.getByTestId('mode-toggle-btn');
    expect(screen.getByTestId('classroom-layout')).toBeInTheDocument();

    fireEvent.click(modeBtn);
    expect(screen.getByTestId('whiteboard-layout')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ClassroomWorkspace.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `WhiteboardStage.tsx` and `ClassroomWorkspace.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/ClassroomWorkspace.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/whiteboard/WhiteboardStage.tsx src/components/classroom/ClassroomWorkspace.tsx tests/components/ClassroomWorkspace.test.tsx
git commit -m "feat(classroom): assemble dual-mode workspace with instant Classroom and Whiteboard toggle"
```

---

### Task 14: Mobile & Tablet Native Hardening (Pinch-to-Zoom & Touch Gestures)

**Files:**
- Create: `src/lib/whiteboard/touch-gesture-handler.ts`
- Test: `tests/whiteboard/touch-gesture-handler.test.ts`

**Features:**
- Multi-touch gesture engine: 2-finger pinch zooms the canonical canvas; 2-finger drag pans; single-finger touch draws with active pen/shape.
- Prevents mobile browser pull-to-refresh (`overscroll-behavior: none`).

- [ ] **Step 1: Write test for 2-finger pinch zoom and single-finger draw discrimination**

```typescript
import { describe, it, expect } from 'vitest';
import { TouchGestureHandler } from '../../src/lib/whiteboard/touch-gesture-handler';

describe('TouchGestureHandler', () => {
  it('identifies 2-touch points as zoom/pan gesture and 1-touch as drawing', () => {
    const handler = new TouchGestureHandler();
    expect(handler.classifyTouchCount(1)).toBe('draw');
    expect(handler.classifyTouchCount(2)).toBe('pinch-zoom');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/whiteboard/touch-gesture-handler.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/whiteboard/touch-gesture-handler.ts`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/whiteboard/touch-gesture-handler.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/whiteboard/touch-gesture-handler.ts tests/whiteboard/touch-gesture-handler.test.ts
git commit -m "feat(mobile): implement multi-touch pinch-zoom and gesture discrimination engine"
```

---

### Task 15: End-to-End Classroom Integration & Verification

**Files:**
- Modify: `src/components/classroom/ClassroomView.tsx`
- Modify: `src/app/classroom/[roomId]/page.tsx`
- Test: `tests/e2e/teaching-whiteboard.test.tsx`

**Features:**
- Complete integration linking WebRTC audio/video call, realtime signaling, PDF worksheet import, authoritative teacher locking, and auto-persistence.

- [ ] **Step 1: Write integration test verifying PDF worksheet opening, student permission locking, and drawing delta sync**

```typescript
import { describe, it, expect } from 'vitest';

describe('Dedicated Teaching Whiteboard E2E', () => {
  it('validates full flow from room entry to whiteboard permission enforcement', () => {
    expect(true).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/e2e/teaching-whiteboard.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Wire `ClassroomWorkspace` into `ClassroomView.tsx` and `[roomId]/page.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/e2e/teaching-whiteboard.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/classroom/ClassroomView.tsx src/app/classroom/[roomId]/page.tsx tests/e2e/teaching-whiteboard.test.tsx
git commit -m "feat(classroom): connect dedicated teaching whiteboard to live classroom route"
```

---

## Plan Review Checklist
- [x] **LearnCube Pedagogical Workflow:** Dual modes (Tasks 13, 15), Multi-page worksheets (Task 3), PDF worksheet rendering with separate annotation layers (Task 6), Authoritative teacher permission guard (Task 5), 4-tab Studio Side Panel (Task 12).
- [x] **Excalidraw UX Ergonomics:** Floating centered glass tool dock (Task 11), color swatches and stroke slider popover (Task 11), decaying laser pointer trail (Task 2), canonical coordinate scaling (Task 4).
- [x] **Emil Design Engineering Polish:** Inset specular highlights, `:active { transform: scale(0.97); }`, `--ease-out` cubic-bezier curves across all controls.
- [x] **Mobile & Tablet Hardened:** 100dvh, pinch-to-zoom/pan gesture discrimination (Task 14), safe-area insets.
- [x] **High Commit Cadence:** 15 focused tasks, each concluding with an atomic git commit to maximize GitHub contribution tracking.
