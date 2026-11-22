# GSD Context: Injasraj Classroom & Whiteboard Perfection Suite

## 1. Problem Statement & User Intent
The user identified critical UX flaws in the classroom platform:
1. **Whiteboard & Canvas Experience**:
   - PDF ingestion was falling back to mock SVG because `pdfjs-dist` worker was not properly configured in the browser, and output should be seamless high-efficiency WebP images instead of heavy PNGs.
   - Zooming was just scaling a fixed 16:9 box in the center with black bars, rather than functioning like an infinite canvas (Excalidraw-like) where zooming out gives more room to draw anywhere.
   - Whiteboard creation/tabs had state bleeding: creating a new page didn't save the previous page or clear the engine, resulting in corrupted whiteboard states across multiple pages.
   - Touchpad zoom out did not work (no wheel listener with ctrlKey/pinch detection).
   - Shift button and middle-mouse button panning did not work.
   - Grab/hand tool (`activeTool === 'pan'`) was not functional for panning the canvas.
2. **Studio Panel Contrast & AI Slash Commands**:
   - Major contrast flaw: white text and low-opacity borders on white/translucent backgrounds (white-on-white text).
   - Clutter: "Sample" mock worksheets need to be removed.
   - Slash command `/ask AI` requested in the Chat panel to query the AI assistant.
3. **Video Controls & Mic/Cam Overlays**:
   - Mute/unmute controls must be placed directly under/on the video cards.
   - Teachers need the ability to control student mic and camera directly from their video card.
4. **Star Reward System**:
   - Teachers can target a specific student to award stars.
   - The celebratory reward animation is visible ONLY to the recipient student.
   - The total star count is displayed on the top right of the student's video card for all participants in the meeting.
5. **Classroom Navigation, Identity, Invite Link & Participant Count**:
   - Quick "Home" button in the header to return to the homepage.
   - Editable teacher display name in the header.
   - "Copy Invite Link" button in the header for easy student sharing.
   - Accurate participant count (always at least 1 for the local user, plus remote peers, never 0).

## 2. Architecture & Design Decisions
- **PDF Ingestion**: Configure `pdfjs-dist` worker dynamically, convert rendered canvas pages to WebP format (`image/webp`, quality 0.92) with PNG fallback.
- **Infinite Canvas & Viewport Pan/Zoom**:
  - Full-viewport canvas sizing.
  - Native trackpad pinch-to-zoom & two-finger scroll panning via non-passive `wheel` event handler.
  - Interactive Grab / Pan tool (`pan`), Spacebar/Shift-drag, and middle-mouse drag panning.
  - Transform matrix / pan offset support in `viewport-transform.ts` and `fabric-engine.ts`.
- **Page Isolation & Multi-Whiteboard Management**:
  - `handleAddPage` automatically serializes and commits the current active page canvas, resets the engine, and creates a clean new canvas.
  - `handleSelectPage` cleanly commits current state, switches active page, and hydrates only that page's state.
- **Studio Panel Contrast**:
  - Re-theme `StudioSidePanel.tsx` and all tabs to warm stone `#1c1917` with `#292524` borders and `#f5f5f4` text, completely eliminating white-on-white text.
  - Remove hardcoded "Sample" mock worksheets.
  - Add `/ask AI` command handling in `ChatTab.tsx` with instant AI response generation.
- **Video Controls & Student Management**:
  - Add floating control overlay directly on/below each `VideoCard.tsx`.
  - For students, show local mic/cam toggles. For teachers, show remote control buttons (mute student mic, disable student camera) and star award trigger.
- **Targeted Star Rewards**:
  - Payload includes `targetStudentId`.
  - Only `userId === targetStudentId` renders the celebratory overlay.
  - `starCountsByStudent` dictionary broadcasts star totals to all video cards.
- **Header Controls**:
  - Add Home navigation icon button, editable teacher name popover/inline input, and one-click "Copy Link" button.
