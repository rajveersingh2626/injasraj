# ADR-003: Scheduled Room Lifecycle via Vercel Cron Sweeper

## Status
Accepted

## Context
Injasraj Classroom rooms operate under strict lifecycle rules:
- Instant rooms have a 15-minute TTL from when the first participant joins.
- Scheduled rooms expire after their scheduled end time plus a grace period.
- Expired rooms must be transitioned from `status = 'active'` to `status = 'archived'` or `'expired'`, and their final whiteboard state must be captured in Past Classes.

Previously, room expiration was driven by a client-side `setInterval` in the teacher's active browser (`checkAndExpireRooms()`).
This client-side polling pattern had critical flaws:
1. **Unreliable Execution**: If the teacher closed their tab, laptop slept, or lost internet connectivity, expired rooms remained open indefinitely.
2. **Resource Waste**: Stale WebRTC channels and LiveKit rooms remained allocated, incurring unnecessary platform charges.
3. **Security Hazard**: Expired rooms could still be accessed by late students if no teacher browser was actively running the sweeper.

## Decision Drivers
- **Deterministic Server-Side Execution**: Room expiry must occur reliably regardless of whether any browser is open.
- **Security & Authorization**: Cron endpoints must be strictly protected against unauthorized public invocation.
- **Idempotency & Non-Destructive Archival**: Repeated sweeper runs must safely handle already-archived rooms without data corruption.
- **Serverless Compatibility**: No long-running background VM or daemon required; runs within Vercel's standard infrastructure.

## Considered Options

### Option 1: Client-Side Browser Interval (Status Quo)
- **Pros**: Zero backend code.
- **Cons**: Unreliable, stops when browser closes, leaves orphan rooms, consumes client battery.

### Option 2: Dedicated Background Worker / Node.js Daemon (e.g. BullMQ on VPS)
- **Pros**: Sub-second precision.
- **Cons**: High operational overhead, single point of failure, extra infrastructure costs, contradicts Vercel serverless deployment.

### Option 3: Vercel Cron Sweeper Route (`/api/cron/room-sweeper`) with `CRON_SECRET`
- **Pros**:
  - Native to Vercel deployment; configured via `vercel.json`.
  - Authenticated via timing-safe comparison of `Authorization: Bearer ${CRON_SECRET}` header.
- **Cons**: Vercel Hobby plan strictly limits cron invocations to **at most once per day** (`0 2 * * *`). Higher frequencies require Pro plan ($20/mo/seat).

### Option 4: Hybrid Serverless & In-Engine Lifecycle Architecture (Selected)
Combines three complementary layers:
1. **Vercel Hobby-Compliant Daily Cron (`0 2 * * *`)**: Configured in `vercel.json` for daily deep cleanup and telemetry reconciliation.
2. **Native Supabase `pg_cron` (`*/5 * * * *`)**: Leverages PostgreSQL's native `pg_cron` extension (available on all Supabase tiers) to execute `public.sweep_expired_rooms()` inside the database every 5 minutes with zero Vercel compute cost.
3. **Passive Serverless Micro-Sweep (`< 2ms`)**: `RoomService` proactively transitions expired rooms during any room lookup or join, guaranteeing instantaneous expiration without waiting for any cron tick.

## Decision
We adopt **Option 4: Hybrid Serverless & In-Engine Lifecycle Architecture**.
1. `vercel.json` configures daily schedule `0 2 * * *` targeting `/api/cron/room-sweeper`.
2. Supabase migration `20261128000003_pg_cron_room_sweeper.sql` enables `pg_cron` for automated 5-minute internal database sweeps.
3. `RoomService.performPassiveMicroSweep()` ensures zero stale rooms are visible on any read/write path.

## Consequences
- 100% compliant with Vercel Hobby tier without requiring plan upgrade.
- Rooms expire within seconds via micro-sweep and within 5 minutes via Supabase `pg_cron`.
- Zero client-side battery drain from browser polling loops.
