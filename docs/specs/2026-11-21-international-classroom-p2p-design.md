# Architectural Design Specification: Turnkey International Teaching Platform

**Date:** 2026-11-21  
**Status:** Approved (Scope Expanded to Turnkey Platform)  
**Target Budget:** $0 (No credit card required)  
**Capacity:** 100s of 1:1 classes/month (non-simultaneous)  

---

## 1. Intent & Context
The platform provides a complete end-to-end solution for teachers in India conducting 1:1 private lessons with international students. Beyond low-latency video, the platform automates the end-to-end journey: authentication, timezone-aware availability and booking, and real-time P2P WebRTC lessons. The entire infrastructure runs on free tiers without requiring a credit card (Supabase Free Tier for Auth, DB, and Realtime; Vercel for hosting; public Google/Cloudflare STUN for media routing).

---

## 2. Platform Architecture & Subsystems

```
+----------------------------------------------------------------------------------+
|                            TURNKEY TEACHING PLATFORM                             |
+----------------------------------------------------------------------------------+
| 1. AUTH & ROLES (Supabase Auth - Free Tier, No Card)                             |
|    - Teacher signup/login (Email/Password or Magic Link)                         |
|    - Student quick-join or optional account creation                             |
+----------------------------------------------------------------------------------+
| 2. TIMEZONE-AWARE BOOKING & SCHEDULING (Supabase Postgres)                       |
|    - Teacher defines weekly recurring availability (e.g. 4 PM - 9 PM IST)         |
|    - Stored in UTC; dynamically converted to Student's local browser timezone    |
|    - Conflict-free slot booking generates unique `room_id`                       |
+----------------------------------------------------------------------------------+
| 3. REAL-TIME 1:1 CLASSROOM (WebRTC P2P + Supabase Realtime)                      |
|    - Signaling via Supabase Realtime Broadcast (`room:<roomId>`)                 |
|    - Media flows directly via Google & Cloudflare STUN                           |
|    - Free TURN fallback with automatic audio-priority bandwidth protection      |
|    - Emil-grade dark glass HUD (RTT, packet loss, direct vs relay status)        |
+----------------------------------------------------------------------------------+
```

---

## 3. Database Schema (Supabase Postgres)

### 3.1 `profiles`
- `id` (UUID, PK, references `auth.users`)
- `role` ('teacher' | 'student')
- `full_name` (Text)
- `timezone` (Text, default 'Asia/Kolkata')
- `created_at` (TIMESTAMPTZ, default now())

