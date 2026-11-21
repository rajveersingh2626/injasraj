# Whiteboard UX Perfection & Tool Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the Virtual Teaching Studio Whiteboard UX to Emil Kowalski design engineering standards: add an eraser tool, dynamic tool cursors, fully functional undo/redo with keyboard shortcuts, interactive grid mode switching, 1-click lesson image export, and tactile color swatch active rings.

**Architecture:** Integrate the existing `UndoRedoStack` into `ClassroomWorkspace` to track user actions and wire `canUndo`/`canRedo`/`onUndo`/`onRedo` to `WhiteboardStage`. Map `activeTool` to dynamic CSS cursor classes on `<canvas>`. Add an eraser button to `WhiteboardToolbar`. Connect ToolsTab grid pattern selection and 1-click PNG image export directly to `FabricWhiteboardEngine`.

**Tech Stack:** React 19, Next.js 15.5.29, Tailwind CSS, Lucide Icons, Canvas2D, Vitest, Testing Library.

**Spec:** `docs/specs/2026-11-21-dedicated-teaching-whiteboard-design.md`

## Global Constraints
- Emil Kowalski micro-interactions: `:active { transform: scale(0.97); }` with `160ms cubic-bezier(0.23, 1, 0.32, 1)`.
- Canonical 1920×1080 virtual resolution preserved.
- Zero extra heavy dependencies ($0 cost).
- Full touch discrimination and keyboard shortcut safety (`Cmd+Z`, `Ctrl+Z`, `Cmd+Shift+Z`, `Ctrl+Y`).

## Review Focus
1. Eraser tool removes tapped or dragged-over objects without erasing the locked worksheet background image.
2. Dynamic cursors update immediately on `<canvas>` when switching tools (`select` -> default/pointer, `pen` -> crosshair, `eraser` -> cell/crosshair, `text` -> text, `pan` -> grab).
3. Undo restores prior state and Redo re-applies it, updating `canUndo` and `canRedo` button enabled states.
4. Canvas grid switcher in Tools tab dynamically repaints blank, dots, lined, and grid patterns on the canvas.
5. PNG export generates a valid downloadable image data URL of the canvas.

---

### Task 1: Dedicated Eraser Tool & Dynamic Canvas Cursors

**Files:**
- Modify: `src/components/whiteboard/WhiteboardToolbar.tsx`
- Modify: `src/components/whiteboard/WhiteboardStage.tsx`
- Modify: `src/lib/whiteboard/fabric-engine.ts`
- Test: `tests/whiteboard/ux-perfection.test.ts`

**Interfaces:**
- `WhiteboardToolbarProps.activeTool: WhiteboardToolType`
- `WhiteboardToolbarProps.onSelectTool: (tool: WhiteboardToolType) => void`
- `WhiteboardStageProps.activeTool?: WhiteboardToolType`

- [ ] **Step 1: Write the failing test for eraser tool button and dynamic cursors**
```ts
it('renders eraser tool in toolbar and applies dynamic cursor on canvas based on active tool', () => {
  // asserts data-testid="tool-eraser" is present and clickable
  // asserts canvas className changes from cursor-crosshair to cursor-default (select), cursor-text (text), cursor-grab (pan)
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/whiteboard/ux-perfection.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Eraser button in `WhiteboardToolbar.tsx` and dynamic cursor map in `WhiteboardStage.tsx`**
Add `Eraser` icon between Highlighter and Shapes in `WhiteboardToolbar.tsx`.
In `WhiteboardStage.tsx`, map `activeTool` to CSS cursor:
- `select` -> `'cursor-default'`
- `pan` -> `'cursor-grab'`
- `text` -> `'cursor-text'`
- `sticky` -> `'cursor-copy'`
- `eraser` -> `'cursor-cell'`
- `laser` -> `'cursor-none'`
- `pen` | `pencil` | `highlighter` | shapes -> `'cursor-crosshair'`

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/whiteboard/ux-perfection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -m "feat(whiteboard): add dedicated eraser tool and dynamic canvas cursors"
```

---

### Task 2: Operational Collaborative Undo/Redo & Keyboard Shortcuts

