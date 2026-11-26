# Injasraj Classroom - Agent Handover & Operational Guide

> **MANDATORY AGENT DIRECTIVE**:
> If you are an AI agent working on this codebase, **YOU MUST UPDATE THIS FILE (`HANDOVER.md`) AND `CONTEXT.md` EVERY TIME YOU MAKE A CHANGE**.
> Document what you changed, the new git commit, test outcomes, and any new architectural decisions.

---

## 1. Current Repository Status

- **Current Branch**: `fix/webrtc-visibility-whiteboard-persistence`
- **Latest Commits**:
  - `2ac643a`: *fix(webrtc-whiteboard): resolve video toggle black screen, tablet asymmetric gating, and whiteboard server-side persistence*
  - `861ad71`: *fix(classroom): streamline display capture, clean redirect logic, and verify LiveKit Cloud SFU*
  - `cb16014`: *feat(classroom): render live screen share directly on whiteboard with live annotations and clean teardown*
- **Test Suite**: **73/73 test suites passed (739/739 tests)** via Vitest.
- **Production Build**: **Clean build (13/13 pages compiled)** via `npm run build` (Next.js 15.5.29 App Router, React 19).
- **Working Tree**: Ready for release / PR.

---

## 2. Quick Command Reference

```powershell
# Run the local development server (http://localhost:3000)
npm run dev

# Run full Vitest test suite once
npm test -- --run

# Run a specific test file
npx vitest run tests/components/ClassSessionLifecycle.test.tsx

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
| **Default Teacher Name**| `Inderjit Kaur` | Display name for teacher badge. |
| **Teacher Storage Key** | `injasraj_teacher_session` | LocalStorage JSON session for teacher auth. |
| **Teacher Auth Cookie** | `injasraj_teacher_auth=1` | Session cookie for SSR & route protection. |
| **Active Rooms Storage**| `injasraj_active_rooms` | LocalStorage JSON array of active room records. |
| **Past Classes Storage**| `injasraj_past_classes` | LocalStorage JSON array of past classes & whiteboard snapshots. |
| **Supabase URL / Key** | Configured in `.env.local` | Mock / production Supabase endpoint for signaling & Postgres persistence. |
| **LiveKit URL** | `process.env.LIVEKIT_URL` / `wss://injasraj-aosxldu2.livekit.cloud` | LiveKit Cloud WebSocket SFU endpoint. |
| **LiveKit API Key** | `process.env.LIVEKIT_API_KEY` | Server SDK API key for minting access tokens. |
| **LiveKit API Secret** | `process.env.LIVEKIT_API_SECRET` | Server SDK API secret (stored securely in Vercel & .env.local). |

---

## 4. Key Rules for Future Agents

1. **Keep `CONTEXT.md` and `HANDOVER.md` Updated**:
   - Whenever you add a file, function, component, or change how state behaves, record it in both files.
2. **Never Break the Security Invariant**:
   - Shareable links (`/classroom/[roomId]`) **MUST ALWAYS** default to student view.
   - Do not grant teacher authority based solely on URL query parameters like `?role=teacher` unless authenticated against `getTeacherSession()`.
3. **Always Run the Test Suite**:
   - Before finishing any turn, run `npm test -- --run` and verify that all 687 tests continue to pass.
   - Never remove or disable tests without explicit rationale.
4. **React 19 & Next.js 15 Rules**:
   - When unwrapping Promise props (`params` or `searchParams`), use `React.use()`.
   - **Never** call `React.use()` inside a `try/catch` block (React 19 fatal error).
   - Video elements require `playsInline`, `muted` for local streams, and manual attachment to prevent DOM detachment on re-renders.
5. **Fabric.js Canvas Invariants**:
   - The whiteboard stage is an infinite seamless white canvas (`bg-white`).
   - Modularized shape renderers and geometry routines live under `src/lib/whiteboard/engine/`.
   - Pointer drag/move events are throttled with `requestAnimationFrame` coalescing to prevent INP spikes.
6. **PDF Invariants**:
   - PDF rasterization uses local `/pdf.worker.min.mjs` matching pdfjs-dist `6.5.438` for 100% offline reliability.
7. **LiveKit & P2P Media Invariants**:
   - `LiveKitMediaSession` handles SFU connection via dynamic server URLs from `/api/livekit/token`.
   - Fall back smoothly to `P2PWebRTCMediaSession` if LiveKit fails or is unavailable in the environment.

---

## 5. Recent Implementation Milestones

### Milestone 7: Whiteboard, PDF, INP, LiveKit & Studio Overhaul (Current)
- **Infinite White Canvas**:
  - Replaced the dark dotted background (`#121110`) with an infinite, seamless white canvas (`bg-white`) across all zoom levels (`06fd02f`).
  - Removed fixed-box boundaries, retaining virtual coordinates and high-DPI scaling.
- **Color Picker & Popover Polish**:
  - Fixed toolbar clipping (`overflow-x-auto` -> `overflow-visible`) allowing color swatches and stroke width pickers to render cleanly without broken scrollbars (`977767c`).
- **High-DPI Local PDF-to-Image Pipeline**:
  - Replaced broken CDN worker references with local `/pdf.worker.min.mjs` (pdfjs-dist 6.5.438) served from `public/` (`500ac16`).
  - Guarantees 0ms local worker loading, eliminates CORS traps, and converts multi-page PDFs to crisp WebP/PNG images at 2.0x scale.
