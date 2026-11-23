# Injasraj Classroom - Agent Handover & Operational Guide

> **MANDATORY AGENT DIRECTIVE**:
> If you are an AI agent working on this codebase, **YOU MUST UPDATE THIS FILE (`HANDOVER.md`) AND `CONTEXT.md` EVERY TIME YOU MAKE A CHANGE**.
> Document what you changed, the new git commit, test outcomes, and any new architectural decisions.

---

## 1. Current Repository Status

- **Current Branch**: `main`
- **Latest Commits**:
  - `9eca2b6`: *style(studio-panel): eliminate glassmorphism contrast failure with solid surface and high-contrast typography*
  - `df9cece`: *fix(livekit): resolve session connection, server URL routing, and track subscription*
  - `5da7f80`: *perf(whiteboard): optimize pointer move handlers with RAF coalescing to eliminate INP lag*
  - `b720cbd`: *refactor(whiteboard): modularize fabric engine into geometry and shape renderers*
  - `500ac16`: *fix(pdf): resolve worker version mismatch and serve local worker for high-dpi rendering*
  - `977767c`: *fix(toolbar): resolve color picker popover clipping by setting overflow-visible*
  - `06fd02f`: *fix(whiteboard): make viewport an infinite seamless white canvas*
- **Test Suite**: **64/64 test suites passed (687/687 tests)** via Vitest.
- **Production Build**: **Clean build** via `npm run build` (Next.js 15.5.29 App Router, React 19).
- **Working Tree**: Ready for release.

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

---

## 6. Next Steps / Potential Future Enhancements
- Export whiteboard notebook as searchable PDF or multi-page ZIP.
- Multi-teacher support if more tutors join the platform.
- Cloud recording of WebRTC video streams via MediaStream Recording API or egress service.
