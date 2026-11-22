# Injasraj Classroom & Teaching Whiteboard - Complete System Context

> **CRITICAL DIRECTIVE FOR ALL AI AGENTS & CONTRIBUTORS**:
> **MANDATORY UPDATE RULE**: Whenever you create, modify, refactor, or delete any file, component, library, route, or data schema in this repository, **YOU MUST UPDATE THIS FILE (`CONTEXT.md`) AND `HANDOVER.md` BEFORE CONCLUDING YOUR TURN**. Never leave this context map out of sync with the codebase.

---

## 1. System Vision & Architecture Overview

**Injasraj Classroom** is a high-performance, real-time, peer-to-peer virtual classroom and collaborative teaching whiteboard built specifically for online instruction (e.g. Punjabi, mathematics, science).

### Core Pillars
1. **LiveKit SFU & P2P WebRTC Video Conferencing**: Low-latency media streaming with LiveKit Cloud SFU (simulcast, automatic quality scaling, adaptive bitrate) backed by P2P WebRTC fallback.
2. **Deterministic Dual-Mode Fabric.js Whiteboard Engine**: Hardware-accelerated, infinite canvas supporting multi-page notebooks, in-tab navigable PDF slide decks, rough/excalidraw shapes, freehand drawing, dedicated object eraser, laser pointer trails, zoom/pan transforms, and LaTeX formula insertion.
3. **Realtime Broadcast Synchronization**: Zero-backend state broadcast via Supabase Realtime Channel (`broadcast` mode) for cursor tracking, drawing commands, laser trails, page flips, and viewport sync ("Follow Teacher").
4. **Persistent Debounced Storage**: Automatic multi-page saving to Supabase Postgres with in-memory / `localStorage` fallback, preserving full canvas JSON, background images, and PDF slide decks.
5. **Teacher Authentication & Strict Role Enforcement**: Security barrier ensuring all shareable links default to **Student View**. Only users authenticated with passcode `injasraj123` can unlock **Teacher View** and teacher controls.
6. **Active Room Lifecycle & Auto-Archival**: Real-time room manager with 15-minute TTL on instant sessions, instant room revoking, and automatic multi-page whiteboard archival to **Past Classes** with 1-click reload.
7. **Emil Kowalski Design Engineering & Vertical Left Dock**: Warm, airy light theme (`zinc-50` / `stone-50`), draggable vertical left control bar to prevent toolbar collisions, and floating glass pills.

---

## 2. Technology Stack & Key Libraries

| Layer | Technology / Library | Role & Details |
| :--- | :--- | :--- |
| **Framework** | Next.js 15.5+ (App Router) | React 19 server/client components, dynamic routes (`[roomId]`, `[teacherId]`), API route handlers. |
| **Runtime & Language**| TypeScript 5.9+ / Node.js 24+ | Strict type checking, zero `any` tolerance on critical paths. |
| **Styling & UI** | Tailwind CSS 3.4+, Lucide React | Emil Kowalski design philosophy: warm airy light palette, subtle 1px zinc borders, translucent glass pills, micro-interactions. |
| **Whiteboard Canvas** | Fabric.js 6.x | Custom engine managing canvas objects, freehand paths, text, eraser mode, zoom/pan, export. |
| **Video Conferencing**| LiveKit Cloud SFU (`livekit-client`, `livekit-server-sdk`) | Cloud SFU for high-fidelity multi-participant video/audio streaming, JWT token minting route, track subscriptions. |
| **Signaling & State** | `@supabase/supabase-js` | WebSocket signaling for WebRTC peer discovery and Realtime Broadcast whiteboard events. |
| **P2P Fallback Media**| WebRTC Native APIs | `RTCPeerConnection`, `MediaStream`, unified plan, perfect negotiation (`polite` pattern). |
| **Math Rendering** | KaTeX | Real-time LaTeX rendering for mathematical formulas rendered directly onto canvas. |
| **PDF Processing** | PDF.js (`pdfjs-dist`) / Custom HTML Canvas | Multi-page PDF rasterization into raw 2x images, in-tab slide navigation, and multi-page composite PDF export. |
| **Testing** | Vitest 3.2+, Testing Library | 63 test suites, 682 unit & integration tests, mock LiveKit, mock WebRTC, mock Supabase channel. |

---

## 3. Complete File-by-File Directory Map

