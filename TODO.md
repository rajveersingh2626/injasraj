# Ralph Loop Task Checklist

- [x] Task 1.1: Remove Teacher Login option from classroom page (`src/components/classroom/ClassroomView.tsx`).
- [x] Task 1.2: Implement Student Name Entry Dialog (`src/components/classroom/StudentNameModal.tsx` & integration in `ClassroomView.tsx`).
- [x] Task 1.3: Support multiple students in participant roster & presence broadcasting (`ClassroomWorkspace.tsx`).
- [x] Task 1.4: Remove demo/placeholder lessons (`INITIAL_LESSONS`) from `src/app/page.tsx` and update tests.
- [x] Task 1.5: Verify mechanical test gate (`npm test -- --run`).
- [x] Task 1.6: Commit atomic slices for Priority One.
- [ ] Task 2.1: Protect Teacher Dashboard on `/` strictly behind Teacher Login (students see student booking/join portal).
- [ ] Task 2.2: Enforce Student Waiting Room gate until Teacher joins/starts session.
- [ ] Task 2.3: Convert PDF Ingestion to single-canvas Image Approach (embed onto active page, no extra tabs).
- [ ] Task 2.4: Video conferencing connection recovery & ICE/STUN fallback robustness.
- [ ] Task 2.5: Emil Kowalski light-theme color contrast polish for whiteboard controls.
