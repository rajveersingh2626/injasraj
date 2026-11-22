# Teacher Authentication, Active Room Management, & Whiteboard History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide teacher authentication, student-by-default shareable links, an active room manager in the dashboard with 15-minute auto-expiry for instant classes, past classes archival with saved whiteboard data, and 1-click whiteboard restoration from previous classes.

**Architecture:** 
1. Client/server teacher authentication layer enforcing student role by default on `/classroom/[roomId]`, granting teacher authority only upon validated teacher session.
2. Room lifecycle and management service tracking active rooms, join timestamps, and a 15-minute TTL for instant sessions.
3. Whiteboard session archival linking completed/expired rooms to `whiteboard_sessions` and archiving into a `past_classes` ledger.
4. Whiteboard restoration interface in both the Teacher Dashboard and Classroom Studio SidePanel enabling teachers to load previous class notes and diagrams into live sessions.

**Tech Stack:** Next.js 15 App Router, React 19, TypeScript, Supabase SSR & Postgres, Vitest, Lucide React, Tailwind CSS.

**Spec:** User request specifying teacher login, student-default shareable links, active link management & deletion, 15-minute instant room dashboard removal to "past classes" record with whiteboard state, and reload whiteboard functionality.

## Global Constraints
- Every direct link to `/classroom/[roomId]` without authenticated teacher session must default strictly to `student` role.
- All whiteboard drawings, strokes, and pages must be preserved when archiving to past classes.
- Instant rooms must automatically transition to past classes 15 minutes after joining or upon explicit class termination.
- Existing WebRTC, Fabric engine, and signaling tests must continue to pass without regression.

## Review Focus
1. An unauthenticated user visiting `/classroom/[roomId]?role=teacher` must still be demoted to `student` if not authenticated as teacher.
2. Multiple active rooms created in succession must all appear in the Active Links list and persist across page refreshes.
3. Deleting an active room must remove its shareable link immediately and prevent students from using a revoked link.
4. An instant room joined at T=0 must expire and move to Past Classes at T >= 15 minutes without losing the whiteboard content drawn during the lesson.
5. Restoring a past class whiteboard into a live session must cleanly load all saved pages, background worksheets, and drawings while broadcasting the update to peers.

---

### Task 1: Teacher Authentication & Student-Default Role Enforcement

**Files:**
- Create: `src/lib/auth/teacher-auth.ts`
- Create: `src/components/auth/TeacherLoginModal.tsx`
- Modify: `src/app/classroom/[roomId]/page.tsx:1-54`
- Modify: `src/components/classroom/ClassroomView.tsx:40-75`
- Test: `tests/auth/teacher-auth.test.ts`

**Interfaces:**
- Consumes: `createBrowserClient` from `src/lib/supabase/client.ts`
- Produces: 
  - `getTeacherSession(): { isAuthenticated: boolean; teacherName: string; teacherId: string } | null`
  - `loginTeacher(passcodeOrPassword: string, name?: string): boolean`
  - `logoutTeacher(): void`
  - `TeacherLoginModal({ isOpen, onClose, onLoginSuccess })`