### Root & Configuration Files
- [`package.json`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/package.json): Project dependencies, scripts (`dev`, `build`, `test`, `lint`).
- [`tsconfig.json`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/tsconfig.json): TypeScript compilation settings, `@/*` path aliases mapped to `./src/*`.
- [`vitest.config.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/vitest.config.ts): Vitest configuration, jsdom test environment, global setup, path resolution.
- [`tailwind.config.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/tailwind.config.ts): Design system theme colors (warm stone palette, zinc accents, custom shadows).
- [`next.config.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/next.config.ts) / [`next-env.d.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/next-env.d.ts): Next.js build and type configuration.
- [`.env.local`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/.env.local): Environment secrets (Supabase URL, anon key).
- [`CONTEXT.md`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/CONTEXT.md): **This file** — System architecture, comprehensive file map, and developer guidelines.
- [`HANDOVER.md`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/HANDOVER.md): Working memory, operational state, test statuses, and instructions for next agent.

---

### App Router Routes (`src/app/`)
- [`src/app/layout.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/app/layout.tsx): Root HTML shell, font declarations (Geist, Geist Mono), metadata, global body styling with overscroll prevention.
- [`src/app/globals.css`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/app/globals.css): Tailwind CSS directives, custom utilities (hide scrollbar, canvas touch action, animations).
- [`src/app/page.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/app/page.tsx): **Platform Home & Teacher Dashboard**.
  - Displays instant room creation banner, shareable booking link widget, and tab switcher.
  - Tabs: **Weekly Availability** (`TeacherAvailabilityForm`), **Active Room Links** (`ActiveRoomsManager`), **Past Classes** (`PastClassesManager`).
  - Periodically executes `checkAndExpireRooms()` every 4s, archiving expired sessions to history.
- [`src/app/book/[teacherId]/page.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/app/book/[teacherId]/page.tsx): **Student Booking Portal**.
  - Displays dual-timezone slot booking calendar for students across international timezones.
  - Automatically generates unique classroom room ID upon booking confirmation.
- [`src/app/classroom/[roomId]/page.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/app/classroom/[roomId]/page.tsx): **Live Classroom Route Entry**.
  - Next.js 15 App Router component handling Promise-based `params` and `searchParams`.
  - Enforces `student` role by default unless explicitly authenticated. Renders `<ClassroomView />`.
- [`src/app/api/livekit/token/route.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/app/api/livekit/token/route.ts): **LiveKit SFU JWT Token API**.
  - Generates secure `AccessToken` signed with `LIVEKIT_API_KEY` and `LIVEKIT_API_SECRET`.
  - Grants room permissions (`roomJoin`, `canPublish`, `canSubscribe`) keyed to participant identity and role (`teacher` or `student`).

---

### Authentication & Authorization (`src/lib/auth/`)
- [`src/lib/auth/teacher-auth.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/auth/teacher-auth.ts):
  - Passcode verification (`injasraj123`).
  - Session persistence in `localStorage` (`injasraj_teacher_session`) and session cookie (`injasraj_teacher_auth=1`).
  - `resolveUserClassroomRole(requestedRole)`: Authoritative role resolution ensuring unknown/unauthenticated links default to `'student'`.
  - `loginTeacher(passcode, name)` and `logoutTeacher()`.
- [`src/components/auth/TeacherLoginModal.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/auth/TeacherLoginModal.tsx):
  - Accessible modal dialog for entering teacher passcode.
  - Supports Enter key submission, error feedback, and instant role elevation.

---

### Room Lifecycle & History (`src/lib/classroom/`)
- [`src/lib/classroom/room-manager.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/classroom/room-manager.ts):
  - In-memory & `localStorage` store for active rooms (`injasraj_active_rooms`).
  - `createRoom(options)`: Registers active instant or scheduled rooms.
  - `recordRoomJoin(roomId)`: Starts the 15-minute countdown (`joinedAt + 15m`) upon the first user entering.
  - `checkAndExpireRooms()`: Sweeps active rooms, transitioning those past 15m to `status: 'expired'`.
  - `deleteRoom(roomId)`: Revokes and removes room from active HUD.
