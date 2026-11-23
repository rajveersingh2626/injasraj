# Fix & Refactor: Server-Side PDF Pipeline, UI Leaks, Scroll Clamping & Default Cursor

- [ ] Task 1: Set Cursor / Select Tool as Default
  - [ ] 1.1 Update `ClassroomWorkspace` activeTool default state from 'pen' to 'select'.
  - [ ] 1.2 Update `WhiteboardStage` uncontrolled default tool fallback from 'pen' to 'select'.
  - [ ] 1.3 Update tests to reflect cursor/select as default tool on load.
  - [ ] 1.4 Commit change atomically.

- [ ] Task 2: Clamp & Limit Whiteboard Scroll Range
  - [ ] 2.1 Add mathematical scroll boundary calculation (`clampPanOffset`) in `viewport-transform.ts`.
  - [ ] 2.2 Wire boundary clamping to wheel/trackpad scrolling and pointer pan in `WhiteboardStage.tsx`.
  - [ ] 2.3 Add unit tests for `clampPanOffset` and scroll clamping in `tests/whiteboard/viewport-transform.test.ts` and `WhiteboardStage.test.tsx`.
  - [ ] 2.4 Commit change atomically.

- [ ] Task 3: Fix PDF Navigator Leaking onto Normal Pages
  - [ ] 3.1 Ensure `PdfSubPageNavigator` strictly renders ONLY when the active page contains a valid multi-page document (`totalPages > 1`).
  - [ ] 3.2 Ensure switching to normal blank pages completely unmounts/hides the PDF navigator.
  - [ ] 3.3 Add unit tests verifying PDF navigator visibility on multi-page vs blank page switches.
  - [ ] 3.4 Commit change atomically.

- [ ] Task 4: Server-Side PDF-to-Image Conversion Pipeline
  - [ ] 4.1 Implement server-side conversion route `POST /api/documents/convert` using `pdf-to-img` / `pdfjs-dist`.
  - [ ] 4.2 Support sequential multi-page extraction with page numbers, dimensions, and base64/data URLs.
  - [ ] 4.3 Add server route unit tests for `/api/documents/convert`.
  - [ ] 4.4 Commit server endpoint atomically.

- [ ] Task 5: Client Integration & LiveKit Sync
  - [ ] 5.1 Update client document ingestion in `document-renderer.ts` and `ClassroomWorkspace.tsx` to delegate PDF conversion to the server endpoint.
  - [ ] 5.2 Add non-blocking "Loading Document..." visual progress state while server processes pages.
  - [ ] 5.3 Broadcast ordered page images to connected LiveKit / WebRTC participants so peers don't re-process.
  - [ ] 5.4 Commit client integration atomically.

- [ ] Task 6: Full Verification & Automated Quality Gates
  - [ ] 6.1 Run full Vitest suite.
  - [ ] 6.2 Run Next.js production build (`npm run build`).