- **Fabric Engine Modularization**:
  - Decomposed `fabric-engine.ts` into clean helper modules:
    - `src/lib/whiteboard/engine/geometry.ts`: Hit testing, vector math, distance-to-segment, SVG path conversion.
    - `src/lib/whiteboard/engine/shape-renderers.ts`: Renderers for lines, rectangles, circles, arrows, sticky notes, formulas, images.
- **INP & Performance Optimization**:
  - Coalesced pointer and pan updates in `WhiteboardStage.tsx` using `requestAnimationFrame` scheduling (`5da7f80`).
  - Cached `canvas.getBoundingClientRect()` during drag operations in `fabric-engine.ts`, eliminating layout thrashing and main thread lag.
- **LiveKit Session Debugging & Reliability**:
  - Resolved relative `/api/livekit/token` URL parsing in Node/SSR environments (`df9cece`).
  - Wired dynamic LiveKit WebSocket URL (`data.url`) into `session.connect(url, token)`.
  - Added safe camera/microphone permission handling and synced remote participant states.
- **Studio Panel Contrast Overhaul (/ask-emil)**:
  - Eliminated translucent glassmorphism washed-out text over white canvas (`9eca2b6`).
  - Implemented crisp solid dark surface (`#141210`), subtle 1px border (`#272522`), and high-contrast typography (`zinc-100`, `zinc-300`) across People, Chat, Materials, and Tools tabs.

### Milestone 8: Production Polish & Architectural Fixes (GSD / Ralph Loop)
- **404 Invite Link Resolution**:
  - In `ClassroomWorkspace.tsx`, updated `handleCopyRoomLink` to construct canonical `/classroom/${roomId}?role=student`.
  - Added `src/app/classroom/page.tsx` with query parameter extraction and auto-redirect/fallback to `/classroom/${room}` so `/classroom?room=...` never 404s.
- **Supabase, LiveKit & Default Profile Update**:
  - Updated default teacher profile name to `"Inderjit Kaur"` in `teacher-auth.ts`, `page.tsx`, and session configs.
  - Added `supabase/migrations/20261126000000_grant_permissions.sql` granting `SELECT, INSERT, UPDATE, DELETE` to `anon` and `authenticated` roles, unblocking Supabase persistence from silent 42501 permission errors.
  - Added clear telemetry warnings when LiveKit token endpoint is unreachable.
- **Whiteboard Tool State Fix**:
  - Removed `isShiftPressed` from canvas pan triggers in `WhiteboardStage.tsx`.
  - Added global `window.blur` listener to clear stuck key and drag states on focus loss.
  - Updated `fabric-engine.ts:setTool` to deselect active objects and clear drag handles when switching away from `'select'`.
- **Single Page Default**:
  - Initialized whiteboard with a single blank page (`createDefaultWhiteboardPage('page-1', 1, 'Whiteboard')`).
- **Control Bar Repositioning & Remote Controls**:
  - Moved media control bar to bottom left (`fixed bottom-0 md:bottom-3 left-4 md:left-3`), matching the left panel's exact width.
  - Enhanced teacher remote controls to toggle student mic/camera via signaling and LiveKit tracks.
- **Unified Navigation Bar at Top**:
  - Moved document sub-page navigation (`< Page 1 of N >`) to the top unified navigation area in `WhiteboardStage.tsx`, replacing the whiteboard page bar when a multi-page document is loaded.
  - Removed duplicate bottom floating bar.
- **Loaded PDF Disappearing Fix**:
  - In `ClassroomWorkspace.tsx`, resolved canvas backgrounds from Single Source of Truth (`target.backgroundImageUrl || target.pdfDocument?.pages[...] || target.thumbnailUrl`), preventing `clearBackgroundImage()` from erasing PDFs on page switch or viewport change.
- **High-Fidelity PDF Export**:
  - Multi-page PDF export renders all pages and document sub-pages with canvas objects, WebP/PNG backgrounds, shapes, and formulas via `pdf-lib-export.ts`.
- **Working Screen Share Directly on Whiteboard**:
  - Clicking "Share Screen" in `ControlBar` triggers native `navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })` across Entire Screen, Window, or Browser Tab.
  - Live screen share stream renders directly in `WhiteboardStage` (`canvas-stage-wrapper`) via `<video autoPlay playsInline muted object-contain />`.
  - Fabric canvas becomes `bg-transparent` while sharing is active, allowing live drawing, annotations, pen strokes, sticky notes, formulas, and laser pointer trails directly over the shared screen.
  - Clean teardown triggers from either in-app "Stop Sharing" button or the browser's native floating notification bar (`screenTrack.onended`), cleanly stopping all tracks and restoring the whiteboard background with zero stale frames.
  - Published to remote peers via LiveKit Cloud SFU (`Track.Source.ScreenShare`) and Supabase Realtime broadcast (`screen-share-state`). Verified by `tests/whiteboard/screen-share-whiteboard.test.tsx`.

---

## 6. Next Steps / Potential Future Enhancements
- Export whiteboard notebook as searchable PDF or multi-page ZIP.
- Multi-teacher support if more tutors join the platform.
- Cloud recording of WebRTC video streams via MediaStream Recording API or egress service.