- [`src/lib/classroom/past-classes.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/classroom/past-classes.ts):
  - Archival store for completed or expired sessions (`injasraj_past_classes`).
  - `archiveClassToHistory(roomId, title, durationSeconds, snapshot)`: Captures multi-page whiteboard notebook snapshot from memory/database and persists to past classes record.
  - `getPastClasses()` and `deletePastClass(id)`.
  - `getPastClassWhiteboard(roomId)`: Fetches stored snapshot to reload into live or new classroom.

---

### Classroom Components (`src/components/classroom/`)
- [`src/components/classroom/ClassroomView.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/ClassroomView.tsx):
  - Main container integrating WebRTC media session, Supabase signaling, Whiteboard Realtime adapter, and Postgres persistence manager.
  - Enforces student security barrier; student view contains zero teacher login triggers.
  - Prompts students for their display name via `StudentNameModal` and broadcasts real-time participant presence.
  - Renders **"Classroom Session Expired"** screen if room is revoked or exceeded 15m.
- [`src/components/classroom/StudentNameModal.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/StudentNameModal.tsx):
  - Accessible modal dialog for entering and persisting student display name (`injasraj_student_name`).
- [`src/components/classroom/ClassroomWorkspace.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/ClassroomWorkspace.tsx):
  - The master classroom layout: dual/multi video grid on left, infinite whiteboard on center/right, top floating page navigation bar, bottom floating toolbar, right collapsible studio panel.
  - Supports multiple remote students with dynamic participant tiles and individual drawing permissions in People tab.
  - Light theme styling with airy warm zinc-50 backgrounds and subtle borders.
  - Handles dual-mode switching (`whiteboard` vs `video_focus`).
  - Implements `handleRestoreWhiteboard` for reloading past whiteboard sessions onto canvas and broadcasting across peers.
  - Auto-archives session to history on `handleEndClass`.
- [`src/components/classroom/ClassroomContainer.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/ClassroomContainer.tsx):
  - Responsive container wrapper managing aspect ratio and fullscreen toggles.
- [`src/components/classroom/ClassroomTimerWidget.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/ClassroomTimerWidget.tsx):
  - Synchronized classroom timer and stopwatch HUD with 1m, 3m, 5m presets, broadcast over whiteboard adapter.
- [`src/components/classroom/ClassroomVideoSync.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/ClassroomVideoSync.tsx):
  - Media stream synchronization component keeping video elements attached without flicker.
- [`src/components/classroom/ControlBar.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/ControlBar.tsx):
  - Redesigned classroom action bar supporting both vertical left dock (`orientation: 'vertical'`) and horizontal layout.
  - Features draggable repositioning handle (`GripVertical`), mic toggle, camera toggle, screen share, layout mode toggle, settings popover, and leave/end class buttons.
  - Eliminates overlap collisions with bottom whiteboard tools.
- [`src/components/classroom/EndClassSummaryModal.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/EndClassSummaryModal.tsx):
  - Summary modal shown at end of class displaying duration, pages drawn, and option to save/export notes.
- [`src/components/classroom/RewardCelebrationOverlay.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/RewardCelebrationOverlay.tsx):
  - Interactive confetti and reward celebration animation triggered by teacher for student accomplishments.
- [`src/components/classroom/VideoCard.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/classroom/VideoCard.tsx):
  - Individual video tile rendering participant video stream, audio indicator, connection quality HUD, and role badges. Light-themed with clean borders.

---

### Dashboard Components (`src/components/dashboard/`)
- [`src/components/dashboard/ActiveRoomsManager.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/dashboard/ActiveRoomsManager.tsx):
  - Live HUD listing active rooms, countdown remaining timers, 1-click student link copy, teacher launch button, and delete button.
- [`src/components/dashboard/PastClassesManager.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/dashboard/PastClassesManager.tsx):
  - Archive list showing past completed sessions, date, duration, page count, delete option, and **"Launch with Whiteboard"** button.

---

### Whiteboard Components (`src/components/whiteboard/`)
- [`src/components/whiteboard/WhiteboardStage.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/WhiteboardStage.tsx):
  - High-performance canvas mounting component that initializes `FabricWhiteboardEngine`, laser trail renderer, and gesture listeners.
