# Advanced Classroom, Excalidraw Suite & Brand UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Injasraj Virtual Teaching Studio into a best-in-class hybrid of LearnCube and Excalidraw, completely re-styled to match the brand identity of the logo (warm stone, terracotta, amber ochre, clean matte tactile surfaces — zero neon glows) while eliminating WebRTC video lag and delivering complete classroom session lifecycle controls.

**Key Deliverables:**
1. **Brand-Aligned Emil Kowalski UI Polish:** Eliminate all neon purple/indigo glows and fluorescent gradients; re-theme to logo palette (warm stone `#1c1917`, ochre `#b4823c`, terracotta `#85451f`, parchment `#f5f3e6`) with crisp 1px borders, subtle inset specular highlights, and `:active { scale: 0.97 }` press feedback.
2. **WebRTC Low-Latency Optimization:** Eliminate video calling lag via 720p@30fps resolution caps, 800 kbps `RTCRtpSender` bitrate ceilings, low-latency audio constraints, and fast ICE pooling.
3. **Classroom Session Lifecycle:** "Start Class" & "End Class" state machine with pre-class waiting room, synced lesson timer, read-only freeze on finish, automated lesson PDF summary, and Emil-styled rating card.
4. **All LearnCube Capabilities:** Browser-style tabs, synced countdown timer/stopwatch, celebratory confetti rewards, follow-teacher viewport lock, 1-click multi-page lesson PDF exporter, synchronized video player tab, and chat teacher correction syntax (`~wrong~ -> *correct*`).
5. **All Excalidraw Capabilities:** Hand-drawn sketch roughness (`roughjs` + algorithmic jitter), marquee drag multi-selection, element locking (`Ctrl+Shift+L`), layer z-ordering, smart connector arrow snapping, KaTeX LaTeX vector formulas, and auto-centered shape text.

**Tech Stack:** React 19, Next.js 15.5.29, Tailwind CSS, Lucide Icons, Canvas2D, `roughjs`, KaTeX, jsPDF, Canvas-Confetti, Web Audio API, WebRTC, Vitest, Testing Library.

**Logo Color Palette Reference:**
- **Canvas / Dark Surface:** Deep warm stone (`#121110` / `#1c1917` / `stone-900`)
- **Panels & Toolbars:** Matte stone glass (`#1f1d1a` / `stone-800/90`) with crisp `border-stone-800`
- **Brand Accents:** Warm amber ochre (`#b4823c` / `amber-600`) & terracotta (`#85451f`)
- **Parchment / Ivory Highlight:** Soft warm cream (`#f5f3e6` / `#ede8dc`)
- **Zero AI-Neon Glow:** No `shadow-purple-500/50`, no `from-indigo-500 via-purple-500`, no cyan blur.

**Apple Design & Emil Kowalski Design Foundations:**
1. **Response — Kill Latency:** Respond on `pointer-down` (not release); buttons compress instantly (`:active { transform: scale(0.97); }`) with 0 tap delay.
2. **Behavior over Animation — Critically Damped Springs:** Use critically damped springs (`damping 1.0`, `response 0.35s`, no gratuitous bounce) for menus, popovers, and tabs; slight bounce (`damping 0.8`) only on momentum flicks.
3. **Interruptibility & Direct Manipulation:** Never lock out inputs during animations; drags use Pointer Events with `setPointerCapture` and preserve grab offsets.
4. **Materials & Depth:** Floating translucent chrome with `backdrop-filter: blur(20px) saturate(180%)` and top-edge specular highlight (`shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]`).
5. **Spatial Consistency:** Popovers scale from their trigger anchor points; elements enter and exit along symmetric paths.
6. **Typography Discipline:** Negative tracking for headings (`-0.02em`), clear hierarchy, platform system fonts.
7. **Accessibility Hygiene:** Full `@media (prefers-reduced-motion)` cross-fades and `@media (prefers-reduced-transparency)` opacity fallback.

---

### Task 1: Browser-Style Whiteboard Tab Bar (`BrowserTabBar`)

