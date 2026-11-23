# LearnCube-Style Document Stage & Whiteboard Rebuild TODO

- [ ] Task 1: Audit Integration Points & Set Up Dependencies
  - [ ] 1.1 Document all connected classroom touchpoints (LiveKit sync, Studio Panel, toolbar, persistence).
  - [ ] 1.2 Install `pdf-lib` for flattened PDF annotation export.
  - [ ] 1.3 Commit dependency setup.

- [ ] Task 2: Build LearnCube Portrait Document Stage & Viewport
  - [ ] 2.1 Implement portrait document stage (A4/Letter 3:4 aspect ratio per page, centered, paper drop shadow).
  - [ ] 2.2 Implement Fit-to-Width auto-scaling and zoom presets (`Fit Width`, `100%`, `125%`, `150%`).
  - [ ] 2.3 Implement smooth vertical scroll container with live page indicators (`Page X of Y`).
  - [ ] 2.4 Lock background page layer so drawings annotate on top without document movement or deletion.

- [ ] Task 3: Visual Multi-Page Document Ingestion
  - [ ] 3.1 Stack multi-page PDF pages vertically with clean inter-page margins.
  - [ ] 3.2 Ensure zero text extraction and zero main-thread freezing.
  - [ ] 3.3 Ensure "Upload Document" UI copy and zero mock worksheets.

- [ ] Task 4: Reconnect Live Collaboration & Teacher Authority
  - [ ] 4.1 Normalize annotation coordinates across viewport scalings.
  - [ ] 4.2 Sync strokes, laser pointer, and vertical scroll ("Follow Teacher") over LiveKit / WebRTC.
  - [ ] 4.3 Wire teacher authority guards: Global Lock and Laser Pointer Only.

- [ ] Task 5: Reconnect Canvas Tools, Studio Panel & pdf-lib Export
  - [ ] 5.1 Wire canvas grid modes (`blank`, `dots`, `lined`, `grid`) for blank pages.
  - [ ] 5.2 Wire multi-page operations (add, clone, delete, jump) in Studio Panel and toolbar.
  - [ ] 5.3 Implement `Save as PDF` with `pdf-lib` (flattening vector annotations onto source PDF) and `Export Image`.
  - [ ] 5.4 Ensure Whiteboard Save & Restore persists portrait document stack and annotations.

- [ ] Task 6: Full Verification & Automated Quality Gates
  - [ ] 6.1 Run full Vitest suite (`npm test -- --run`).
  - [ ] 6.2 Run Next.js production build (`npm run build`).
