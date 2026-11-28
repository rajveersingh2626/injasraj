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
  - Automatically triggered every 5 minutes by Vercel infrastructure.
  - Authenticated via timing-safe comparison of `Authorization: Bearer ${CRON_SECRET}` header.
  - Atomic batch update in Postgres: transitions expired rooms and triggers archival snapshot.
- **Cons**: Minimum invocation resolution is 1 minute (5 minutes recommended for cost efficiency); acceptable since 15m classroom TTL has a natural buffer.

## Decision
We adopt **Option 3: Vercel Cron Sweeper at `/api/cron/room-sweeper`**.
1. `vercel.json` configures a schedule `*/5 * * * *` targeting `/api/cron/room-sweeper`.
2. The route verifies `CRON_SECRET` using `crypto.timingSafeEqual`.
3. The sweeper executes an atomic database transaction:
   - Queries `rooms WHERE status = 'active' AND expires_at <= NOW()`.
   - Archives whiteboard state and updates room status to `'archived'`.
   - Records execution audit log in `room_lifecycle_logs`.

## Consequences
- Rooms are guaranteed to expire and archive even if all participants disconnect or close their browsers.
- Client browsers no longer need battery-draining continuous interval loops.
- LiveKit rooms and Supabase channels are cleanly torn down.
