# TODO: Fix PDF Loading & Multi-Page Whiteboard Rendering

- [x] Task 1: Fix Client PDF.js Loading & Buffer Preservation
  - [x] 1.1 Copy `pdf.min.mjs` into `public/pdf.min.mjs` so the browser can load it locally without CDN dependencies.
  - [x] 1.2 In `src/app/layout.tsx`, add `<script type="module">` to preload `window.pdfjsLib` and configure `GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'`.
  - [x] 1.3 In `src/lib/whiteboard/pdf-renderer.ts`, update `getPdfJs()` to reliably import from `window.pdfjsLib`, `/pdf.min.mjs`, and Node fallback.
  - [x] 1.4 In `getOrLoadPdfDocument()`, clone input `bytes` before passing to `pdfjs.getDocument` so underlying buffers are never detached/neutered.
  - [x] 1.5 In `convertPdfToPageImages()`, remove the 5-page cap (`Math.min(5, totalPages)`) and prefetch all pages sequentially in the background.
  - [x] 1.6 In `renderPdfPageToDataUrl()`, return recognizable SVG data URLs for placeholders so callers can detect and replace them.

- [x] Task 2: Fix Sub-Page Flipping & Whiteboard On-Demand Rendering
  - [x] 2.1 In `ClassroomWorkspace.tsx` (`handlePdfSubPageChange`), ensure flipping to any sub-page (e.g. Page 6 of 10) dynamically renders the page from `currentDocumentBufferRef.current` if not already rendered.
  - [x] 2.2 In `handleLoadWorksheet`, ensure `currentDocumentBufferRef.current` retains a clean non-detached copy of the file bytes.

- [x] Task 3: Fix & Optimize Server Conversion API (`/api/documents/convert`)
  - [x] 3.1 In `src/app/api/documents/convert/route.ts`, improve FormData parsing resilience so multipart boundaries and stream decoding never fail with false 400.
  - [x] 3.2 Add `maxDuration = 60` to allow multi-page rasterization without Vercel gateway timeout.

- [x] Task 4: Mechanical Verification & Testing
  - [x] 4.1 Run unit and integration tests (`npm test`).
  - [x] 4.2 Verify Next.js production build (`npm run build`).
  - [x] 4.3 Verify user PDF pages render completely and accurately.
