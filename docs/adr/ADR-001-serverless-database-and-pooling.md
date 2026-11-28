# ADR-001: Serverless Database Connection Pooling with Supavisor

## Status
Accepted

## Context
Injasraj Classroom is deployed on Vercel's serverless edge and Node.js App Router compute environments. Because serverless functions scale horizontally and spin up/down dynamically on demand, each concurrent function instance initiates a new TCP connection to PostgreSQL if connecting directly.

Under peak classroom concurrency (multiple students, teachers, simultaneous whiteboard state fetches, and booking requests), direct PostgreSQL connections rapidly exhaust PostgreSQL's `max_connections` limit (typically 60-100 connections on standard tiers), causing:
- `FATAL: remaining connection slots are reserved for non-replication superuser connections`
- 500 Internal Server Errors on API routes
- Connection latency spikes during cold starts (TCP handshake + SSL/TLS negotiation + auth handshake)

## Decision Drivers
- **Prevent Connection Exhaustion**: Support 500+ burst serverless requests without exhausting database slots.
- **Sub-10ms Query Latency**: Reuse existing warmed connections across serverless function invocations.
- **Transaction Safety**: Support multi-statement transactional operations (e.g. room reservation + participant creation) while retaining pooling efficiency.
- **Zero Client-Side Burden**: Transparent connection configuration using standard Supabase connection strings.

## Considered Options

### Option 1: Direct PostgreSQL Connection (`port 5432`)
- **Pros**: Supports session-level features (`LISTEN`/`NOTIFY`, prepared statements, temporary tables).
- **Cons**: Severe connection exhaustion under serverless load; high connection establishment latency on every lambda invocation.

### Option 2: Prisma Accelerate / External Proxy
- **Pros**: Managed caching and pooling.
- **Cons**: Additional vendor lock-in, recurring external SaaS cost, added network hop outside Supabase region.

### Option 3: Supabase Supavisor Connection Pooler in Transaction Mode (`port 6543`)
- **Pros**:
  - Native to Supabase, running co-located in the same AWS/GCP region.
  - Transaction mode: connections are returned to the pool as soon as the transaction ends, allowing thousands of serverless requests to share tens of actual PostgreSQL backend connections.
  - Built-in connection queuing and health checking.
  - Zero application restructuring required: simply specify port `6543` with `?pgbouncer=true` / `?pooler=transaction` in the connection string.
- **Cons**: Prepared statements must be disabled (`prepare: false` or parameter replacement) or use named prepared statements managed by Supavisor; session-level variables are transient.

## Decision
We adopt **Option 3: Supabase Supavisor Connection Pooler in Transaction Mode on Port 6543** for all serverless API routes, background workers, and Vercel Cron jobs.

For persistent WebSocket signaling and real-time broadcasts, clients continue using Supabase Realtime Channels (which do not consume PostgreSQL connections per client).

## Consequences
- Serverless functions connect via Supavisor pooler on port 6543, eliminating `remaining connection slots` errors.
- Database connection strings must configure `connect_timeout=10` and `pool_mode=transaction`.
- Migration scripts and DDL statements continue using port `5432` (direct session mode) as DDL requires exclusive lock control and session-level capabilities.
