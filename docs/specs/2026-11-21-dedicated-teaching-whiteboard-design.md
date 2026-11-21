# Architectural Design Specification: Dedicated Teaching Whiteboard

**Date:** 2026-11-21  
**Status:** Pending Approval  
**Inspiration:** LearnCube Online Teaching Studio  
**Foundation:** Fabric.js v6 + Mozilla `pdfjs-dist`  
**Target Budget:** $0 (Runs on existing Supabase Realtime & Postgres free tier)  

---

## 1. Intent & Context
Online tutoring between teachers in India and international students requires more than a video call with a casual sketch pad. It requires a **dedicated, professional virtual teaching whiteboard** where the lesson workspace is the core experience. The architecture replicates the structured teaching workflow of LearnCube: multi-page PDF worksheets, separate editable annotation layers, authoritative teacher permissions, laser pointers, and instant switching between **Classroom Mode** (balanced video & workspace) and **Whiteboard Mode** (maximized whiteboard with studio side panel).

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals
- **Digital Teaching Studio, Not Video Call:** Provide an expansive, distraction-free whiteboard with an instant toggle between Classroom Mode and Whiteboard Mode.
- **Structured Multi-Page Worksheets:** Paginated lesson notebook (Add, Duplicate, Reorder, Delete, Thumbnail strip, Next/Prev) rather than an unguided infinite canvas.
- **Native PDF & Worksheet Teaching:** Upload multi-page PDFs, lock page backgrounds, and render separate editable vector annotation layers (pens, highlighters, shapes, text).
- **Authoritative Teacher Permissions:** Teacher controls lock state, per-student drawing grants, own-object movement rules, and deletion protection, enforced at the logic level.
- **Teaching Aids:** Real-time laser pointer with transient trailing animation, spotlight focus mode, sticky notes, and z-index ordering.
- **Zero-Loss Auto-Persistence:** Continuous auto-save of structured vector JSON in Supabase Postgres (`whiteboard_sessions`), preserving full editability across refreshes.
- **Real-Time $0 Sync:** Stream incremental drawing deltas and cursor coordinates over existing Supabase Realtime broadcast channels (`whiteboard:<roomId>`).
- **Emil Kowalski Tactile Glass & Mobile/Tablet Native:** Tactile glass toolbars (`:active { transform: scale(0.97); }`), 100dvh viewport, and responsive collapsible side panel.

### Non-Goals
- Infinite, unpaginated whiteboard canvases (Miro/FigJam style) which disorient structured lesson pacing.
- Server-side rasterization engines (canvas rendering is executed client-side via HTML5 canvas to maintain $0 server cost).

### Anti-Goals
- Do not allow unrestricted collaborative editing by default.
- Do not flatten annotations into raster bitmaps; keep all annotations as separate vector JSON objects.
- Do not leave video tiles covering the active drawing area when in Whiteboard Mode.

---

## 3. Evaluated Canvas Engines & Selection

| Engine | PDF & Paginated Worksheet Fit | Object Ownership & Permissions | UI & License | Verdict |
| :--- | :--- | :--- | :--- | :--- |
| **Fabric.js v6 + pdfjs-dist** | **Native** (page background + vector layer) | **Built-in** (`id`, `createdBy`, `isLocked`) | 100% Free MIT | **Selected** |
| **Excalidraw** | Poor (infinite canvas only, no native PDF pages) | Low (monolithic scene graph) | Free MIT, but "sketchy" look | Rejected |
| **tldraw v2** | Moderate (infinite board focus) | Complex custom overrides | Custom / non-standard commercial | Rejected |
| **React-Konva** | Manual implementation of text/brush | High | Free MIT, high boilerplate | Rejected |

---

## 4. Platform Modes & Studio Layout

### 4.1 Dual Classroom Modes
1. **Classroom Mode (Default):**
   - Video tiles (teacher & student) and whiteboard workspace share balanced screen real estate.
   - Ideal for discussion, lesson intro, and wrap-up.
