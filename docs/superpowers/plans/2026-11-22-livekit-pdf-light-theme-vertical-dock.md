# LiveKit Video, Navigable PDF Slides, Light Theme & Vertical Dock Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul the Injasraj classroom with production-grade LiveKit video conferencing, a client-side multi-page PDF image converter with in-tab sub-page navigation and export, an Apple/Emil-inspired light theme, and a vertical left-docked media control bar with non-colliding layout.

**Architecture:**
1. **LiveKit Video SFU with Automatic P2P Fallback**: Next.js server route `/api/livekit/token` issues JWT participant tokens using `livekit-server-sdk`. Client connects via `livekit-client` inside `ClassroomWorkspace`, binding remote/local tracks with mic/camera toggle and screen share. If the monthly LiveKit cloud quota is reached (HTTP 429 / limit exceeded) or if `NEXT_PUBLIC_FORCE_VIDEO_MODE=p2p`, the classroom automatically and seamlessly falls back to Supabase Realtime P2P WebRTC (`p2p-session.ts` with public STUN servers) without interrupting user experience or altering UI components.
2. **Navigable PDF-as-Images Engine**: Client-side `pdfjs-dist` converts uploaded PDFs into ordered high-resolution canvas image data URLs (`image/png` or `image/webp`). The active whiteboard tab stores `pdfDocument: { pages: string[], currentPage: number }`. An in-tab bottom pagination pill (`Page < 1 / N >`) allows flipping through pages on the same canvas while preserving per-page Fabric stroke drawings. Multi-page exporter composites every slide's strokes and background image into the final PDF.
3. **Left Vertical Dock & Layout Harmonization**: Shift camera/mic controls from bottom horizontal to a sleek left vertical floating pill (`fixed left-4 top-1/2 -translate-y-1/2 flex flex-col`). Cleanly offset and dock the whiteboard toolbar so elements never collide or stack on top of each other.
4. **Emil Kowalski Light Theme**: Shift the dark `#09090b`/`zinc-950` shell to warm light glass (`bg-[#f8f9fb]`, `bg-white/80 backdrop-blur-xl border border-zinc-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)]`, high-contrast `text-zinc-900`/`text-zinc-500`, soft tactile `:active` states).

**Tech Stack:**
- Next.js 15, React 19, TypeScript
- LiveKit (`livekit-client`, `livekit-server-sdk`, `@livekit/components-react`)
- `pdfjs-dist` (client-side worker for high-res PDF page rasterization)
- Fabric.js custom canvas engine, Lucide React, Tailwind CSS 3.4

---

## Global Constraints
- Preserve existing whiteboard tools (pen, highlighter, eraser, shapes, math equations, grid patterns, undo/redo).
- Do not break existing classroom sessions, past classes history, or teacher login.
- Zero server-side file dependencies for PDF conversion: client-side processing directly converts bytes to images.
- Responsive and accessible on desktop and tablet viewport widths.

---

## Review Focus
1. **LiveKit Token Generation & Room Join**: Correct role assignment (`teacher` publisher vs `student`), room identity matching, and error resilience when network glitches occur.
2. **PDF Page Rasterization Quality & Scale**: High-DPI rasterization (scale 2.0) with clean memory cleanup so 30-page PDFs do not freeze the browser tab.
3. **In-Tab Drawing State Persistence Across PDF Pages**: Switching from Page 1 to Page 2 must not wipe Page 1's pencil/highlighter strokes; switching back must restore Page 1's strokes cleanly.
4. **Dock Positioning & Viewport Clashing**: Left vertical bar must not collide with the whiteboard drawing toolbar, side panel, or mobile bottom safe-areas.
5. **Light Mode Contrast & Legibility**: Ensure all text, icons, tool buttons, and stroke color selectors are sharp and readable against light backgrounds.

---

### Task 1: Environment & LiveKit Server Token API (with Quota Handling)
**Files:**
- Create: `src/app/api/livekit/token/route.ts`
- Modify: `.env.local`
- Test: `tests/livekit-token.test.ts`

- [ ] Add LiveKit environment variables to `.env.local` (`LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL`, `NEXT_PUBLIC_FORCE_VIDEO_MODE`).
- [ ] Install `livekit-server-sdk` and `livekit-client`.
- [ ] Create `/api/livekit/token` route handler that accepts `room`, `username`, and `role` query parameters, validates them, and mints an AccessToken with video grant.
- [ ] Implement quota error trap: if LiveKit Cloud credentials fail or quota is exceeded, return clean JSON `{ fallbackToP2P: true, reason: 'quota_exceeded' }` with status 200/429.
- [ ] Write Vitest unit test asserting valid JWT token generation and error fallback response structure.

---