- [ ] **Step 1: Write the failing test for teacher auth and role resolution**
Write tests in `tests/auth/teacher-auth.test.ts` verifying:
1. `getTeacherSession()` returns null by default.
2. `loginTeacher('injasraj123')` authenticates and persists teacher session in browser storage/cookie.
3. Unauthenticated requests to role resolution resolve to `'student'`.
4. Authenticated requests resolve to `'teacher'`.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/auth/teacher-auth.test.ts`
Expected: FAIL ("cannot find module src/lib/auth/teacher-auth")

- [ ] **Step 3: Implement `teacher-auth.ts` and `TeacherLoginModal.tsx`**
Implement secure session storage with teacher credentials (default teacher passcode `injasraj123` / customizable password), session persistence, and `TeacherLoginModal` dialog with Emil-styled glass design.

- [ ] **Step 4: Update `/classroom/[roomId]/page.tsx` and `ClassroomView.tsx`**
Ensure that `resolvedRole` defaults to `'student'`. If `searchParams.role === 'teacher'`, check `getTeacherSession()` (or server auth cookie); if absent, downgrade to `'student'` and display a banner allowing teacher login.

- [ ] **Step 5: Run tests to verify they pass**
Run: `npx vitest run tests/auth/teacher-auth.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add src/lib/auth/teacher-auth.ts src/components/auth/TeacherLoginModal.tsx src/app/classroom/[roomId]/page.tsx src/components/classroom/ClassroomView.tsx tests/auth/teacher-auth.test.ts
git commit -m "feat(auth): add teacher authentication and enforce student-by-default role resolution"
```

---

### Task 2: Active Room & Link Management Engine

**Files:**
- Create: `src/lib/classroom/room-manager.ts`
- Test: `tests/classroom/room-manager.test.ts`

**Interfaces:**
- Consumes: `Lesson` from `src/types/database.ts`
- Produces:
  - `interface ManagedRoom { id: string; roomId: string; title: string; type: 'instant' | 'scheduled'; createdAt: string; joinedAt?: string; expiresAt?: string; status: 'active' | 'expired' | 'completed' }`
  - `createManagedRoom(roomId: string, type: 'instant' | 'scheduled', title?: string): ManagedRoom`
  - `getActiveRooms(): ManagedRoom[]`
  - `recordRoomJoin(roomId: string): ManagedRoom | null`
  - `deleteManagedRoom(roomId: string): boolean`
  - `checkAndExpireRooms(): { active: ManagedRoom[]; expired: ManagedRoom[] }`

- [ ] **Step 1: Write the failing test for room management and 15-minute expiry**
Write tests in `tests/classroom/room-manager.test.ts` verifying:
1. `createManagedRoom` adds a room to the active roster.
2. `getActiveRooms` retrieves all active rooms.
3. `recordRoomJoin` stamps `joinedAt` and sets `expiresAt = joinedAt + 15 minutes` for instant rooms.
4. `checkAndExpireRooms` flags instant rooms as `expired` once 15 minutes elapse from join time.
5. `deleteManagedRoom` removes the active room immediately.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/classroom/room-manager.test.ts`
Expected: FAIL ("cannot find module src/lib/classroom/room-manager")

- [ ] **Step 3: Implement `src/lib/classroom/room-manager.ts`**
Implement storage-backed room management tracking creation, join times, 15-minute TTL calculation, and clean deletion.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/classroom/room-manager.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/lib/classroom/room-manager.ts tests/classroom/room-manager.test.ts
git commit -m "feat(classroom): implement active room manager with 15-minute instant TTL"
```

---

### Task 3: Past Classes Archival & Whiteboard Session Storage

**Files:**
- Create: `src/lib/classroom/past-classes.ts`
- Modify: `src/lib/whiteboard/whiteboard-persistence.ts`
- Test: `tests/classroom/past-classes.test.ts`

**Interfaces:**
- Consumes: `WhiteboardSessionRecord` from `src/lib/whiteboard/whiteboard-persistence.ts`
- Produces:
  - `interface PastClassRecord { id: string; roomId: string; title: string; date: string; durationSeconds: number; pageCount: number; whiteboardSnapshot?: WhiteboardSessionRecord }`
  - `archiveClassToHistory(roomId: string, title?: string, durationSeconds?: number): Promise<PastClassRecord>`
  - `getPastClasses(): PastClassRecord[]`
  - `getPastClassWhiteboard(roomId: string): Promise<WhiteboardSessionRecord | null>`
  - `deletePastClass(id: string): void`

- [ ] **Step 1: Write the failing test for past classes archival**
Write tests in `tests/classroom/past-classes.test.ts` verifying:
1. When a class is archived, it stores room metadata, duration, and associated whiteboard pages.
2. `getPastClasses()` returns archived classes sorted by date descending.
3. `getPastClassWhiteboard(roomId)` retrieves the full serialized canvas session with all pages intact.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/classroom/past-classes.test.ts`
Expected: FAIL ("cannot find module src/lib/classroom/past-classes")