2. **Whiteboard Mode (Studio):**
   - Whiteboard expands to **100% maximum width and height**.
   - Video streams collapse into a compact, floating glass PiP tile or dock into the side panel.
   - Chat, People, Materials, and Tools dock into a collapsible 320px glass Studio Side Panel.

```
+-----------------------------------------------------------------------------------------+
| [ Mode Switcher: Classroom | Whiteboard ]   [ Page 1/4 < > ]   [ Zoom 100% ]   [ [X] Lock ]|
+-------------------------------------------------------------------+---------------------+
|                                                                   |  STUDIO SIDE PANEL  |
|                                                                   |  [Tabs: People/Chat |
|                     MAXIMIZED TEACHING WHITEBOARD                 |        Materials/UI]|
|                                                                   |---------------------|
|  - Active Page (Background PDF or Grid)                           |  [ Compact Video ]  |
|  - Vector Annotation Layer (Pens, Shapes, Highlighters, Text)     |  - Teacher (IST)    |
|  - Real-time Laser Pointer / Spotlight                            |  - Student          |
|                                                                   |---------------------|
|                                                                   |  Active Tab Content |
|                                                                   |  - Permissions      |
|                                                                   |  - PDF Library      |
+-------------------------------------------------------------------+---------------------+
| [ Floating Glass Toolbar: Select | Pen | Highlighter | Shapes | Text | Sticky | Clear ] |
+-----------------------------------------------------------------------------------------+
```

---

## 5. Technical Architecture & Subsystems

### 5.1 Whiteboard Page Model & Navigation
A lesson contains an ordered list of `WhiteboardPage`:
```typescript
interface WhiteboardPage {
  id: string;
  pageNumber: number;
  title: string;
  backgroundPdfUrl?: string;
  backgroundPdfPage?: number;
  canvasJson: any; // Serialized Fabric.js canvas objects
  thumbnailUrl?: string;
}
```
- **Navigation Controls:** Next/Previous page, Jump to Page, Add Blank Page, Duplicate Page, Reorder Pages, and Delete Page.
- **Thumbnails Strip:** Collapsible bottom/side strip displaying visual page previews.
- **Viewport Navigation:** Smooth Zoom (25% to 400%), Pan (Hand tool or spacebar drag), and "Fit to Screen".

### 5.2 PDF & Worksheet Teaching Engine
- **PDF Ingestion:** Teacher uploads PDF worksheet (or picks from lesson materials).
- **Page Extraction (`pdfjs-dist`):** Renders selected PDF page onto an off-screen HTML5 canvas at crisp 2x device pixel ratio, setting it as `canvas.backgroundImage`.
- **Annotation Independence:**
  - Background is locked (`selectable: false`, `evented: false`).
  - Annotations (pens, pencils, highlighters, shapes, text) exist in Fabric's active vector layer.
  - Export: Combines background PDF + vector annotations into a downloadable merged PDF using `jsPDF` or canvas snapshot.

### 5.3 Authoritative Teacher Permission Logic
Permissions are tracked in classroom state and validated before local application and broadcast:
```typescript
interface WhiteboardPermissions {
  isLockedGlobally: boolean;
  studentDrawingGranted: Record<string, boolean>; // studentId -> boolean
  preventDeletingTeacherContent: boolean;
  allowMovingOnlyOwnObjects: boolean;
  allowedTools: ('pen' | 'highlighter' | 'shapes' | 'text' | 'sticky' | 'laser')[];
}
```
- **Teacher Controls:**
  - One-click global lock toggle (always visible in top bar).
  - Individual student drawing toggle in the "People" panel.
- **Logic Enforcement:**
  - If locked for student: `canvas.isDrawingMode = false`, `canvas.selection = false`, all objects `selectable = false`.
  - On `object:moving` / `object:modified`: if user is a student, `allowMovingOnlyOwnObjects === true`, and `obj.createdBy !== currentUserId`, the modification is cancelled (`obj.set(prevCoords)`).
  - Deletion of objects with `obj.createdBy === 'teacher'` is blocked for students when `preventDeletingTeacherContent === true`.
  - Status Banners for Students: *"Whiteboard locked by teacher"*, *"You have drawing permission"*, *"Teacher is presenting"*.

