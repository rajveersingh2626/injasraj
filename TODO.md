# Ralph Loop Task Checklist: Architectural Reset & Real Functional Verification

- [x] Task 1: Pure Visual Document Rendering (NO Text Parsing / NO ASCII Garbage)
  - [x] 1.1 Delete all sample mock worksheets (`ALGEBRA_WORKSHEET_SVG`, `PHYSICS_WORKSHEET_SVG`, `CALCULUS_WORKSHEET_SVG`, `DEFAULT_WORKSHEETS`) and mock files from `MaterialsTab.tsx`.
  - [x] 1.2 Update all UI copy & loading states from "Loading PDF" / "Upload PDF Worksheet" to "Loading Document" / "Upload Document".
  - [x] 1.3 Remove garbled text extraction and ensure pure offscreen canvas rasterization for PDFs (`pdfjs-dist` `page.render()`).
  - [x] 1.4 Implement pure visual page rendering for Word documents (`.doc`/`.docx`) using Mammoth HTML-to-canvas rendering.
  - [x] 1.5 Ensure async offscreen rendering prevents main-thread hangs.

- [x] Task 2: True Infinite Workable Canvas (Remove Fixed Artboard Bounds)
  - [x] 2.1 Remove 16:9 fixed-box wrapper and bounds restriction in `WhiteboardStage.tsx`; allow canvas to fill full viewport.
  - [x] 2.2 Unclamp coordinate mapping in `viewport-transform.ts` and `fabric-engine.ts` (`clamp = false`), enabling drawing and panning from -∞ to +∞.
  - [x] 2.3 Render virtual grid and canvas scene infinitely across pan and zoom without clipping.
  - [x] 2.4 Update laser pointer tracking to support unconstrained world coordinates.

- [x] Task 3: Whiteboard State Persistence (Fix Save & Restore)
  - [x] 3.1 Update `serializeWhiteboardSession` and `deserializeWhiteboardSession` to preserve `pdfDocument`, `pageStrokes`, and viewport coordinates (`zoom`, `panX`, `panY`).
  - [x] 3.2 Ensure `schedulePersist` syncs active canvas JSON from engine before serialization.
  - [x] 3.3 Overhaul `handleRestoreWhiteboard` in `ClassroomWorkspace.tsx` to completely restore multi-page documents, slide decks, strokes, and background images.

- [x] Task 4: Complete Engineering & UI Overhaul of the Studio Panel (/ask-emil)
  - [x] 4.1 Remove heavy dark block UI; redesign Studio Panel as an elegant floating light-mode drawer (`bg-white/95`, `border-stone-200`, `shadow-xl`).
  - [x] 4.2 Overhaul tab navigation and typography across `People`, `Chat`, `Materials`, and `Tools` for contrast over infinite white canvas.
  - [x] 4.3 Ensure tactile interactions, smooth transitions, and non-blocking layout.

- [x] Task 5: Comprehensive Mechanical & Real Verification
  - [x] 5.1 Run full Vitest test suite (`npm test -- --run`) ensuring all test suites pass (66/66 test files passed, 694/694 tests passed).
  - [x] 5.2 Run Next.js production build check (`npm run build`) - 100% successful compile and static optimization with 0 errors.
  - [x] 5.3 Commit every micro-change atomically with clear conventional commit messages.
