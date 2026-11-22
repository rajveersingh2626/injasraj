# Injasraj Classroom - Agent Handover & Operational Guide

> **MANDATORY AGENT DIRECTIVE**:
> If you are an AI agent working on this codebase, **YOU MUST UPDATE THIS FILE (`HANDOVER.md`) AND `CONTEXT.md` EVERY TIME YOU MAKE A CHANGE**.
> Document what you changed, the new git commit, test outcomes, and any new architectural decisions.

---

## 1. Current Repository Status

- **Current Branch**: `main`
- **Latest Commits**:
  - `3f3b357`: *fix(dashboard): remove demo lessons and placeholder data from main website*
  - `7bfebed`: *feat(classroom): add StudentNameModal for student entry and name persistence*
  - `bca816f`: *feat(classroom): remove teacher login from classroom page and enable multi-student presence*
- **Test Suite**: **64/64 test suites passed (689/689 tests)** via Vitest.
- **Production Build**: **Clean build** via `npm run build` (Next.js 15.5.29 App Router, React 19).
- **Working Tree**: Clean.

---

## 2. Quick Command Reference

```powershell
# Run the local development server (http://localhost:3000)
npm run dev

# Run full Vitest test suite once
npm test -- --run

# Run a specific test file
npx vitest run tests/e2e/booking-to-classroom.test.tsx

# Run Next.js production build check
npm run build

# Run linter
npm run lint
```

---

## 3. Credentials & Persistent Keys

| Key / Config | Value / Default | Purpose |
| :--- | :--- | :--- |
| **Teacher Passcode** | `injasraj123` | Unlocks teacher controls in login modal. |
| **Default Teacher ID** | `teacher-1` | Teacher user identifier for booking and routing. |
| **Default Teacher Name**| `Injasraj` | Display name for teacher badge. |
| **Teacher Storage Key** | `injasraj_teacher_session` | LocalStorage JSON session for teacher auth. |
| **Teacher Auth Cookie** | `injasraj_teacher_auth=1` | Session cookie for SSR & route protection. |
| **Active Rooms Storage**| `injasraj_active_rooms` | LocalStorage JSON array of active room records. |
| **Past Classes Storage**| `injasraj_past_classes` | LocalStorage JSON array of past classes & whiteboard snapshots. |
| **Supabase URL / Key** | Configured in `.env.local` | Mock / production Supabase endpoint for signaling & Postgres persistence. |
| **LiveKit URL** | `wss://injasraj-aosxldu2.livekit.cloud` | LiveKit Cloud WebSocket SFU endpoint. |
| **LiveKit API Key** | `APIHvFdBfBNLCmT` | Server SDK API key for minting access tokens. |
| **LiveKit API Secret** | `2z1mWnTuBa9LJSxz8PddvbGmIiAAeD0rdJsyIwi9fgw` | Server SDK API secret for signing JWT tokens. |

---

## 4. Key Rules for Future Agents

1. **Keep `CONTEXT.md` and `HANDOVER.md` Updated**:
   - Whenever you add a file, function, component, or change how state behaves, record it in both files.
2. **Never Break the Security Invariant**:
   - Shareable links (`/classroom/[roomId]`) **MUST ALWAYS** default to student view.
   - Do not grant teacher authority based solely on URL query parameters like `?role=teacher` unless authenticated against `getTeacherSession()`.
3. **Always Run the Test Suite**:
   - Before finishing any turn, run `npm test -- --run` and verify that all 682+ tests continue to pass.
   - Never remove or disable tests without explicit rationale.
4. **React 19 & Next.js 15 Rules**:
   - When unwrapping Promise props (`params` or `searchParams`), use `React.use()`.
   - **Never** call `React.use()` inside a `try/catch` block (React 19 fatal error).
   - Video elements require `playsInline`, `muted` for local streams, and manual attachment to prevent DOM detachment on re-renders.
