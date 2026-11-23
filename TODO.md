# Fix & Polish: QA Audit & Emil Design Engineering Bugs

- [x] Task 1: Fix Popover & Flyout Menu Outside-Click Listeners
  - [x] 1.1 In `ColorStrokePopover.tsx`, allow trigger button clicks to cleanly toggle popover without instant outside-click closure.
  - [x] 1.2 In `WhiteboardToolbar.tsx`, fix Shapes menu click toggle and outside-click handling.
  - [x] 1.3 In `ControlBar.tsx`, fix Device Settings outside-click listener to exclude the settings trigger button.
  - [x] 1.4 Commit Task 1 atomically.

- [x] Task 2: Supabase PostgREST 42501 Error Handling & Resilience
  - [x] 2.1 In `whiteboard-persistence.ts`, catch 42501 RLS permission errors gracefully without throwing noisy console errors, ensuring seamless localStorage fallback.
  - [x] 2.2 Commit Task 2 atomically.

- [ ] Task 3: Student Waiting Room Overlay & Toolbar UX
  - [ ] 3.1 In `ClassroomWorkspace.tsx`, dim and disable toolbar controls (`pointer-events-none opacity-40`) while `role === 'student' && sessionStatus === 'waiting'`.
  - [ ] 3.2 Display explicit locked status so students understand tools unlock when the teacher begins.
  - [ ] 3.3 Commit Task 3 atomically.

- [ ] Task 4: Emil Design Polish (Modal Physical Scale, Press Feedback & Typography)
  - [ ] 4.1 In `StudentNameModal.tsx`, `EndClassSummaryModal.tsx`, and `TeacherLoginModal.tsx`, add `scale(0.95)` -> `scale(1)` physical entry transition with `var(--ease-out)`.
  - [ ] 4.2 In `StudioSidePanel.tsx`, upgrade sub-11px typography to `text-xs` (12px) for WCAG legibility.
  - [ ] 4.3 Ensure `active:scale-[0.97]` press feedback on toolbar and dock interactive buttons.
  - [ ] 4.4 Commit Task 4 atomically.

- [ ] Task 5: Full Verification & Playwright Walkthrough
  - [ ] 5.1 Run full Vitest suite (`npm test`).
  - [ ] 5.2 Run Next.js production build (`npm run build`).
  - [ ] 5.3 Run Playwright test script to verify popovers (shapes, color, settings), waiting room, and complete walkthrough pass with code 0.