- [`src/components/whiteboard/WhiteboardToolbar.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/WhiteboardToolbar.tsx):
  - Floating bottom toolbar: Select (V), Pen (P), Highlighter (H), Eraser (E), Shapes, Text (T), Laser Pointer (L), Math (M), Undo (Ctrl+Z), Redo (Ctrl+Y), Clear Page.
- [`src/components/whiteboard/PageNavigationBar.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/PageNavigationBar.tsx):
  - Top pill component displaying `< Page X of Y >`, Previous Page, Next Page, and Add Page (+) buttons in light glass styling.
- [`src/components/whiteboard/PdfSubPageNavigator.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/PdfSubPageNavigator.tsx):
  - Floating in-tab sub-page pagination bar docked at the bottom of the active whiteboard tab when a PDF slide deck is loaded.
  - Allows navigating through PDF slides (`< Page X of Y >`) with keyboard shortcuts (Left/Right arrow) while preserving per-slide ink annotations.
- [`src/components/whiteboard/ColorStrokePopover.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/ColorStrokePopover.tsx):
  - Popover palette for selecting pen colors (black, blue, red, green, purple, amber) and stroke widths.
- [`src/components/whiteboard/MathEquationModal.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/MathEquationModal.tsx):
  - LaTeX formula editor modal with live KaTeX preview and instant insertion as canvas image/SVG.
- [`src/components/whiteboard/StudioSidePanel.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/StudioSidePanel.tsx):
  - Collapsible right studio sidebar with tabs: People, Chat, Materials, Tools. Light glass styling.
- [`src/components/whiteboard/ZoomControls.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/ZoomControls.tsx):
  - Bottom-left floating zoom HUD: Zoom Out (-), Zoom Level %, Zoom In (+), Reset/Fit to Screen.
- [`src/components/whiteboard/BrowserTabBar.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/BrowserTabBar.tsx):
  - Multi-tab navigation header for multi-document workflows with warm light glass styling and amber active border.
- [`src/components/whiteboard/tabs/PeopleTab.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/tabs/PeopleTab.tsx):
  - Classroom Authority panel: Global Lock toggle, Laser-Only toggle, participant list with individual draw permission switches.
- [`src/components/whiteboard/tabs/ChatTab.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/tabs/ChatTab.tsx):
  - Real-time in-classroom text chat between teacher and students with teacher correction syntax.
- [`src/components/whiteboard/tabs/MaterialsTab.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/tabs/MaterialsTab.tsx):
  - Worksheet library, PDF upload dropzone (rasterizes uploaded PDFs to raw images), and **Past Whiteboards** restoration section with 1-click restore.
- [`src/components/whiteboard/tabs/ToolsTab.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/whiteboard/tabs/ToolsTab.tsx):
  - Extra teaching tools: Graph grid toggle, lined paper toggle, reward stars, export full notebook (including all PDF slides and ink) to PDF / PNG.

---

### Whiteboard Engine & Core Libraries (`src/lib/whiteboard/`)
- [`src/lib/whiteboard/fabric-engine.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/fabric-engine.ts):
  - Master Fabric.js wrapper (`FabricWhiteboardEngine`).
  - Manages tool modes (`select`, `pencil`, `highlighter`, `eraser`, `rectangle`, `circle`, `triangle`, `line`, `arrow`, `text`, `laser`).
  - Eraser mode: Dedicated eraser that identifies clicked or dragged-over objects, deletes them, and emits deletion events.
  - Handles rough/excalidraw hand-drawn styling for geometric shapes.
  - Coordinate transformations for high-DPI displays and zoom/pan matrices.
- [`src/lib/whiteboard/page-manager.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/page-manager.ts):
  - In-memory state machine for multi-page notebook (`WhiteboardPageManager`).
  - Maintains page order, page snapshots, active page pointer, page insertion, page deletion, and serialization.
- [`src/lib/whiteboard/pdf-renderer.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/pdf-renderer.ts):
  - `convertPdfToPageImages(pdfDataUrl)`: Ingests uploaded PDF binary / data URL using `pdfjs-dist`, renders each page into high-res raw images (2x scale for crisp retina display), and returns array of image data URLs.
  - `exportMultiPagePdf(pages)`: Composites all pages and sub-pages (raster background + Fabric JSON stroke drawings) into a unified downloadable multi-page PDF document.
- [`src/lib/whiteboard/undo-redo-stack.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/undo-redo-stack.ts):
  - Command-pattern undo/redo stack (`UndoRedoStack`) capturing JSON delta snapshots on canvas object additions, modifications, and deletions. Supports Ctrl+Z and Ctrl+Y shortcuts.