**Files:**
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/components/whiteboard/WhiteboardStage.tsx`
- Test: `tests/whiteboard/ux-perfection.test.ts`

**Interfaces:**
- Consumes: `UndoRedoStack` from `src/lib/whiteboard/undo-redo-stack.ts`
- Produces: `onUndo: () => void`, `onRedo: () => void`, `canUndo: boolean`, `canRedo: boolean`

- [ ] **Step 1: Write the failing test for Undo/Redo button enabling and execution**
```ts
it('enables undo button when object is added and executes undo/redo on click and keyboard shortcuts', () => {
  // adds object -> canUndo is true -> clicks undo -> object removed -> canRedo is true -> clicks redo -> object restored
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/whiteboard/ux-perfection.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Undo/Redo state and key listeners in `ClassroomWorkspace.tsx`**
Initialize `undoRedoStackRef = useRef(new UndoRedoStack())`.
Record commands when `engine.onObjectAdded`, `engine.onObjectModified`, `engine.onObjectRemoved` fire.
Implement `handleUndo()`: pop command, execute inverse on `engineRef.current`, update page manager, broadcast delta, schedule save.
Implement `handleRedo()`: pop redo command, re-apply on `engineRef.current`, broadcast delta, schedule save.
Pass `canUndo`, `canRedo`, `onUndo`, `onRedo` to `WhiteboardStage`.
Add `keydown` listener for `(e.metaKey || e.ctrlKey) && e.key === 'z'` (undo) and `(e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.shiftKey && e.key === 'z'))` (redo).

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/whiteboard/ux-perfection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -m "feat(whiteboard): wire collaborative undo/redo stack and keyboard shortcuts"
```

---

### Task 3: Interactive Grid Mode & 1-Click PNG Image Export

**Files:**
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/components/whiteboard/StudioSidePanel.tsx`
- Modify: `src/components/whiteboard/tabs/ToolsTab.tsx`
- Test: `tests/whiteboard/ux-perfection.test.ts`

**Interfaces:**
- `ToolsTabProps.onChangeGrid: (grid: GridPatternType) => void`
- `ToolsTabProps.onExportImage: () => void`
- `FabricWhiteboardEngine.setGridType: (grid: 'none' | 'dots' | 'lines' | 'grid') => void`

- [ ] **Step 1: Write the failing test for grid mode selection and image export**
```ts
it('updates canvas grid mode when selecting grid options and exports canvas PNG image', () => {
  // selects dots -> engine.getGridType() === 'dots'
  // clicks export image -> canvas.toDataURL('image/png') called
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/whiteboard/ux-perfection.test.ts`
Expected: FAIL

- [ ] **Step 3: Wire grid changer and PNG exporter in `ClassroomWorkspace.tsx`**
Maintain `currentGrid` state in `ClassroomWorkspace.tsx` and pass `currentGrid` and `handleChangeGrid` to `StudioSidePanel`.
`handleChangeGrid` calls `engineRef.current.setGridType(grid === 'blank' ? 'none' : grid)`.
Implement `handleExportImage()` which calls `toDataURL('image/png')` on the canvas element and triggers a browser download.
Wire `handleClearPage()` to call `engine.clearCurrentPage(true)` keeping the background worksheet intact.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/whiteboard/ux-perfection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -m "feat(whiteboard): wire canvas grid patterns, guarded page clear, and image export"
```

---

### Task 4: Tactile Color Swatch Rings & Design Engineering Polish

**Files:**
- Modify: `src/components/whiteboard/ColorStrokePopover.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Test: `tests/whiteboard/ux-perfection.test.ts`

**Interfaces:**
- `ColorStrokePopoverProps.strokeProperties: StrokeProperties`

- [ ] **Step 1: Write the failing test for active color swatch specular ring**
```ts
it('renders active ring and scale indicator on currently selected color swatch in popover', () => {
  // verifies active swatch has ring-2 ring-indigo-500 ring-offset-2 ring-offset-zinc-900
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/whiteboard/ux-perfection.test.ts`
Expected: FAIL

- [ ] **Step 3: Add specular rings to `ColorStrokePopover.tsx` and polish header mode switcher**
In `ColorStrokePopover.tsx`, add active state ring styling and `active:scale-[0.95]` transition to swatch buttons.
In `ClassroomWorkspace.tsx`, ensure mode toggle has Emil Kowalski spring transition.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/whiteboard/ux-perfection.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git commit -m "style(ui): polish color swatch active rings and tactile micro-interactions"
```

---

### Task 5: Full Suite Verification & Production Build

- [ ] **Step 1: Run full test suite across the repository**
Run: `npm test`
Expected: ALL test files pass (39+ files, 600+ tests).

- [ ] **Step 2: Run Next.js production build**
Run: `npm run build`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Push to `origin/main`**
```bash
git push origin main
```
