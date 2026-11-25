# GSD State: Classroom Whiteboard Polish & Features

## Current Lifecycle Phase
**Phase 5: Ship & Verified**

## Objective
Address user feedback across 6 core areas:
1. Removed intrusive `< Page 1 of 1 > | +` navigation bar from single-page boards; show page navigator only when documents/multi-pages are added.
2. Added interactive image support (resize, reposition, drag with corner handles) for ANY imported image.
3. Defaulted to a clean 'new page' whiteboard instead of auto-restoring previous session boards.
4. Hid empty student video panel until students actually join; prompted all students to enter/confirm their name upon joining.
5. Moved annoying floating AV controls dock from left-middle to bottom-right.
6. Fixed Studio Panel low-contrast buttons and text (`/ask-emil`).

## Task Checklist
- [x] Task 1: Navigation Pill Visibility (`WhiteboardStage.tsx`)
- [x] Task 2: Interactive Image Drag/Resize Engine (`shape-renderers.ts`, `fabric-engine.ts`, `geometry.ts`)
- [x] Task 3: Default Fresh Whiteboard Page (`ClassroomView.tsx`)
- [x] Task 4: Dynamic Student Panels & Name Modal (`ClassroomWorkspace.tsx`, `ClassroomView.tsx`)
- [x] Task 5: AV Controls Repositioning to Bottom Right (`ControlBar.tsx`, `ClassroomWorkspace.tsx`)
- [x] Task 6: Studio Panel Emil Contrast Fixes (`MaterialsTab.tsx`, `GlassButton.tsx`)
- [x] Task 7: Verification (`vitest`, `npm run build` - 0 errors)
