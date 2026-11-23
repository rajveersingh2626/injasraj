# Context: LearnCube-Style Document Stage & Whiteboard Rebuild

## Problem Statement
The classroom whiteboard needs a predictable, distraction-free document-first experience modeled on LearnCube:
- Infinite arbitrary 2D panning caused disorientation where students or teachers scrolled into blank $(x: 50000, y: -20000)$ space and lost worksheets.
- Multi-page PDFs need continuous portrait stacking with smooth vertical scrolling and fit-to-width auto-scaling.
- Document pages must be locked visual layers beneath annotations.
- Full classroom feature integration must be preserved: LiveKit/WebRTC delta sync, teacher authority guards (Global Lock, Laser Only), multi-page tools, and high-fidelity flattened `pdf-lib` export.

## Architecture
1. **LearnCube Portrait Document Stage**:
   - Centered portrait document canvas (standard A4/Letter 3:4 aspect ratio: 1200 x 1600 per page).
   - Multi-page documents stacked vertically with comfortable page gaps (40px) and page badges (`Page X of Y`).
   - Clean low-glare backdrop (`bg-stone-100`/`bg-stone-50`), page drop-shadows (`shadow-lg shadow-stone-900/10`).
   - Fit-to-Width auto-scaling calculated from container width, plus discrete zoom presets: `Fit Width`, `100%`, `125%`, `150%`.
2. **Visual Document Ingestion**:
   - `pdfjs-dist` offscreen high-DPI rasterization (following tldraw/FesTGig pipeline).
   - Word `.docx` rendering via `mammoth` HTML-to-canvas.
   - Background document pages locked (`selectable: false`, `evented: false`).
3. **Live Collaboration & Synchronization**:
   - Stroke coordinates normalized to the portrait document coordinate space.
   - LiveKit / WebRTC real-time sync for strokes, laser pointer, and Follow-Teacher vertical scroll sync.
   - Immediate enforcement of Global Lock and Laser Pointer Only.
4. **Tools & Exporting**:
   - Blank page grid patterns (`blank`, `dots`, `lined`, `grid`).
   - Multi-page management (add, clone, delete, jump).
   - Flattened PDF export via `pdf-lib` stamping user annotations back onto the original document.
