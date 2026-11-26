# GSD State: LiveKit Sync & Classroom Gating

## Current Phase: 4 (Verified & Ready to Ship)

## Task Checklist
- [x] Task 1: Student Rejoin Persistence (`STUDENT_DEVICE_ID_STORAGE_KEY` and identity preservation in `ClassroomView`, `StudentNameModal`, and token route)
- [x] Task 2: Bidirectional Mic/Video Track Sync & Camera-Off Avatar Fallback (LiveKit track events, per-participant remote media state, avatar rendering in `VideoCard` & `ClassroomWorkspace`)
- [x] Task 3: LiveKit Room Auto-Close with 15-Minute Timeout (`RoomServiceClient.createRoom` with `emptyTimeout: 900` / `departureTimeout: 900`)
- [x] Task 4: Pre-Class Student Media Gate (Block video/audio until teacher clicks "Start Class")
- [x] Task 5: Comprehensive Automated Testing & Verification (All 34 test cases passing across regression & unit suites)
