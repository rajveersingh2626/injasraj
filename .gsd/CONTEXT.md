# Context: LiveKit Real-Time Sync, Latency Optimization, and Classroom Gating

## Objective
Address critical real-time sync, participant persistence, LiveKit room lifecycle, and pre-class media gating on Injasraj platform while preserving Supabase SSOT normalization and server-side teacher authentication.

## Constraints & Requirements
1. **Student Rejoin Persistence**: Persist same-device student identity (`injasraj_student_device_id` / `injasraj_student_name`) so rejoining connects cleanly without duplicate participants or permission/reward resets.
2. **Bidirectional Mic & Video State Sync + Avatar Fallback**: Real-time synchronization of mute/unmute and camera off across both ends. Display clean avatar with initials/photo when camera is off.
3. **LiveKit Room Auto-Close (15-min Timeout)**: Configure `emptyTimeout: 900` and `departureTimeout: 900` via LiveKit RoomServiceClient so rooms cleanly shut down when abandoned.
4. **Pre-Class Waiting Gate**: Students must not see video, audio, or classroom active media until teacher explicitly clicks "Start Class".
5. **No-Zombie-Data & SSOT Compliance**: Respect Supabase SSOT tables (`lessons`, `profiles`, `whiteboard_sessions`). Zero table resets.