### 5.4 Teaching & Drawing Tools
1. **Pen & Pencil:** Smooth freehand drawing with configurable stroke width (2px to 20px) and color swatches.
2. **Highlighter:** Semi-transparent stroke with `globalCompositeOperation = 'multiply'` (or 35% opacity), highlighting text without obscuring worksheet print.
3. **Shapes:** Line, Arrow, Rectangle, Circle, Triangle with fill and stroke controls.
4. **Text Tool:** Inline editable text boxes with font sizing, color, and bold/italic formatting.
5. **Sticky Notes:** Pastel-colored cards with auto-wrapping text.
6. **Laser Pointer:** Ephemeral glowing dot with a 1.5-second decaying trajectory trail; broadcasts cursor coordinates over Realtime channel without creating persistent database objects.
7. **Spotlight Mode:** Dark semi-transparent overlay covering canvas with a clear circular aperture following the teacher's cursor to focus student attention on specific worksheet exercises.
8. **Undo / Redo Stack:** Per-page action history (supporting up to 50 undo states).

### 5.5 Real-Time Synchronization & Auto-Persistence
- **Signaling:** Channel `whiteboard:<roomId>` over Supabase Realtime broadcast.
- **Delta Sync:** Emits granular payloads:
  - `whiteboard:object-added`: `{ pageId, objectJson, senderId }`
  - `whiteboard:object-modified`: `{ pageId, objectId, properties, senderId }`
  - `whiteboard:object-removed`: `{ pageId, objectId, senderId }`
  - `whiteboard:laser-move`: `{ x, y, senderId }`
  - `whiteboard:page-switch`: `{ pageId, senderId }`
  - `whiteboard:permissions-update`: `{ permissions, senderId }`
- **Database Schema (`whiteboard_sessions` in Supabase Postgres):**
  - `id uuid primary key default gen_random_uuid()`
  - `lesson_id uuid not null references public.lessons(id) on delete cascade`
  - `pages jsonb not null default '[]'::jsonb`
  - `active_page_id text not null`
  - `permissions jsonb not null default '{}'::jsonb`
  - `updated_at timestamptz not null default now()`
- **Persistence Strategy:**
  - Auto-save on page transitions.
  - Debounced auto-save (every 4 seconds after drawing changes).
  - Instant manual "Save Lesson" button in the Tools tab.

### 5.6 Studio Side Panel (4 Tabs)
1. **People:** Teacher, student list, mic/camera indicators, network HUD, and per-student permission toggles.
2. **Chat:** In-classroom messaging with timestamps and private teacher-student chat.
3. **Materials:** Lesson worksheets library, uploaded PDFs, slide decks, and instant "Open on Whiteboard" button.
4. **Tools:** Whiteboard settings, grid toggle (dot grid, lined, blank), page manager, export lesson as PDF/PNG.

---

## 6. Emil Kowalski Glass UI & Mobile/Tablet Hardening
- **Tactile Floating Toolbars:**
  - Floating pill centered at bottom: `background: rgba(18, 18, 24, 0.78); backdrop-filter: blur(16px);`.
  - Inset specular highlights, 1px hairline border `rgba(255, 255, 255, 0.08)`.
  - Active tool buttons scale to `0.97` on press with 160ms cubic-bezier transition.
- **Mobile & Tablet Hardening:**
  - `height: 100dvh` and `overscroll-behavior: none` (drawing never triggers page pull-to-refresh).
  - Multi-touch handling: Two-finger pinch to zoom, two-finger drag to pan; single-finger touch reserved for active tool (pen/shape).
  - Inputs formatted with >= 16px text to prevent mobile zoom.
  - On phones (<640px), the Studio Side Panel collapses into an animated bottom sheet with swipe-to-dismiss.