### Task 2: LiveKit Video Integration with Automatic P2P WebRTC Fallback
**Files:**
- Create: `src/lib/webrtc/livekit-session.ts`
- Modify: `src/lib/webrtc/p2p-session.ts`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/components/classroom/VideoCard.tsx`
- Test: `tests/livekit-session.test.ts`

- [ ] Implement `LiveKitSessionManager` to connect to LiveKit with room token, publish local camera/mic, and subscribe to remote peer tracks.
- [ ] Implement seamless fallback orchestrator: if `NEXT_PUBLIC_FORCE_VIDEO_MODE=p2p` or if token endpoint returns `fallbackToP2P` or LiveKit connection fails with quota/billing errors, automatically engage `P2PSession` via Supabase Realtime signaling.
- [ ] Ensure `VideoCard`, `ControlBar`, mic/camera toggle, and screen share interact through a unified media track interface so the user sees identical UI in either mode.
- [ ] Write Vitest tests verifying room connection lifecycle, track events, and fallback to P2P when LiveKit connection fails.

---

### Task 3: Client-Side PDF Rasterization to Raw Images
**Files:**
- Modify: `package.json` (install `pdfjs-dist`)
- Modify: `src/lib/whiteboard/pdf-renderer.ts`
- Test: `tests/pdf-images-converter.test.ts`

- [ ] Install `pdfjs-dist` and configure client-side worker script.
- [ ] Implement `convertPdfToPageImages(fileOrBuffer: ArrayBuffer, scale = 2.0): Promise<string[]>` that extracts every page into a crisp data URL image.
- [ ] Add progress callback `(progress: { current: number, total: number }) => void` for smooth upload feedback.
- [ ] Add unit test verifying PDF parsing and fallback mock handling.

---

### Task 4: In-Tab Sub-Page Whiteboard Navigation & Per-Page Stroke State
**Files:**
- Modify: `src/types/whiteboard.ts`
- Modify: `src/components/whiteboard/WhiteboardStage.tsx`
- Create: `src/components/whiteboard/PdfSubPageNavigator.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Test: `tests/pdf-subpage-navigation.test.ts`

- [ ] Extend `WhiteboardPage` type with optional `pdfDocument?: { pages: string[]; currentPage: number; totalPages: number; pageStrokes: Record<number, string> }`.
- [ ] When a PDF is loaded, assign it to the current active tab and render the first page image as the canvas background.
- [ ] Build `PdfSubPageNavigator`: clean bottom floating pill on the whiteboard stage with `< Page 1 / 12 >` navigation, direct page jump, and thumbnail drawer.
- [ ] On page switch: serialize current canvas strokes into `pageStrokes[currentPage]`, swap background image to `pages[nextPage]`, and load `pageStrokes[nextPage]`.
- [ ] Update multi-page PDF export to loop over all PDF sub-pages and composite them into the exported document.

---

### Task 5: Left Vertical Media Dock & Non-Colliding Layout
**Files:**
- Modify: `src/components/classroom/ControlBar.tsx`
- Modify: `src/components/whiteboard/WhiteboardToolbar.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Test: `tests/control-bar-vertical.test.ts`

- [ ] Redesign `ControlBar` to render as a vertical glass pill docked on the left (`fixed left-4 top-1/2 -translate-y-1/2 z-40 flex flex-col gap-2.5`).
- [ ] Adjust popovers (audio/video device settings) to fly out to the right side with proper spacing.
- [ ] Offset `WhiteboardToolbar` cleanly (e.g. docked vertically alongside or placed cleanly at top-left/bottom-center) so it never clashes with the vertical media dock.
- [ ] Ensure full responsiveness and collapse to a compact bottom pill on small mobile screens.

---

### Task 6: Comprehensive Emil Kowalski Light Theme Overhaul
**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/ui/GlassCard.tsx`
- Modify: `src/components/ui/GlassButton.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/components/whiteboard/BrowserTabBar.tsx`
- Modify: `src/components/whiteboard/PageNavigationBar.tsx`
- Modify: `src/components/whiteboard/StudioSidePanel.tsx`
- Modify: `src/components/whiteboard/WhiteboardStage.tsx`
- Modify: `src/components/classroom/VideoCard.tsx`

- [ ] Update CSS variables and root palette to light mode: `#f8f9fb` canvas, `#f1f3f7` borders, `#0f172a` primary text, `#64748b` secondary text.
- [ ] Redesign `GlassCard` and `GlassButton` with frosted white glass: `bg-white/85 border border-zinc-200/90 shadow-[0_8px_30px_rgb(0,0,0,0.06)] backdrop-blur-xl`.
- [ ] Update `BrowserTabBar`, `StudioSidePanel`, and modal dialogs with light aesthetic, crisp typography, and Emil Kowalski `:active` micro-feedback.
- [ ] Run full test suite and verify end-to-end rendering.
