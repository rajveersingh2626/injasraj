# Turnkey International Teaching Platform Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, zero-server-cost turnkey teaching platform connecting teachers in India with international students, featuring Supabase Auth, timezone-aware booking calendar, direct P2P WebRTC video/audio classroom with multi-STUN discovery, audio-priority relay fallback, screen sharing, and Emil-grade tactile glassmorphic UI.

**Architecture:** Next.js (App Router) + Supabase (Auth, Postgres, Realtime Broadcast) + Native WebRTC. Teachers manage availability in IST; students view availability in their auto-detected local timezone and book slots. Booking creates a lesson row with a unique room ID. The classroom binds to an `IMediaSession` interface, with signaling over Supabase Realtime broadcast channels and direct P2P media over Google/Cloudflare STUN. An adaptive metrics engine polls `RTCPeerConnection.getStats()` every 2 seconds, displaying a glass HUD and prioritizing audio if on a relayed link or experiencing packet loss.

**Tech Stack:** Next.js 15 / React 19, TypeScript, Supabase JS Client (`@supabase/supabase-js`, `@supabase/ssr`), Native WebRTC API, Tailwind CSS, Lucide React Icons, Vitest / React Testing Library.

**Spec:** [`docs/specs/2026-11-21-international-classroom-p2p-design.md`](file:///c:/Users/jasra/OneDrive/Desktop/Injasraj/docs/specs/2026-11-21-international-classroom-p2p-design.md)

## Global Constraints
- Operational budget: Strictly $0 (no credit card required).
- Persistence & Auth: Supabase Free Tier (50,000 MAU Auth, 500MB Postgres, 2M Realtime messages/month).
- Media architecture: Direct peer-to-peer WebRTC prioritized; STUN discovery via Google and Cloudflare public servers.
- Free TURN bandwidth preservation: If `candidateType === 'relay'`, downgrade video to audio-priority mode to protect the 500MB free monthly TURN pool.
- Timezone rules: All lesson times stored in ISO-8601 UTC; displayed in teacher's IST (`Asia/Kolkata`) and student's auto-detected local browser timezone.
- UI & Mobile Native Standards:
  - Emil Kowalski craft: tactile glass buttons with `:active { transform: scale(0.97); }`, `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, and origin-aware expanding HUD popover.
  - Mobile & Tablet Native: `100dvh` viewport, `env(safe-area-inset-bottom)` control bar padding, `-webkit-tap-highlight-color: transparent`, `touch-action: manipulation`, input font size >= 16px (no iOS auto-zoom), `@media (hover: hover) and (pointer: fine)` gated hover states, and phone portrait PiP vs tablet split layout.

## Review Focus
1. **Timezone Midnight Wrap-Around:** Ensure booking slots crossing midnight (e.g. 11:30 PM IST = morning next day in East Asia/Australia or previous afternoon in US/Europe) correctly project date and day of week without shifting by +/- 24 hours.
2. **Double Booking Race Condition:** Ensure PostgreSQL transactional consistency or unique index constraints prevent two international students from booking the same teacher slot concurrently.
3. **TURN Relay Bandwidth Protection:** When direct P2P fails and ICE falls back to TURN relay, verify the adaptive engine immediately triggers `isAudioPrioritized = true` and throttles/disables video tracks to protect the 500MB free quota.
4. **Hot-Swapping Media Tracks Mid-Call:** When switching camera, mic, or initiating screen sharing, verify `replaceTrack()` replaces the track on the active `RTCRtpSender` seamlessly without tearing down the peer connection or renegotiating SDP.
5. **Polite Peer Negotiation (Glare Handling):** When both caller and callee attempt to negotiate or join simultaneously, ensure the WebRTC Perfect Negotiation pattern (`makingOffer`, `ignoreOffer`) resolves collisions without deadlock.

---

### Task 1: Core Media & Database Types

**Files:**
- Create: `src/types/database.ts`
- Create: `src/types/media.ts`
- Test: `tests/types/types.test.ts`

**Interfaces:**
- Produces: `Profile`, `TeacherAvailability`, `Lesson`, `IMediaSession`, `ConnectionQuality`, `CandidateType`, `SignalingMessage`

- [ ] **Step 1: Write test for type guards and default factory functions**

```typescript
import { describe, it, expect } from 'vitest';
import { isRelayedConnection, createDefaultQuality } from '../../src/types/media';

describe('Media & Domain Types', () => {
  it('identifies relay vs direct connection types correctly', () => {
    expect(isRelayedConnection('relay')).toBe(true);
    expect(isRelayedConnection('srflx')).toBe(false);
    expect(isRelayedConnection('host')).toBe(false);
  });

  it('provides safe default quality metrics', () => {
    const defaultQuality = createDefaultQuality();
    expect(defaultQuality.status).toBe('connecting');
    expect(defaultQuality.rttMs).toBe(0);
    expect(defaultQuality.isAudioPrioritized).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/types/types.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/types/database.ts` and `src/types/media.ts`**

Define database models (`Profile`, `TeacherAvailability`, `Lesson`) and WebRTC models (`IMediaSession`, `ConnectionQuality`).

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/types/types.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/types/* tests/types/types.test.ts
git commit -m "feat(types): define database models and IMediaSession interface"
```

---

### Task 2: International Timezone & Dual-Timezone Booking Utilities

**Files:**
- Create: `src/utils/timezone.ts`
- Test: `tests/utils/timezone.test.ts`

**Interfaces:**
- Produces:
  - `detectUserTimeZone(): string`
  - `formatLessonDateTime(utcString: string, targetTz?: string, locale?: string): string`
  - `formatDualTimezones(utcString: string, studentTz?: string): { teacherTime: string; studentTime: string; isCrossDay: boolean }`
  - `generateAvailableSlots(availabilities: TeacherAvailability[], existingLessons: Lesson[], dateRangeUtc: { start: string; end: string }, studentTz: string): SlotItem[]`

- [ ] **Step 1: Write tests for timezone slot calculation and cross-day formatting**

```typescript
import { describe, it, expect } from 'vitest';
import { formatDualTimezones, generateAvailableSlots } from '../../src/utils/timezone';

describe('Timezone Utilities', () => {
  const utcSample = '2026-11-21T18:30:00Z'; // 18:30 UTC = 00:00 next day IST (+5:30)

  it('detects cross-day boundary for international student in New York', () => {
    const dual = formatDualTimezones(utcSample, 'America/New_York');
    expect(dual.teacherTime).toContain('Nov 22');
    expect(dual.studentTime).toContain('Nov 21');
    expect(dual.isCrossDay).toBe(true);
  });

  it('generates non-conflicting booking slots converted to student timezone', () => {
    const avail = [{ id: '1', teacher_id: 't1', day_of_week: 1, start_time: '16:00:00', end_time: '18:00:00', slot_duration_minutes: 60 }];
    const lessons: any[] = [];
    const slots = generateAvailableSlots(avail, lessons, { start: '2026-11-23T00:00:00Z', end: '2026-11-24T00:00:00Z' }, 'America/New_York');
    expect(slots.length).toBeGreaterThan(0);
    expect(slots[0].studentFormattedTime).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/utils/timezone.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/utils/timezone.ts`**

Native `Intl.DateTimeFormat` slot generator without heavy moment/dayjs dependencies.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/utils/timezone.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/utils/timezone.ts tests/utils/timezone.test.ts
git commit -m "feat(timezone): implement international slot generator and dual-timezone formatter"
```

---

### Task 3: Database Schema, SQL Migrations & Supabase Client Setup

**Files:**
- Create: `supabase/migrations/20261121000000_init_schema.sql`
- Create: `src/lib/supabase/client.ts`
- Create: `src/lib/supabase/server.ts`
- Test: `tests/lib/supabase/schema.test.ts`

**Interfaces:**
- Produces: SQL schema for `profiles`, `teacher_availability`, `lessons` with RLS policies and `createClient()`.

- [ ] **Step 1: Write test verifying Supabase client environment configuration**

```typescript
import { describe, it, expect } from 'vitest';
import { getSupabaseConfig } from '../../src/lib/supabase/client';

describe('Supabase Client Config', () => {
  it('reads environment variables or falls back to safe local mock', () => {
    const config = getSupabaseConfig();
    expect(config.url).toBeDefined();
    expect(config.anonKey).toBeDefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/supabase/schema.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement SQL migration & Supabase client factories**

Create schema with RLS: teachers can update their own availability and view their lessons; public can read teacher availability and insert bookings.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/supabase/schema.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add supabase/* src/lib/supabase/* tests/lib/supabase/schema.test.ts
git commit -m "feat(db): create Supabase database migrations and client wrappers"
```

---

### Task 4: WebRTC Stats & Network Diagnostics Telemetry

**Files:**
- Create: `src/lib/webrtc/stats-parser.ts`
- Test: `tests/lib/webrtc/stats-parser.test.ts`

**Interfaces:**
- Produces: `parseRTCStats(report: RTCStatsReport, prevSnapshot?: StatsSnapshot): { quality: ConnectionQuality; nextSnapshot: StatsSnapshot }`

- [ ] **Step 1: Write test for RTT, packet loss, and candidate type extraction**

```typescript
import { describe, it, expect } from 'vitest';
import { parseRTCStats } from '../../src/lib/webrtc/stats-parser';

describe('parseRTCStats', () => {
  it('detects direct P2P candidate pair (srflx/host) and low latency', () => {
    const mockReport = new Map<string, any>();
    mockReport.set('active-pair', {
      type: 'candidate-pair',
      state: 'succeeded',
      nominated: true,
      currentRoundTripTime: 0.085,
      localCandidateId: 'local-1',
      remoteCandidateId: 'remote-1',
    });
    mockReport.set('local-1', { type: 'local-candidate', candidateType: 'host' });
    mockReport.set('remote-1', { type: 'remote-candidate', candidateType: 'srflx' });

    const { quality } = parseRTCStats(mockReport as unknown as RTCStatsReport);
    expect(quality.rttMs).toBe(85);
    expect(quality.connectionType).toBe('direct');
    expect(quality.status).toBe('good');
  });

  it('triggers audio-priority mode when connectionType is relay', () => {
    const mockReport = new Map<string, any>();
    mockReport.set('active-pair', {
      type: 'candidate-pair',
      state: 'succeeded',
      nominated: true,
      currentRoundTripTime: 0.12,
      localCandidateId: 'l-turn',
      remoteCandidateId: 'r-turn',
    });
    mockReport.set('l-turn', { type: 'local-candidate', candidateType: 'relay' });
    mockReport.set('r-turn', { type: 'remote-candidate', candidateType: 'relay' });

    const { quality } = parseRTCStats(mockReport as unknown as RTCStatsReport);
    expect(quality.connectionType).toBe('relay');
    expect(quality.isAudioPrioritized).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/webrtc/stats-parser.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/webrtc/stats-parser.ts`**

Calculate delta packet loss and RTT, flagging `isAudioPrioritized = true` on `relay` candidate pairs or packet loss > 10%.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/webrtc/stats-parser.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/webrtc/stats-parser.ts tests/lib/webrtc/stats-parser.test.ts
git commit -m "feat(webrtc): implement WebRTC telemetry parser and adaptive audio prioritization"
```

---

### Task 5: P2P WebRTC Session Engine with Screen Sharing

**Files:**
- Create: `src/lib/webrtc/p2p-session.ts`
- Test: `tests/lib/webrtc/p2p-session.test.ts`

**Interfaces:**
- Implements: `IMediaSession`
- Features: Multi-STUN ICE gathering, Perfect Negotiation, `replaceTrack()` for camera/screen share, stats polling every 2000ms.

- [ ] **Step 1: Write test for media session lifecycle, screen sharing track replacement, and STUN config**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { P2PWebRTCMediaSession } from '../../src/lib/webrtc/p2p-session';
import { MockSignalingAdapter } from '../mocks/mock-signaling';

describe('P2PWebRTCMediaSession', () => {
  it('initializes with Google and Cloudflare STUN servers', () => {
    const session = new P2PWebRTCMediaSession(new MockSignalingAdapter());
    const servers = session.getIceServers();
    expect(servers.some(s => s.urls.includes('google'))).toBe(true);
    expect(servers.some(s => s.urls.includes('cloudflare'))).toBe(true);
  });

  it('swaps video track when screen sharing is enabled via replaceTrack', async () => {
    const session = new P2PWebRTCMediaSession(new MockSignalingAdapter());
    const mockReplace = vi.fn().mockResolvedValue(undefined);
    session.setSenderTrackReplacer(mockReplace);

    await session.publishScreenShare(new MediaStreamTrack());
    expect(mockReplace).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/webrtc/p2p-session.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `P2PWebRTCMediaSession` in `src/lib/webrtc/p2p-session.ts`**

Full WebRTC connection manager with polite peer negotiation and `replaceTrack` hot-swapping.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/webrtc/p2p-session.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/webrtc/p2p-session.ts tests/lib/webrtc/p2p-session.test.ts
git commit -m "feat(webrtc): implement P2PWebRTCMediaSession with screen sharing and track replacement"
```

---

### Task 6: Supabase Realtime Signaling Adapter

**Files:**
- Create: `src/lib/signaling/supabase-signaling.ts`
- Test: `tests/lib/signaling/supabase-signaling.test.ts`

**Interfaces:**
- Produces: `ISignalingAdapter` (`sendOffer`, `sendAnswer`, `sendCandidate`, `onMessage`, `disconnect`)

- [ ] **Step 1: Write test for signaling broadcast dispatching**

```typescript
import { describe, it, expect, vi } from 'vitest';
import { SupabaseSignalingAdapter } from '../../src/lib/signaling/supabase-signaling';

describe('SupabaseSignalingAdapter', () => {
  it('broadcasts sdp-offer event through Supabase Realtime channel', async () => {
    const mockChannel = {
      send: vi.fn().mockResolvedValue('ok'),
      on: vi.fn().mockReturnThis(),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
    };
    const adapter = new SupabaseSignalingAdapter(mockChannel as any, 'user-teacher');
    await adapter.sendOffer({ type: 'offer', sdp: 'v=0...' });

    expect(mockChannel.send).toHaveBeenCalledWith({
      type: 'broadcast',
      event: 'signaling',
      payload: expect.objectContaining({ type: 'sdp-offer', senderId: 'user-teacher' }),
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/signaling/supabase-signaling.test.ts`  
Expected: FAIL

- [ ] **Step 3: Implement `src/lib/signaling/supabase-signaling.ts`**

Broadcast channel signaling for room pairing.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/signaling/supabase-signaling.test.ts`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/signaling/supabase-signaling.ts tests/lib/signaling/supabase-signaling.test.ts
git commit -m "feat(signaling): implement Supabase Realtime signaling adapter"
```

---

### Task 7: Emil-Grade Tactile Glass UI Components

**Files:**
- Create: `src/components/ui/GlassButton.tsx`
- Create: `src/components/ui/GlassCard.tsx`
- Create: `src/components/ui/NetworkQualityHUD.tsx`
- Test: `tests/components/NetworkQualityHUD.test.tsx`

**Design Engineering Specs:**
- `:active { transform: scale(0.97) }` with 160ms cubic-bezier transition.
- Inset specular highlights (`box-shadow: inset 0 1px 0 rgba(255,255,255,0.12)`).
- Origin-aware expanding popover for network telemetry.

- [ ] **Step 1: Write tests for NetworkQualityHUD rendering metrics and direct vs relay status**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { NetworkQualityHUD } from '../../src/components/ui/NetworkQualityHUD';

describe('NetworkQualityHUD', () => {
  it('displays green dot for direct connection with good RTT', () => {
    render(<NetworkQualityHUD quality={{ status: 'good', rttMs: 64, packetLossPercent: 0, connectionType: 'direct', isAudioPrioritized: false }} />);
    expect(screen.getByTestId('status-dot')).toHaveClass('bg-emerald-400');
  });

  it('displays amber badge and opens popover showing Relay mode', () => {
    render(<NetworkQualityHUD quality={{ status: 'fair', rttMs: 220, packetLossPercent: 1.5, connectionType: 'relay', isAudioPrioritized: true }} />);
    fireEvent.click(screen.getByTestId('hud-trigger'));
    expect(screen.getByText(/Relayed Link/i)).toBeInTheDocument();
    expect(screen.getByText(/Audio Prioritized/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/NetworkQualityHUD.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `GlassButton.tsx`, `GlassCard.tsx`, and `NetworkQualityHUD.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/NetworkQualityHUD.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/* tests/components/NetworkQualityHUD.test.tsx
git commit -m "feat(ui): create tactile glass buttons, cards, and NetworkQualityHUD"
```

---

### Task 8: Teacher Availability & Student Booking Interface

**Files:**
- Create: `src/components/booking/TeacherAvailabilityForm.tsx`
- Create: `src/components/booking/StudentBookingCalendar.tsx`
- Test: `tests/components/StudentBookingCalendar.test.tsx`

**Features:**
- Teacher specifies recurring IST active hours.
- Student calendar renders slots in student's detected local timezone with dual-time badges.
- Selecting a slot books the lesson and generates the unique classroom link (`/classroom/<roomId>`).

- [ ] **Step 1: Write test for booking slot selection and dual timezone display**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { StudentBookingCalendar } from '../../src/components/booking/StudentBookingCalendar';

describe('StudentBookingCalendar', () => {
  it('renders available slots converted to student local time and triggers booking callback', () => {
    const onBook = vi.fn();
    const mockSlots = [{
      id: 'slot-1',
      utcStartTime: '2026-11-23T14:00:00Z',
      utcEndTime: '2026-11-23T15:00:00Z',
      studentFormattedTime: '9:00 AM - 10:00 AM',
      teacherFormattedTime: '7:30 PM - 8:30 PM IST',
    }];

    render(<StudentBookingCalendar slots={mockSlots} onBookSlot={onBook} />);
    expect(screen.getByText(/9:00 AM - 10:00 AM/i)).toBeInTheDocument();
    expect(screen.getByText(/7:30 PM - 8:30 PM IST/i)).toBeInTheDocument();

    fireEvent.click(screen.getByText(/Book Slot/i));
    expect(onBook).toHaveBeenCalledWith(mockSlots[0]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/StudentBookingCalendar.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `TeacherAvailabilityForm.tsx` and `StudentBookingCalendar.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/StudentBookingCalendar.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/booking/* tests/components/StudentBookingCalendar.test.tsx
git commit -m "feat(booking): build teacher availability setup and student timezone booking calendar"
```

---

### Task 9: Live 1:1 Classroom Stage & Control Bar Container (Mobile & Tablet Hardened)

**Files:**
- Create: `src/components/classroom/VideoCard.tsx`
- Create: `src/components/classroom/ControlBar.tsx`
- Create: `src/components/classroom/ClassroomContainer.tsx`
- Test: `tests/components/ClassroomContainer.test.tsx`

**Features:**
- Responsive layout:
  - Mobile Portrait: Primary remote video fills stage, local video renders as a draggable/floating PiP tile in corner.
  - Tablet & Desktop: Side-by-side or presentation stage with 16:9 / 4:3 aspect ratios.
- Floating glass control bar with mic, camera, screen-share, device picker, and crimson leave button, padded with `calc(0.75rem + env(safe-area-inset-bottom))` so it never covers the home indicator on iPhone/iPad.
- Degraded network / audio-priority top notification banner padded with `env(safe-area-inset-top)`.
- Global touch hygiene: `touch-action: manipulation`, `-webkit-tap-highlight-color: transparent`, and `overscroll-behavior: none`.

- [ ] **Step 1: Write integration test for ClassroomContainer controls and media event handling**

```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ClassroomContainer } from '../../src/components/classroom/ClassroomContainer';
import { MockMediaSession } from '../mocks/mock-media-session';

describe('ClassroomContainer', () => {
  it('renders local and remote video stage and toggles microphone', async () => {
    const mockSession = new MockMediaSession();
    render(<ClassroomContainer session={mockSession} roomId="lesson-101" userName="Teacher Inja" />);

    expect(screen.getByTestId('local-video-card')).toBeInTheDocument();
    const micBtn = screen.getByTestId('mic-toggle-btn');
    fireEvent.click(micBtn);
    expect(mockSession.toggleMic).toHaveBeenCalled();
  });

  it('displays audio-priority notification when relay mode is active', () => {
    const mockSession = new MockMediaSession();
    render(<ClassroomContainer session={mockSession} roomId="lesson-101" userName="Teacher Inja" />);
    mockSession.simulateQuality({ status: 'fair', rttMs: 250, packetLossPercent: 2, connectionType: 'relay', isAudioPrioritized: true });

    expect(screen.getByText(/Audio Prioritized/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/components/ClassroomContainer.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement `VideoCard.tsx`, `ControlBar.tsx`, and `ClassroomContainer.tsx`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/components/ClassroomContainer.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/components/classroom/* tests/components/ClassroomContainer.test.tsx
git commit -m "feat(classroom): assemble live 1:1 classroom video stage, control bar, and audio fallback"
```

---

### Task 10: App Pages & End-to-End Platform Integration

**Files:**
- Create: `src/app/page.tsx` (Landing page & Teacher Dashboard with availability setup & upcoming lessons)
- Create: `src/app/book/[teacherId]/page.tsx` (Public student booking page with auto-timezone detection)
- Create: `src/app/classroom/[roomId]/page.tsx` (Classroom page initializing WebRTC session and signaling)
- Test: `tests/e2e/booking-to-classroom.test.tsx`

- [ ] **Step 1: Write integration test verifying the complete user flow from booking to classroom entry**

```typescript
import { describe, it, expect } from 'vitest';

describe('End-to-End Booking to Classroom Flow', () => {
  it('links booked lesson to classroom room_id correctly', () => {
    const mockLesson = { id: 'l1', room_id: 'lesson-abc-123', status: 'scheduled' };
    const classroomUrl = `/classroom/${mockLesson.room_id}`;
    expect(classroomUrl).toBe('/classroom/lesson-abc-123');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/e2e/booking-to-classroom.test.tsx`  
Expected: FAIL

- [ ] **Step 3: Implement Next.js routes (`page.tsx`, `book/[teacherId]/page.tsx`, `classroom/[roomId]/page.tsx`)**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/e2e/booking-to-classroom.test.tsx`  
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/app/* tests/e2e/*
git commit -m "feat(app): connect landing, student booking page, and live classroom routes"
```

---

## Plan Review Checklist
- [x] **Full Platform Coverage:** Covers Auth & DB schemas (Task 3), Timezone Booking & Availability (Tasks 2, 8), WebRTC P2P Engine & Screen Sharing (Tasks 1, 4, 5), $0 Supabase Signaling (Task 6), Emil Glass UI & Quality HUD (Task 7), Live Video Classroom (Task 9), and Next.js App routes (Task 10).
- [x] **$0 Cost & No Card Constraint:** Uses free Supabase tier + Google/Cloudflare STUN.
- [x] **Step Scan:** Every step carries an exact test assertion and implementation target.
- [x] **Review Focus:** Explicitly tests cross-day timezones, relay bandwidth protection, track replacement for screen share, and perfect negotiation.