### 3.2 `teacher_availability`
- `id` (UUID, PK)
- `teacher_id` (UUID, references `profiles.id`)
- `day_of_week` (Int, 0=Sun to 6=Sat)
- `start_time` (Time without timezone, e.g. '16:00:00' in teacher's local timezone)
- `end_time` (Time without timezone, e.g. '21:00:00')
- `slot_duration_minutes` (Int, default 60)

### 3.3 `lessons`
- `id` (UUID, PK)
- `room_id` (Text, unique index, e.g. `lesson-uuid-slug`)
- `teacher_id` (UUID, references `profiles.id`)
- `student_id` (UUID, nullable, references `profiles.id`)
- `student_name` (Text)
- `student_email` (Text)
- `start_time_utc` (TIMESTAMPTZ)
- `end_time_utc` (TIMESTAMPTZ)
- `status` ('scheduled' | 'live' | 'completed' | 'cancelled', default 'scheduled')
- `created_at` (TIMESTAMPTZ, default now())

---

## 4. Timezone Booking Flow
1. **Teacher Availability Setup:** Teacher selects active days and working hours in IST (`Asia/Kolkata`).
2. **Student Local View:** 
   - Browser timezone is detected via `Intl.DateTimeFormat().resolvedOptions().timeZone`.
   - System computes upcoming available 60-min slots for the next 14 days, converting UTC boundaries into the student's exact local time.
   - Dual-time badges prevent cross-day confusion (e.g. "Tomorrow 8:00 AM (Your time) / Tonight 10:30 PM IST (Teacher time)").
3. **Instant Booking:** Student selects a slot, enters their name and email, and receives an instant confirmation with their unique classroom link (`/classroom/<room_id>`).

---

## 5. WebRTC Media Architecture & $0 Cost Strategy
- **Signaling:** Handled via Supabase Realtime Broadcast channels (`room:<room_id>`). Uses free 2,000,000 messages/month quota.
- **Direct P2P:** Audio and video streams flow browser-to-browser via Google (`stun.l.google.com:19302`) and Cloudflare (`stun.cloudflare.com:3478`) STUN servers ($0 bandwidth).
- **Free TURN Preservation:** If `candidateType === 'relay'`, connection quality engine automatically sets `isAudioPrioritized = true` and throttles/disables video, preserving the free 500MB monthly TURN pool.

---

## 6. UI & Interaction Design (Emil Design-Engineering & Mobile-Native Polish)
- **Glass Surfaces:** Dark theme (`#09090b`), `backdrop-filter: blur(16px)`, `rgba(18, 18, 24, 0.72)` glass cards with 1px hairline border (`rgba(255,255,255,0.08)`) and inset specular highlight.
- **Tactile Inputs:** All interactive buttons and slot cards feature `:active { transform: scale(0.97); }` with 160ms cubic-bezier transitions.
- **Origin-Aware Popovers:** Network HUD and device selectors scale from `0.95` with trigger-anchored transform origin.
- **Liquid State Morphing:** Micro-blur crossfades during mic/cam/screen-share toggles.

### 6.1 Complete Mobile & Tablet Native Hardening
- **Viewport & Insets:**
  - Viewport: `width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content`
  - Safe Areas: Dynamic padding using `env(safe-area-inset-top)` on header and `env(safe-area-inset-bottom)` on floating controls bar so buttons never collide with the iOS home indicator or Android navigation pill.
  - Height: `100dvh` for the classroom shell (tracks visible area as browser navigation bar expands/collapses).
- **Touch & Gesture Hygiene:**
  - `-webkit-tap-highlight-color: transparent` globally (no ugly blue/gray tap boxes).
  - `touch-action: manipulation` on buttons to eliminate the 300ms double-tap delay.
  - `user-select: none` on controls and buttons to prevent long-press text selection callouts.
  - `@media (hover: hover) and (pointer: fine)` wraps all hover states to prevent "sticky hover" on touch screens.
  - `font-size: 16px` on all form inputs to prevent iOS Safari from zooming and throwing the layout off-center.
  - `overscroll-behavior: none` on classroom root to stop pull-to-refresh from hijacking video gestures.
- **Responsive Layout Adaptation:**
  - **Phone Portrait (<640px):** Remote video takes primary stage; local self-view floats as an interactive Picture-in-Picture (PiP) tile in the top/bottom corner. Control bar collapses to high-touch circular glass icons anchored safely above the home bar.
  - **Tablet & Landscape (>=640px):** Cinematic 1:1 side-by-side or presentation stage with fluid aspect ratios.

---

## 7. Modularity & LiveKit / Coturn Migration Path
Classroom UI consumes only the `IMediaSession` interface. When you obtain an Oracle Always Free VPS or credit card:
1. Deploy self-hosted Coturn on your Oracle VM and drop credentials into `.env.local` to eliminate TURN relay bandwidth caps.
2. Or deploy LiveKit SFU on your Oracle VM and swap `P2PWebRTCMediaSession` with `LiveKitMediaSession` without touching any UI code.

---

## 5. UI & Interaction Design (Emil Design-Engineering Polish)

To achieve the "minimalist yet edgy, dark-mode glassmorphic" aesthetic with high-craft tactile feel:

### 5.1 Glassmorphic Surfaces & Precision Borders
- **Floating Controls Island & HUD:**
  - Background: `rgba(18, 18, 24, 0.72)` with `backdrop-filter: blur(16px) saturate(180%)`.
  - Precision Border: `1px solid rgba(255, 255, 255, 0.08)`.
  - Inset Specular Highlight: `box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.12), 0 8px 32px -4px rgba(0, 0, 0, 0.48)`.
  - Subtle dark theme framing (`#09090b` canvas) providing maximum contrast for video content.

### 5.2 Tactile Glass Buttons (`:active` Feedback & Motion)
- **Micro-Interactions:**
  - Standard buttons use `transition: transform 160ms var(--ease-out), background 160ms ease, border-color 160ms ease` (never `transition: all`).
  - Active press: `transform: scale(0.97)` on `:active` for immediate tactile responsiveness.
  - Custom easing curves:
    ```css
    --ease-out: cubic-bezier(0.23, 1, 0.32, 1);
    --ease-in-out: cubic-bezier(0.77, 0, 0.175, 1);
    ```
  - State morphing: Mute/unmute and cam toggles crossfade with subtle `filter: blur(2px)` masking to ensure state changes feel liquid and continuous.
  - Danger action (End Call): Deep crimson glass glow (`rgba(239, 68, 68, 0.2)` with `border: 1px solid rgba(239, 68, 68, 0.4)`).

### 5.3 Network Health Indicator (Glass Pill HUD)
- **Compact View:** A discreet floating glass pill in the top corner with an organic pulsing status dot:
  - Green: Direct P2P (<150ms RTT)
  - Amber: Relayed connection or moderate latency (150–350ms RTT)
  - Red: High packet loss (>5%) or Audio-Priority degraded mode
- **Origin-Aware Popover:**
  - Expands from the pill trigger (`transform-origin: top right`), entering from `scale(0.95)` with `opacity: 0` (never `scale(0)`).
  - Displays real-time WebRTC telemetry: RTT (ms), Packet Loss (%), Resolution/FPS, and Direct (P2P) vs Relayed status.

### 5.4 Video Stage Layout & Motion
- 1:1 view with rounded inner video containers (`border-radius: 16px`) and subtle inset hairline borders.
- Participant entry/exit uses asymmetric timing: 240ms enter with `var(--ease-out)`, 180ms snappy exit.

---

## 6. Verification & Testing Strategy
1. **Multi-NAT & Simulation:**
   - Chrome DevTools Network throttling (Simulate high latency 250ms+ cross-border RTT, 3% packet loss).
2. **Direct vs. Relay Verification:**
   - Verify `chrome://webrtc-internals` shows `candidateType: "relay"` when forced behind strict test configurations and `"host"` / `"srflx"` in open networks.
3. **Disconnection & Reconnection:**
   - Simulate brief Wi-Fi disconnect; ensure ICE restart (`peerConnection.restartIce()`) reconnects seamlessly without room reloading.
4. **Device Switching:**
   - Test seamless hot-swapping of microphones and cameras using `RTCRtpSender.replaceTrack()`.
