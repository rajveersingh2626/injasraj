## Description

Resolves 3 critical production issues discovered during live user testing:

1. **Video Off -> On Permanent Black Screen**:
   - Added local stream republish event listener (`onLocalStream`) in `LiveKitMediaSession` and `ClassroomView` to capture new media tracks created when camera is re-enabled.
   - Added `safePlay()` and track `onunmute` event listeners to `VideoCard.tsx` so unmuted tracks immediately resume rendering without requiring full page reload.

2. **Tablet Asymmetric Video Visibility & Pre-Class One-Way Gate**:
   - Implemented tablet/mobile autoplay unlock fallback in `VideoCard.tsx` (setting `muted = true` on `<video>` when needed to unlock visual rendering without violating mobile Safari autoplay policy; audio continues on dedicated `<audio>` pipeline).
   - Added `h264` backup codec fallback to LiveKit publish defaults for hardware decode acceleration on iPadOS.
   - Enforced strict pre-class visibility gate: before teacher starts class, student receives `remote-video-waiting-placeholder` and remote audio is silenced, while teacher previews student video tile. Once started, `sessionStatus` transitions to `in_progress` and persists.

3. **Whiteboard State & Annotations Wiped on Reload**:
   - Fixed reload bypass in `ClassroomView.tsx` (`targetRoomId = restoreRoomId || roomId`) so existing whiteboard sessions in `whiteboard_sessions` are automatically loaded on refresh.
   - Added `session_status` column to `public.whiteboard_sessions` and updated serializer, deserializer, save, and load routines.
   - Added `beforeunload` and `pagehide` listeners in `ClassroomWorkspace.tsx` to flush in-flight debounced drawings before page refresh.

## Verification
- Added comprehensive test suite: `tests/classroom/webrtc-visibility-persistence.test.tsx` (all 7 tests passed).
- Ran targeted vitest suite across all 6 affected suites (67/67 passed).
- Successfully executed Next.js production build (`next build` compiled 13/13 pages with 0 errors).