- [`src/lib/whiteboard/laser-trail.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/laser-trail.ts):
  - Ephemeral laser pointer trail system (`LaserTrailManager`) rendering decaying particle trails on top canvas without polluting persistent drawings.
- [`src/lib/whiteboard/permission-guard.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/permission-guard.ts):
  - Authority validator (`PermissionGuard`) verifying whether a given user action (draw, erase, flip page, clear) is permitted under current role and permissions (`global_locked`, `laser_pointer_only`, `allowed_users`).
- [`src/lib/whiteboard/touch-gesture-handler.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/touch-gesture-handler.ts):
  - Touch event normalizer for iPad, tablet, and mobile screens. Distinguishes 1-finger drawing from 2-finger pinch-to-zoom and pan gestures.
- [`src/lib/whiteboard/viewport-transform.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/viewport-transform.ts):
  - Viewport matrix calculations (`ViewportTransformManager`) for pan, zoom (25% to 400%), center-fit, and teacher-follow synchronizations.
- [`src/lib/whiteboard/whiteboard-signaling.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/whiteboard-signaling.ts):
  - Real-time broadcast adapter (`WhiteboardRealtimeAdapter`) connecting to Supabase Realtime Channel.
  - Broadcasts delta events: `object-added`, `object-modified`, `object-removed`, `page-change`, `page-added`, `clear`, `cursor-move`, `laser-point`, `restore-whiteboard-session`.
- [`src/lib/whiteboard/whiteboard-persistence.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/whiteboard/whiteboard-persistence.ts):
  - Debounced persistence manager (`DebouncedPersistenceManager`) queueing canvas state saves (default 3s delay) to Supabase Postgres `whiteboard_sessions` table.

---

### WebRTC, LiveKit & Signaling (`src/lib/webrtc/` and `src/lib/signaling/`)
- [`src/lib/webrtc/livekit-session.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/webrtc/livekit-session.ts):
  - `LiveKitMediaSession` implementing `IMediaSession` using `livekit-client`.
  - Connects to LiveKit Cloud SFU (`LIVEKIT_URL`), acquires JWT token from `/api/livekit/token`, manages mic/camera/screen-share publishing, remote track subscription, and network quality score translation.
- [`src/lib/webrtc/p2p-session.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/webrtc/p2p-session.ts):
  - `P2PWebRTCMediaSession` implementing WebRTC connection lifecycle with `polite` peer negotiation.
  - Fallback media provider handling direct SDP offer/answer exchange, ICE candidates, local/remote stream attachment, track renegotiation, and connection recovery.
- [`src/lib/webrtc/stats-parser.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/webrtc/stats-parser.ts):
  - Queries `peerConnection.getStats()` to extract real-time RTT (latency), packet loss %, jitter, and calculates overall connection quality (`good`, `fair`, `poor`).
- [`src/lib/signaling/supabase-signaling.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/signaling/supabase-signaling.ts):
  - Supabase Realtime Channel adapter routing WebRTC signaling messages (`offer`, `answer`, `ice-candidate`, `peer-joined`, `peer-left`).
- [`src/lib/webrtc/stats-parser.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/webrtc/stats-parser.ts):
  - Queries `peerConnection.getStats()` to extract real-time RTT (latency), packet loss %, jitter, and calculates overall connection quality (`good`, `fair`, `poor`).
- [`src/lib/signaling/supabase-signaling.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/signaling/supabase-signaling.ts):
  - Supabase Realtime Channel adapter routing WebRTC signaling messages (`offer`, `answer`, `ice-candidate`, `peer-joined`, `peer-left`).

---

### Supabase Infrastructure (`src/lib/supabase/`)
- [`src/lib/supabase/client.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/supabase/client.ts): Browser Supabase client singleton with environment fallbacks.
- [`src/lib/supabase/server.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/lib/supabase/server.ts): Server-side Supabase client for Next.js App Router server actions and route handlers.

---

