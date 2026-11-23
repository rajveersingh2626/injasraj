# Ralph Loop Task Checklist: Whiteboard, PDF, INP, LiveKit & Studio Overhaul

- [x] Task 1: Architectural Assessment & Research
  - [x] 1.1 Whiteboard Engine Evaluation: Custom Canvas2D vs Excalidraw / tldraw for real-time classroom.
  - [x] 1.2 PDF-to-Image Pipeline: High-DPI canvas rasterization to WebP/PNG without remote CDN worker traps.

- [x] Task 2: Priority 2 - Whiteboard Canvas & Toolbar Bugs
  - [x] 2.1 Infinite White Canvas: Replace dark dotted background (`#121110`) with infinite white background (`commit 06fd02f`).
  - [x] 2.2 Color Picker Popover Fix: Fix toolbar `overflow-x-auto` clipping and popover layout so colors and stroke widths render without scrollbars (`commit 977767c`).

- [x] Task 3: Priority 1 - PDF Loading Overhaul
  - [x] 3.1 Trash broken CDN worker loader in `pdf-renderer.ts` and implement reliable high-DPI PDF-to-image pipeline (`commit 500ac16`).
  - [x] 3.2 Ensure multi-page PDFs convert to crisp WebP/PNG images and attach cleanly to whiteboard pages.

- [x] Task 4: Priority 3 - Performance, INP & Code Modularization
  - [x] 4.1 Optimize pointer and draw event listeners in `WhiteboardStage.tsx` with `requestAnimationFrame` coalescing to eliminate high INP and lag (`commit 5da7f80`).
  - [x] 4.2 Modularize bloated `fabric-engine.ts` into clean helper modules (geometry, renderers, hit-testing) (`commit b720cbd`).

- [x] Task 5: Priority 4 - LiveKit Session Debugging
  - [x] 5.1 Fix `/api/livekit/token` URL handling and pass dynamic LiveKit WS URL to session connect (`commit df9cece`).
  - [x] 5.2 Fix double media publishing and handle device permissions gracefully (`commit df9cece`).
  - [x] 5.3 Ensure remote participants and tracks appear on video call (`commit df9cece`).

- [x] Task 6: Step 5 - Studio Panel UI/UX Polish (/ask-emil)
  - [x] 6.1 Fix glassmorphism contrast failure over white whiteboard canvas (`commit 9eca2b6`).
  - [x] 6.2 Ensure high-contrast typography, crisp borders, and legible tab indicators across People, Chat, Materials, and Tools (`commit 9eca2b6`).

- [x] Task 7: Full Verification & Git Commits
  - [x] 7.1 Verify 100% test pass rate in Vitest.
  - [x] 7.2 Verify Next.js production build (`npm run build`).
  - [x] 7.3 Update HANDOVER.md, CONTEXT.md, and STATE.md.
