# Ralph Loop Task Checklist: Classroom, Infinite Whiteboard & Studio Overhaul

- [x] Task 1: Whiteboard Canvas Pan/Zoom Engine & Touchpad Gestures
  - [x] 1.1 Support pan offsets `(panX, panY)` and infinite canvas viewport transform in `viewport-transform.ts` and `WhiteboardStage.tsx`.
  - [x] 1.2 Implement touchpad pinch-to-zoom (wheel + ctrlKey) and two-finger scroll panning in `WhiteboardStage.tsx`.
  - [x] 1.3 Implement Grab/Pan tool (`pan`), Shift/Spacebar drag panning, and middle mouse button drag panning in `WhiteboardStage.tsx`.
  - [x] 1.4 Fix multi-whiteboard state isolation in `ClassroomWorkspace.tsx`: commit current canvas on `handleAddPage` and `handleSelectPage`, clear engine on new page, prevent object bleeding.

- [x] Task 2: PDF to WebP Converter & Worker Fix
  - [x] 2.1 Configure `pdfjs-dist` worker source for browser environments and convert rendered canvases to `image/webp` (with `image/png` fallback) in `pdf-renderer.ts`.
  - [x] 2.2 Add unit tests verifying WebP data URL output and worker initialization resilience.

- [x] Task 3: Studio Panel Theme, Contrast Fix & Remove Sample Worksheets
  - [x] 3.1 Overhaul `StudioSidePanel.tsx` styling and tab components (`PeopleTab`, `ChatTab`, `MaterialsTab`, `ToolsTab`) to warm stone palette with high-contrast text, eliminating all white-on-white text issues.
  - [x] 3.2 Provide delete action on worksheets in `MaterialsTab.tsx` and empty state handling.
  - [x] 3.3 Implement `/ask AI` slash command in `ChatTab.tsx` with instant AI teacher assistant responses.

- [x] Task 4: Video Controls On/Under Video & Student Mic/Cam Control
  - [x] 4.1 Embed direct mic/camera controls under/on `VideoCard.tsx`.
  - [x] 4.2 Add teacher remote controls on student video cards to mute student mic and toggle camera via signaling.

- [x] Task 5: Targeted Star Rewards & Video Star Badge
  - [x] 5.1 Implement targeted star assignment by teacher (recipient student selection).
  - [x] 5.2 Restrict celebratory reward overlay to the target student only.
  - [x] 5.3 Render star count badge on the top right of the student's video card for all participants in the meeting.

- [x] Task 6: Header Navigation, Teacher Name Editing, Invite Link & Participant Count
  - [x] 6.1 Add Home button to return to dashboard/homepage.
  - [x] 6.2 Allow teacher to click and edit their display name in the classroom header.
  - [x] 6.3 Add "Copy Invite Link" button in header with copied toast feedback.
  - [x] 6.4 Ensure participant count in header and PeopleTab accurately reflects local user + connected peers (minimum 1, never 0).

- [x] Task 7: Full Verification Gate & Git Commits
  - [x] 7.1 Run full vitest test suite (`npm test -- --run`) - all 64 suites (687 tests) passed.
  - [x] 7.2 Commit atomic changes following GSD & Ralph Loop guidelines.