### UI Components (`src/components/ui/`)
- [`src/components/ui/GlassButton.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/ui/GlassButton.tsx): Reusable button following Emil Kowalski aesthetic: subtle borders, tactile hover/active states, accessible focus rings.
- [`src/components/ui/GlassCard.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/ui/GlassCard.tsx): Translucent surface card with warm stone border and background.
- [`src/components/ui/NetworkQualityHUD.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/ui/NetworkQualityHUD.tsx): Network status indicator showing green/amber/red quality bars with RTT tooltip.
- [`src/components/Logo.tsx`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/components/Logo.tsx): Brand logo vector component.

---

### Timezone & Booking Utilities (`src/utils/`)
- [`src/utils/timezone.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/utils/timezone.ts):
  - Dual-timezone slot conversion supporting Teacher timezone (default `Asia/Kolkata` IST) and student local timezone.
  - Formats slot intervals and parses booking availability.

---

### Type Definitions (`src/types/`)
- [`src/types/whiteboard.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/types/whiteboard.ts): Data contracts for `WhiteboardPage`, `PdfDocumentState`, `PdfPageImage`, `WhiteboardPermissions`, `WhiteboardSessionData`, `ToolMode`, and real-time broadcast payloads.
- [`src/types/media.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/types/media.ts): Contracts for `IMediaSession`, `ISignalingAdapter`, `ConnectionQuality`, and WebRTC statistics.
- [`src/types/database.ts`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/src/types/database.ts): Database row contracts for `whiteboard_sessions`, `lessons`, and `teacher_availability`.

---

## 4. Key Architectural Patterns & Invariants

### A. LiveKit Cloud SFU Video Architecture
- Primary video conferencing is powered by **LiveKit Cloud SFU** (`livekit-client` + `livekit-server-sdk`).
- Token route at `/api/livekit/token` creates cryptographically signed access tokens keyed to room ID and user identity (`teacher` vs `student`).
- `LiveKitMediaSession` adheres to `IMediaSession` interface: automatically connects to `LIVEKIT_URL`, handles simulcast track subscriptions, mic/camera/screen-share publishing, and emits connection quality.
- If LiveKit credentials are absent or connection fails, the classroom seamlessly falls back to `P2PWebRTCMediaSession`.

### B. Perfect WebRTC Negotiation (`polite` peer fallback)
To prevent glare when both peers create offers simultaneously or renegotiate in P2P mode:
- **Teacher** is the **impolite peer** (`polite: false`).
- **Student** is the **polite peer** (`polite: true`).
- In `ClassroomView.tsx`, this is dynamically set as: `polite = activeRole !== 'teacher'`.

### C. Student-Default Security Invariant
- **Rule**: Direct access to `/classroom/[roomId]` MUST NEVER grant teacher controls.
- Any incoming link is treated as `student` unless verified against `getTeacherSession()` in `localStorage`/cookies or explicitly authenticated via passcode `injasraj123`.

### D. 15-Minute Instant Room Expiry
- When an instant room is created, it is marked `status: 'active'`.
- The moment a participant joins, `recordRoomJoin(roomId)` stamps `joinedAt`.
- Exactly 15 minutes after `joinedAt`, the room expires:
  - It disappears from the dashboard's active links list.
  - Its full whiteboard is automatically archived into `injasraj_past_classes`.
  - Anyone still inside or visiting the link receives the **Classroom Session Expired** screen.

### E. In-Tab Navigable PDF Slides & Export Composite
- When a user uploads a PDF, `convertPdfToPageImages()` rasterizes every page into high-resolution raw images.
- Rather than bloating the workspace by spawning separate whiteboard tabs for every single PDF page, the PDF stays within **one whiteboard tab**.
- An in-tab bottom pagination pill (`PdfSubPageNavigator`) lets users flip between slides (`< Page X of Y >`).
- User drawings and annotations on each slide are cached in `pdfDocument.pageStrokes[pageNumber]`. Flipping slides swaps background image and restores associated ink.
- When exporting all whiteboards to multi-page PDF (`exportMultiPagePdf`), each slide is composited with its drawings in sequential order.

### F. Vertical Left Dock & Emil Kowalski Light Aesthetics
- To solve toolbar collision where bottom-docked camera/mic menus overlapped the whiteboard tools and PDF navigator, `ControlBar` is docked vertically on the left edge (`orientation: 'vertical'`).
- Includes a vertical drag handle (`GripVertical`) for tactile user adjustment and rightward-facing popovers.
- The interface employs Emil Kowalski design engineering principles: warm, airy light palette (`zinc-50` / `stone-50`), crisp 1px borders, subtle drop shadows, and zero neon glare.