5. **Fabric.js Canvas Invariants**:
   - Use `target.backgroundImageUrl || target.thumbnailUrl` when loading pages or worksheets so background templates are preserved.
   - Canvas coordinate transforms must account for high-DPI scaling and viewport zoom.
6. **LiveKit & P2P Media Invariants**:
   - `LiveKitMediaSession` handles SFU connection via `/api/livekit/token`.
   - Fall back smoothly to `P2PWebRTCMediaSession` if LiveKit fails or is unavailable in the environment.

---

## 5. Recent Implementation Milestones

### Milestone 1: PDF Multi-Page & Tool Fixes
- Added dedicated eraser tool (shortcut `E`) that erases discrete objects on mouse click or drag.
- Added multi-page PDF ingestion converting each page into consecutive whiteboard pages.
- Added top `< Page X of Y >` navigation pill and working Undo/Redo stack with keyboard shortcuts (`Ctrl+Z`, `Ctrl+Y`).

### Milestone 2: Teacher Auth & Student Link Default
- Added teacher passcode verification (`injasraj123`) with persistent session storage.
- Shareable links default strictly to student view.
- Added floating "Teacher Login" button inside the classroom for quick elevation.

### Milestone 3: Active Links Management HUD
- Added **Active Room Links** management tab on teacher dashboard.
- Displays active rooms, live countdown timers, 1-click copy of student link, direct teacher launch, and instant room deletion.

### Milestone 4: 15-Minute Instant Room Expiry & Archival
- Instant rooms automatically expire 15 minutes after the first participant joins.
- Expired rooms are automatically cleaned from the active HUD and archived to history with full multi-page whiteboard snapshots.
- Direct entry to expired links presents an informative expired screen.

### Milestone 5: Past Classes History & Whiteboard Restoration
- Added **Past Classes** tab on teacher dashboard showing past lessons with duration, date, and page count.
- Added **"Launch with Whiteboard"** button on dashboard to start fresh sessions pre-loaded with past notes.
- Added **Past Whiteboards** browser inside the classroom (under Studio Panel > Materials) for 1-click in-session restoration with real-time peer broadcast.

### Milestone 6: LiveKit Video SFU, In-Tab Navigable PDF Slides, Light Theme & Vertical Left Dock
- **LiveKit Cloud SFU Video Architecture**:
  - Integrated `livekit-client` and `livekit-server-sdk` with token minting API (`src/app/api/livekit/token/route.ts`).
  - Implemented `LiveKitMediaSession` adhering to `IMediaSession` with automatic fallback to P2P WebRTC.
  - Configured credentials in `.env.local`.
- **In-Tab Navigable PDF Slides**:
  - Render uploaded PDFs into raw 2x images using `pdfjs-dist` (`convertPdfToPageImages`).
  - Host the entire multi-page document within **one whiteboard tab** instead of spawning many tabs.
  - Floating bottom `PdfSubPageNavigator` (`< Page X of Y >`) with arrow keys navigation.
  - Retains per-slide ink strokes (`pageStrokes`) across navigation flips.
  - Composites all PDF slides and user drawings sequentially when clicking "Export All" (`exportMultiPagePdf`).
- **Vertical Left Dock & Collision Prevention**:
  - Docked `ControlBar` vertically on the left screen edge (`orientation: 'vertical'`) with a drag handle (`GripVertical`), completely eliminating collisions with the bottom whiteboard tools and PDF navigator.
- **Emil Kowalski Light Theme**:
  - Transitioned the entire dark workspace to a warm, airy light palette (`zinc-50` / `stone-50`, clean 1px borders, subtle drop shadows, and high contrast typography).
- **Test Suite**: Expanded to **63 test suites, 682 unit & integration tests**, all passing.

---

## 6. Next Steps / Potential Future Enhancements
- Export whiteboard notebook as searchable PDF or multi-page ZIP.
- Multi-teacher support if more tutors join the platform.
- Cloud recording of WebRTC video streams via MediaStream Recording API or egress service.