**Files:**
- Create: `src/components/whiteboard/BrowserTabBar.tsx`
- Modify: `src/components/whiteboard/WhiteboardStage.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Test: `tests/components/BrowserTabBar.test.tsx`

**Interfaces:**
- `BrowserTabBarProps.pages: WhiteboardPage[]`
- `BrowserTabBarProps.activePageId: string`
- `BrowserTabBarProps.onSelectTab: (pageId: string) => void`
- `BrowserTabBarProps.onAddTab: () => void`
- `BrowserTabBarProps.onCloseTab?: (pageId: string) => void`
- `BrowserTabBarProps.onRenameTab?: (pageId: string, newTitle: string) => void`
- `BrowserTabBarProps.isTeacher?: boolean`

- [ ] **Step 1: Write failing test for `BrowserTabBar`**
```tsx
it('renders browser-style tabs with active indicator, close button, title inline editing, and add tab trigger', () => {
  // Renders tabs matching pages
  // Active tab has distinctive matte stone background and 1px brand border
  // Clicking + calls onAddTab
  // Double clicking tab enables inline input and calls onRenameTab on Enter
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/components/BrowserTabBar.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `BrowserTabBar.tsx`**
Create modern browser tab strip styled like Arc/Chrome:
- Tab items with page icon, truncate text, `×` close button (visible on hover/active, hidden if only 1 tab).
- Double-click to rename with auto-focus `<input>` and blur/Enter commit.
- `+` button at end of strip with spring micro-interaction (`:active { transform: scale(0.97); }`).
- Mount directly above the canvas stage in `WhiteboardStage.tsx` / `ClassroomWorkspace.tsx`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/components/BrowserTabBar.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/whiteboard/BrowserTabBar.tsx src/components/whiteboard/WhiteboardStage.tsx src/components/classroom/ClassroomWorkspace.tsx tests/components/BrowserTabBar.test.tsx
git commit -m "feat(whiteboard): add browser-style whiteboard tab bar with inline renaming"
```

---

### Task 2: Synchronized Classroom Timer & Stopwatch HUD (`ClassroomTimerWidget`)

**Files:**
- Create: `src/components/classroom/ClassroomTimerWidget.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/types/media.ts`
- Test: `tests/components/ClassroomTimerWidget.test.tsx`

**Interfaces:**
- `ClassroomTimerWidgetProps.isOpen: boolean`
- `ClassroomTimerWidgetProps.onClose: () => void`
- `ClassroomTimerWidgetProps.isTeacher: boolean`
- `ClassroomTimerWidgetProps.onBroadcastTimerState?: (state: TimerState) => void`
- `ClassroomTimerWidgetProps.remoteTimerState?: TimerState`

- [ ] **Step 1: Write failing test for `ClassroomTimerWidget`**
```tsx
it('supports countdown presets (1m, 3m, 5m), custom duration, start/pause/reset, and triggers onFinish callback', () => {
  // Starts 60s timer -> ticks down -> emits timer state
  // Reaches 0 -> triggers alarm/pulse state
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/components/ClassroomTimerWidget.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `ClassroomTimerWidget.tsx`**
- Floating draggable matte stone HUD (`bg-stone-900/90 border border-stone-800 text-stone-100 shadow-xl`).
- Presets: 1m, 2m, 3m, 5m, 10m, and free Stopwatch mode.
- Teacher controls Start, Pause, Reset; student sees synchronized real-time countdown.
- Web Audio API soft chime sound on completion with toggleable mute.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/components/ClassroomTimerWidget.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/classroom/ClassroomTimerWidget.tsx src/components/classroom/ClassroomWorkspace.tsx tests/components/ClassroomTimerWidget.test.tsx
git commit -m "feat(classroom): add synchronized classroom timer and stopwatch HUD"
```

---

### Task 3: Student Reward & Confetti Celebration Overlay (`RewardCelebrationOverlay`)

**Files:**
- Create: `src/components/classroom/RewardCelebrationOverlay.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/components/whiteboard/WhiteboardToolbar.tsx`
- Test: `tests/components/RewardCelebrationOverlay.test.tsx`

**Interfaces:**
- `RewardType: 'star' | 'trophy' | 'fire' | 'heart'`
- `RewardEvent: { id: string; type: RewardType; teacherName: string; timestamp: number }`
- `RewardCelebrationOverlayProps.activeReward: RewardEvent | null`
- `RewardCelebrationOverlayProps.onDismiss: () => void`

- [ ] **Step 1: Write failing test for `RewardCelebrationOverlay`**
```tsx
it('renders celebratory modal and particles when teacher triggers reward event', () => {
  // Triggers star reward -> displays animated gold star badge and fires celebratory callback
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/components/RewardCelebrationOverlay.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `RewardCelebrationOverlay.tsx` and Toolbar Trigger**
- Add teacher reward trigger button in `WhiteboardToolbar.tsx` (Star, Trophy, 100, Sparkles).
- Broadcast reward event over WebRTC / Supabase signaling.
- Render warm gold/ochre confetti particles + scale-up bouncing badge with 3-second auto-decay and Web Audio chime.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/components/RewardCelebrationOverlay.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/classroom/RewardCelebrationOverlay.tsx src/components/whiteboard/WhiteboardToolbar.tsx src/components/classroom/ClassroomWorkspace.tsx tests/components/RewardCelebrationOverlay.test.tsx
git commit -m "feat(classroom): add teacher-triggered student rewards with confetti celebration"
```

---

### Task 4: Follow-Teacher Viewport Synchronization

**Files:**
- Modify: `src/components/whiteboard/WhiteboardStage.tsx`
- Modify: `src/components/whiteboard/ZoomControls.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Test: `tests/whiteboard/viewport-sync.test.tsx`

**Interfaces:**
- `ViewportState: { zoom: number; panX: number; panY: number; teacherActive: boolean }`
- `WhiteboardStageProps.isFollowTeacherEnabled?: boolean`
- `WhiteboardStageProps.onToggleFollowTeacher?: (enabled: boolean) => void`
- `WhiteboardStageProps.remoteViewport?: ViewportState`

- [ ] **Step 1: Write failing test for viewport synchronization**
```tsx
it('mirrors teacher zoom and viewport pan coordinates when student enables follow-teacher mode', () => {
  // Teacher zooms to 1.5x -> student in follow mode matches 1.5x zoom
  // Student toggles off follow mode -> student can independently zoom without changing teacher view
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/whiteboard/viewport-sync.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Viewport Broadcasting & Follow Mode**
- In `ZoomControls.tsx`, add "Follow Teacher" toggle pill button with eye icon.
- In `ClassroomWorkspace.tsx`, broadcast teacher zoom changes via `whiteboardAdapter`.
- When student has follow mode active, smoothly interpolate student canvas transform to match teacher.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/whiteboard/viewport-sync.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/whiteboard/WhiteboardStage.tsx src/components/whiteboard/ZoomControls.tsx src/components/classroom/ClassroomWorkspace.tsx tests/whiteboard/viewport-sync.test.tsx
git commit -m "feat(whiteboard): add follow-teacher viewport synchronization"
```

---

### Task 5: 1-Click Multi-Page Lesson PDF Export

**Files:**
- Modify: `src/lib/whiteboard/pdf-renderer.ts`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/components/whiteboard/tabs/ToolsTab.tsx`
- Test: `tests/whiteboard/multi-page-export.test.ts`

- [ ] **Step 1: Write failing test for multi-page PDF generation**
```ts
it('renders all whiteboard pages with background worksheets and vector annotations into a single multi-page PDF', async () => {
  // Compiles 3 pages -> returns valid PDF blob with 3 pages
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/whiteboard/multi-page-export.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement multi-page PDF rendering in `pdf-renderer.ts`**
- Create temporary offscreen 1920×1080 canvas.
- Iterate over `pages`: draw background image/PDF page, draw vector objects in Z-order, write canvas frame to PDF page.
- Trigger browser download: `lesson-${roomId}-full-summary.pdf`.
- Wire button in `ToolsTab.tsx` (`export-pdf-btn`).

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/whiteboard/multi-page-export.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/lib/whiteboard/pdf-renderer.ts src/components/classroom/ClassroomWorkspace.tsx src/components/whiteboard/tabs/ToolsTab.tsx tests/whiteboard/multi-page-export.test.ts
git commit -m "feat(whiteboard): implement 1-click multi-page lesson PDF exporter"
```

---

### Task 6: KaTeX Vector Math Formula Tool (`MathEquationModal`)

**Files:**
- Create: `src/components/whiteboard/MathEquationModal.tsx`
- Modify: `src/components/whiteboard/WhiteboardToolbar.tsx`
- Modify: `src/lib/whiteboard/fabric-engine.ts`
- Test: `tests/components/MathEquationModal.test.tsx`

- [ ] **Step 1: Write failing test for math formula insertion**
```tsx
it('renders LaTeX equation preview in real-time with math symbols keyboard and inserts formula onto canvas', () => {
  // Types '\frac{1}{2}' -> live KaTeX preview updates
  // Clicks insert -> calls onInsertEquation with rendered image/svg
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/components/MathEquationModal.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `MathEquationModal.tsx` and Toolbar Integration**
- Add Equation / Radical icon ($\Sigma / \sqrt{x}$) to `WhiteboardToolbar.tsx`.
- Modal features quick symbol buttons (fractions, square root, powers, integrals, Greek letters).
- Render KaTeX to SVG/canvas data URL and create canvas object of type `'formula'`.
- In `fabric-engine.ts`, render formula object crisp at any canvas zoom level.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/components/MathEquationModal.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/whiteboard/MathEquationModal.tsx src/components/whiteboard/WhiteboardToolbar.tsx src/lib/whiteboard/fabric-engine.ts tests/components/MathEquationModal.test.tsx
git commit -m "feat(whiteboard): add LaTeX math formula editor and vector canvas rendering"
```

---

### Task 7: Excalidraw Smart Arrowhead Binding & Shape Text Centering

**Files:**
- Modify: `src/lib/whiteboard/fabric-engine.ts`
- Modify: `src/types/whiteboard.ts`
- Test: `tests/whiteboard/arrow-binding.test.ts`

- [ ] **Step 1: Write failing test for arrow binding and shape text**
```ts
it('binds arrow endpoints to geometric shapes and updates arrow coordinates when shape moves', () => {
  // Creates rect and arrow -> binds arrow.end to rect
  // Moves rect -> arrow end coordinates update automatically
  // Double-clicks rect -> allows setting centered text inside shape
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/whiteboard/arrow-binding.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement binding calculation and shape text in `fabric-engine.ts`**
- During arrow creation or dragging near a shape boundary, compute closest side anchor point (`top`, `bottom`, `left`, `right`).
- Store binding targets on arrow object graph.
- On `modifyObject` or shape drag, query connected arrows and recalculate endpoint vectors.
- Render auto-wrapped, vertically centered text inside shapes in `drawObject()`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/whiteboard/arrow-binding.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/lib/whiteboard/fabric-engine.ts src/types/whiteboard.ts tests/whiteboard/arrow-binding.test.ts
git commit -m "feat(whiteboard): add smart arrow binding to shapes and centered shape text"
```

---

### Task 8: WebRTC Video Calling Lag Elimination & Audio Optimization

**Files:**
- Modify: `src/lib/webrtc/p2p-session.ts`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Test: `tests/webrtc/video-optimization.test.ts`

- [ ] **Step 1: Write failing test for WebRTC sender bitrate and constraints**
```ts
it('applies low-latency constraints and caps RTCRtpSender video encoding parameters', async () => {
  // Captures stream with ideal 720p@30fps bounds
  // Sets sender encodings maxBitrate: 800_000 and maxFramerate: 30
  // Configures audio with echoCancellation: true, noiseSuppression: true, latency: 0
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/webrtc/video-optimization.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement WebRTC performance tuning in `p2p-session.ts`**
- Define `VIDEO_CONSTRAINTS = { width: { ideal: 1280, max: 1280 }, height: { ideal: 720, max: 720 }, frameRate: { ideal: 30, max: 30 } }`.
- Define `AUDIO_CONSTRAINTS = { echoCancellation: true, noiseSuppression: true, autoGainControl: true, sampleRate: 48000, channelCount: 1, latency: 0 }`.
- In `createOffer` / `setRemoteDescription`, apply `sender.setParameters()` with `encodings: [{ maxBitrate: 800000, maxFramerate: 30, priority: 'high' }]` on the video track.
- Enable fast ICE candidate pool (`iceCandidatePoolSize: 2`).

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/webrtc/video-optimization.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/lib/webrtc/p2p-session.ts src/components/classroom/ClassroomWorkspace.tsx tests/webrtc/video-optimization.test.ts
git commit -m "perf(webrtc): eliminate video calling lag with 720p bitrate capping and speech tuning"
```

---

### Task 9: Start Class & End Class Session Lifecycle with Post-Class Summary

**Files:**
- Create: `src/components/classroom/EndClassSummaryModal.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/types/media.ts`
- Test: `tests/components/ClassSessionLifecycle.test.tsx`

**Interfaces:**
- `ClassSessionStatus: 'waiting' | 'in_progress' | 'completed'`
- `EndClassSummaryModalProps.isOpen: boolean`
- `EndClassSummaryModalProps.durationSeconds: number`
- `EndClassSummaryModalProps.pagesCount: number`
- `EndClassSummaryModalProps.starsAwarded: number`
- `EndClassSummaryModalProps.onDownloadPdf: () => void`
- `EndClassSummaryModalProps.onClose: () => void`

- [ ] **Step 1: Write failing test for session lifecycle**
```tsx
it('supports Start Class transition, active session timer, and End Class modal with PDF summary download', () => {
  // Tutor sees "Start Class" button when waiting
  // Clicking Start Class transitions status to "in_progress" and starts timer
  // Clicking End Class opens confirmation modal, generates summary, and freezes whiteboard
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/components/ClassSessionLifecycle.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement Session Lifecycle in `ClassroomWorkspace.tsx` and `EndClassSummaryModal.tsx`**
- In Header: Show "Start Class" pill button (warm amber accent).
- When started: Header switches to "End Class" (danger/stone button) and live lesson duration pill.
- When student joins before start: Display friendly waiting screen ("Tutor is preparing your lesson...").
- When End Class confirmed: Broadcast `class-ended` event, trigger PDF summary generation, and display Emil-styled post-lesson achievement modal.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/components/ClassSessionLifecycle.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/classroom/EndClassSummaryModal.tsx src/components/classroom/ClassroomWorkspace.tsx src/types/media.ts tests/components/ClassSessionLifecycle.test.tsx
git commit -m "feat(classroom): add Start Class and End Class session lifecycle with summary report"
```

---

### Task 10: Complete Excalidraw Suite (Hand-Drawn Roughness, Marquee Multi-Select, Lock & Z-Order)

**Files:**
- Modify: `src/lib/whiteboard/fabric-engine.ts`
- Modify: `src/components/whiteboard/WhiteboardToolbar.tsx`
- Modify: `src/types/whiteboard.ts`
- Test: `tests/whiteboard/excalidraw-complete.test.ts`

- [ ] **Step 1: Write failing test for sketch roughness, marquee select, lock & z-order**
```ts
it('supports hand-drawn roughness rendering, multi-object marquee selection, object locking, and layer reordering', () => {
  // Draws rectangle with roughness=1 -> renders jittered sketchy paths
  // Marquee drags over two objects -> both are selected in active selection
  // Locks object -> cannot be moved or deleted until unlocked
  // Reorders object -> changes z-index position in objects array
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/whiteboard/excalidraw-complete.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement Roughness, Marquee, Lock & Z-Order in `fabric-engine.ts`**
- Add sketch style toggle in toolbar (`Architect` vs `Hand-Drawn`).
- Integrate `roughjs` rendering pipeline for rectangles, ellipses, and lines when sketch mode is active, with fallback algorithmic jitter.
- Implement canvas drag marquee selection rectangle (`selection: true` with dashed border) to select multiple objects simultaneously.
- Implement object locking (`locked: boolean`) with `Ctrl+Shift+L` shortcut and toolbar lock icon.
- Implement Z-index ordering (`bringForward`, `sendBackward`, `bringToFront`, `sendToBack`) with keyboard shortcuts (`Ctrl+]`, `Ctrl+[`).

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/whiteboard/excalidraw-complete.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/lib/whiteboard/fabric-engine.ts src/components/whiteboard/WhiteboardToolbar.tsx src/types/whiteboard.ts tests/whiteboard/excalidraw-complete.test.ts
git commit -m "feat(whiteboard): add hand-drawn sketch roughness, marquee selection, locking, and z-ordering"
```

---

### Task 11: LearnCube Synchronized Media Player & Chat Teacher Correction

**Files:**
- Create: `src/components/classroom/ClassroomVideoSync.tsx`
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/components/classroom/tabs/ChatTab.tsx`
- Test: `tests/components/LearnCubeExtraFeatures.test.tsx`

- [ ] **Step 1: Write failing test for synchronized video playback and chat correction**
```tsx
it('synchronizes video player state across tutor and student, and formats teacher chat corrections with strikethrough', () => {
  // Tutor pastes YouTube/video URL -> student sees synchronized player
  // Chat message containing '~wrong~ -> *right*' formats error correction badge
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/components/LearnCubeExtraFeatures.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `ClassroomVideoSync.tsx` and Chat Corrections**
- Add "Media" tab in `BrowserTabBar.tsx` or workspace dock to watch teaching videos together.
- Synchronize play/pause/seek events across WebRTC signaling.
- In `ChatTab.tsx`, support teacher correction formatting: text like `~he go~ -> *he went*` renders with red strikethrough and green pill badge.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/components/LearnCubeExtraFeatures.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/classroom/ClassroomVideoSync.tsx src/components/classroom/tabs/ChatTab.tsx src/components/classroom/ClassroomWorkspace.tsx tests/components/LearnCubeExtraFeatures.test.tsx
git commit -m "feat(classroom): add synchronized lesson video player and teacher chat error corrections"
```

---

### Task 12: Emil Kowalski UI Polish & Logo Brand Color Scheme Redesign

**Files:**
- Modify: `src/components/classroom/ClassroomWorkspace.tsx`
- Modify: `src/components/whiteboard/WhiteboardToolbar.tsx`
- Modify: `src/components/whiteboard/ColorStrokePopover.tsx`
- Modify: `src/components/whiteboard/ZoomControls.tsx`
- Modify: `src/components/classroom/MediaDock.tsx`
- Modify: `src/app/globals.css`
- Test: `tests/classroom/brand-theme-audit.test.tsx`

- [ ] **Step 1: Write test for brand theme color classes and zero-glow compliance**
```tsx
it('contains zero neon purple/indigo glows and adheres to warm stone, amber ochre, and matte tactile borders', () => {
  // Inspects rendered toolbar and workspace
  // Confirms absence of shadow-purple-500, shadow-indigo-500, from-indigo-500
  // Confirms presence of stone-800 borders, amber-600 accents, and 0.97 active press states
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `npx vitest run tests/classroom/brand-theme-audit.test.tsx`
Expected: FAIL

- [ ] **Step 3: Refactor UI styles to Logo Brand Identity & Emil Standards**
- Strip out all `shadow-purple-500/50`, `from-indigo-500/20 via-purple-500/20`, neon gradient text, and blurred glow halos.
- Set base canvas / workspace theme to warm stone `#121110` / `stone-950`.
- Style toolbars, popovers, and docks with matte tactile finish: `bg-stone-900/95 border border-stone-800 text-stone-200 shadow-xl` with inset specular highlight `shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]`.
- Apply brand accent: Warm amber ochre (`#b4823c` / `amber-600`) for active tools, primary actions ("Start Class", "Export PDF"), and indicator badges.
- Ensure all interactive buttons have `active:scale-[0.97] transition-transform duration-150 ease-out`.

- [ ] **Step 4: Run test to verify it passes**
Run: `npx vitest run tests/classroom/brand-theme-audit.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add src/components/classroom/ClassroomWorkspace.tsx src/components/whiteboard/WhiteboardToolbar.tsx src/components/whiteboard/ColorStrokePopover.tsx src/components/whiteboard/ZoomControls.tsx src/components/classroom/MediaDock.tsx src/app/globals.css tests/classroom/brand-theme-audit.test.tsx
git commit -m "style(classroom): eliminate neon glows and apply logo brand palette with Emil tactile polish"
```

---

### Task 13: Full Suite Verification & Remote Push

- [ ] **Step 1: Run complete repository test suite**
Run: `npm test`
Expected: ALL test suites pass (50+ test files, 700+ tests).

- [ ] **Step 2: Run Next.js production build**
Run: `npm run build`
Expected: 0 errors, 0 warnings.

- [ ] **Step 3: Push to `origin/main`**
```bash
git push origin main
```
