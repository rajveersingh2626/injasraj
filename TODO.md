# LearnCube-Style Document Stage & Whiteboard Rebuild TODO

- [x] Task 1: Audit Integration Points & Set Up Dependencies
  - [x] 1.1 Document all connected classroom touchpoints (LiveKit sync, Studio Panel, toolbar, persistence).
  - [x] 1.2 Install `pdf-lib` for flattened PDF annotation export.
  - [x] 1.3 Commit dependency setup.

- [x] Task 2: Build LearnCube Portrait Document Stage & Viewport
  - [x] 2.1 Implement portrait document stage (A4/Letter 3:4 aspect ratio per page, centered, paper drop shadow).
  - [x] 2.2 Implement Fit-to-Width auto-scaling and zoom presets (`Fit Width`, `100%`, `125%`, `150%`).
  - [x] 2.3 Implement smooth vertical scroll container with live page indicators (`Page X of Y`).
  - [x] 2.4 Lock background page layer so drawings annotate on top without document movement or deletion.

- [x] Task 3: Visual Multi-Page Document Ingestion
  - [x] 3.1 Stack multi-page PDF pages vertically with clean inter-page margins.
  - [x] 3.2 Ensure zero text extraction and zero main-thread freezing.
  - [x] 3.3 Ensure "Upload Document" UI copy and zero mock worksheets.

- [x] Task 4: Reconnect Live Collaboration & Teacher Authority
  - [x] 4.1 Normalize annotation coordinates across viewport scalings.
  - [x] 4.2 Sync strokes, laser pointer, and vertical scroll ("Follow Teacher") over LiveKit / WebRTC.
  - [x] 4.3 Wire teacher authority guards: Global Lock and Laser Pointer Only.

- [x] Task 5: Reconnect Canvas Tools, Studio Panel & pdf-lib Export
  - [x] 5.1 Wire canvas grid modes (`blank`, `dots`, `lined`, `grid`) for blank pages.
  - [x] 5.2 Wire multi-page operations (add, clone, delete, jump) in Studio Panel and toolbar.
  - [x] 5.3 Implement `Save as PDF` with `pdf-lib` (flattening vector annotations onto source PDF) and `Export Image`.
  - [x] 5.4 Ensure Whiteboard Save & Restore persists portrait document stack and annotations.

- [x] Task 6: Full Verification & Automated Quality Gates
  - [x] 6.1 Run full Vitest suite (`npm test -- --run`) - 701 tests passed across 67 test suites.
  - [x] 6.2 Run Next.js production build (`npm run build`) - 0 errors, all 9 routes generated.