- [ ] **Step 3: Implement `src/lib/classroom/past-classes.ts`**
Implement archival functions reading from `whiteboard_sessions` and persisting past class history in local storage and Supabase.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/classroom/past-classes.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/lib/classroom/past-classes.ts tests/classroom/past-classes.test.ts
git commit -m "feat(classroom): implement past classes history and whiteboard archival"
```

---

### Task 4: Teacher Dashboard - Active Links HUD, Login State & Past Classes View

**Files:**
- Modify: `src/app/page.tsx:1-402`
- Create: `src/components/dashboard/ActiveRoomsManager.tsx`
- Create: `src/components/dashboard/PastClassesManager.tsx`
- Test: `tests/dashboard/dashboard-rooms.test.tsx`

**Interfaces:**
- Consumes: `teacher-auth`, `room-manager`, `past-classes`
- Produces:
  - Rendered "Active Class Links" component showing live countdowns, student link copy, and deletion.
  - Rendered "Past Classes" tab with whiteboard restoration action.
  - Teacher login header state with Logout and Login trigger.

- [ ] **Step 1: Write failing component tests for ActiveRoomsManager and PastClassesManager**
Write tests in `tests/dashboard/dashboard-rooms.test.tsx` verifying:
1. Active links display student-formatted links (with `role=student` or default clean URL).
2. Clicking "Delete" removes the room from the active list.
3. Instant rooms display remaining time out of 15 minutes.
4. "Past Classes" list displays archived sessions with a "Restore Whiteboard" or "Launch with Whiteboard" button.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/dashboard/dashboard-rooms.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `ActiveRoomsManager.tsx` and `PastClassesManager.tsx`**
Build interactive glass components adhering to the Emil Kowalski design tokens, featuring:
- Real-time countdown timer for 15-minute instant rooms.
- 1-click student link copy with tooltip.
- Launch as Teacher action.
- Revoke / Delete confirmation.
- Past classes browser with page badges, lesson duration, and "Launch with Whiteboard" action.

- [ ] **Step 4: Integrate into `src/app/page.tsx`**
Wire the new managers and teacher auth header into `TeacherDashboardPage`.

- [ ] **Step 5: Run tests to verify they pass**
Run: `npx vitest run tests/dashboard/dashboard-rooms.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**
```bash
git add src/components/dashboard/ActiveRoomsManager.tsx src/components/dashboard/PastClassesManager.tsx src/app/page.tsx tests/dashboard/dashboard-rooms.test.tsx
git commit -m "feat(dashboard): integrate active room manager, past classes list, and teacher login"
```

---

### Task 5: In-Classroom Whiteboard Reload from Past Sessions

**Files:**
- Modify: `src/components/classroom/ClassroomWorkspace.tsx:1000-1120`
- Modify: `src/components/whiteboard/StudioSidePanel.tsx`
- Modify: `src/components/whiteboard/tabs/MaterialsTab.tsx`
- Test: `tests/whiteboard/restore-whiteboard.test.tsx`

**Interfaces:**
- Consumes: `getPastClasses` and `getPastClassWhiteboard` from `past-classes.ts`
- Produces:
  - Inside Materials/Tools tab: "Past Whiteboards" accordion / list.
  - Clicking "Restore Whiteboard" replaces current pages with historical pages, loads canvas JSON, and broadcasts page sync to all participants.

- [ ] **Step 1: Write failing test for restoring past whiteboard inside the classroom**
Write tests in `tests/whiteboard/restore-whiteboard.test.tsx` verifying:
1. Teacher can select a past class from MaterialsTab.
2. Clicking "Restore into Current Session" updates pageManager with past class pages.
3. Canvas loads the past page JSON and background images.
4. An update event is broadcast so student views update in real-time.

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/whiteboard/restore-whiteboard.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement whiteboard restoration in `MaterialsTab.tsx` and `ClassroomWorkspace.tsx`**
Add past whiteboards browser to Materials tab and wire `onRestoreWhiteboardSession(sessionRecord)` in `ClassroomWorkspace`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/whiteboard/restore-whiteboard.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/classroom/ClassroomWorkspace.tsx src/components/whiteboard/StudioSidePanel.tsx src/components/whiteboard/tabs/MaterialsTab.tsx tests/whiteboard/restore-whiteboard.test.tsx
git commit -m "feat(whiteboard): add in-classroom whiteboard restoration from past classes"
```

---

### Task 6: Full Integration & Regression Verification

**Files:**
- Test: Run complete suite across all 53+ test files
- Build: Verify production Next.js build

- [ ] **Step 1: Run entire test suite**
Run: `npm test -- --run`
Expected: 54+ test files pass, 0 failures.

- [ ] **Step 2: Run Next.js production build**
Run: `npm run build`
Expected: Build succeeds without TypeScript or bundling errors.

- [ ] **Step 3: Final commit**
```bash
git commit -m "chore: complete teacher auth, active room manager, 15m ttl, and whiteboard restoration"
```
