# TODO: Render Exact PDF Document Pages on Whiteboard

- [x] Task 1: Fix PDF.js Distribution & Eliminate Mock Card Placeholders
  - [x] 1.1 Copy `pdfjs-dist/legacy/build/pdf.min.mjs`, `pdf.worker.min.mjs`, and `pdf.worker.mjs` into `public/` so polyfills (`toHex`, `Promise.withResolvers`) are present in all browsers and environments.
  - [x] 1.2 In `src/lib/whiteboard/pdf-renderer.ts`, remove fake mock card generation (`tryRenderWithCanvas`) that was drawing blank cards with title and "Page 6 of 10".
  - [x] 1.3 In `renderPageWithPdfInstance`, pass both `canvas` and `canvasContext: ctx` to `page.render({ canvasContext: ctx, canvas, viewport })`.
  - [x] 1.4 In `renderPdfPageToDataUrl`, use real raster rendering with canvas and server rasterizer.
  - [x] 1.5 In `convertPdfToPageImages`, render ALL pages sequentially into real image data URLs instead of pre-filling with SVG placeholders.

- [x] Task 2: Fix Document Buffer Persistence & Sub-Page Flipping in Whiteboard
  - [x] 2.1 In `ClassroomWorkspace.tsx`, add `documentBuffersMap` to store and restore raw PDF bytes when documents are loaded or switched from the library.
  - [x] 2.2 In `handlePdfSubPageChange`, dynamically render missing or placeholder sub-pages on-demand and update the canvas background.

- [x] Task 3: Preserve Aspect Ratio for Portrait Documents in Whiteboard Engine
  - [x] 3.1 In `src/lib/whiteboard/fabric-engine.ts` (`drawBackgroundImage`), center portrait documents (e.g. A4) horizontally on the 1920x1080 canvas while preserving natural aspect ratio instead of stretching to 16:9.

- [x] Task 4: Mechanical Verification & Testing
  - [x] 4.1 Verify exact PDF page rendering on user's 10-page document (`tests/user-pdf-multipage-render.test.ts`).
  - [x] 4.2 Run full test suite (`npm test` - 71 passed, 724 passed).
  - [x] 4.3 Verify production build (`npm run build`).
