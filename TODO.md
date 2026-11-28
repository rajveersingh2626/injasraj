# Ralph Loop Master Checklist: Vercel + Supabase Architecture Hardening

## Phase 1: Architecture Decision Records & API Contracts
- [x] 1.1 Create formal ADRs in `docs/adr/` per `architecture-decision-records`:
  - `ADR-001-serverless-database-and-pooling.md`: Supabase Postgres + Supavisor transaction pooler on port 6543.
  - `ADR-002-blob-storage-separation.md`: Offloading whiteboard canvas JSON and PDF raster slides into Supabase Storage.
  - `ADR-003-scheduled-room-lifecycle.md`: Vercel Cron room expiry sweeps replacing client-side intervals.
- [x] 1.2 Map classroom UI consumers into TypeScript request/response contracts with Zod validation in `src/contracts/classroom-contracts.ts` per `frontend-to-backend-requirements`.
- [x] 1.3 Write unit tests for contract validators in `tests/contracts/classroom-contracts.test.ts`.

## Phase 2: Relational Schema Modeling & Migration Planning
- [x] 2.1 Normalize data model per `database-schema-designer` and `database-design`: `rooms`, `room_participants`, `whiteboard_sessions`, `whiteboard_pages`, `teacher_profiles`, and `bookings` with strict foreign keys, cascade deletes, and check constraints.
- [x] 2.2 Design table partitioning and relational boundaries between active sessions and cold past classes per `database-architect`.
- [x] 2.3 Structure sequential, reversible migration in `supabase/migrations/20261128000002_rearchitect_normalized_schema.sql` and rollback `20261128000002_rearchitect_normalized_schema.down.sql` per `database-migration`.
- [x] 2.4 Verify migration syntax, constraints, and test schema in `tests/database/schema-verification.test.ts`.

## Phase 3: PostgreSQL Optimization & Best Practices
- [x] 3.1 Configure Supavisor transaction mode on port 6543 (`src/lib/supabase/pooler.ts`) and audit connection pooling per `postgres-best-practices`.
- [x] 3.2 Harden Row-Level Security (RLS) policies ensuring students cannot mutate teacher settings or other rooms.
- [x] 3.3 Design composite B-Tree indexes for high-frequency queries (`(status, created_at)`, `(room_id, page_index)`) and verify query execution plans under 5ms per `postgresql-optimization`.
- [x] 3.4 Write tests verifying pooler config and RLS policy rules in `tests/database/postgres-optimization.test.ts`.

## Phase 4: API Architecture, Service Layer & Backend Patterns
- [x] 4.1 Refactor Next.js App Router route handlers to Controller -> Service Layer -> Repository pattern with centralized error envelopes and structured logging per `backend-architect` and `nodejs-backend-patterns` (`src/server/errors.ts`, `src/server/logger.ts`, `src/server/repositories/`, `src/server/services/`).
- [x] 4.2 Enforce RESTful consistency, idempotency keys on room creation/booking endpoints, and standard HTTP error codes per `api-design-principles`.
- [x] 4.3 Implement Vercel Cron handler at `/api/cron/room-sweeper/route.ts` authenticated via `CRON_SECRET`.
- [x] 4.4 Write tests for service layer, repositories, and cron handler in `tests/server/api-architecture.test.ts`.

## Phase 5: Backup Strategy & Disaster Recovery
- [x] 5.1 Document disaster recovery and point-in-time recovery runbooks in `docs/disaster-recovery.md` per `database-backups`.
- [x] 5.2 Implement GitHub Actions automated backup workflow at `.github/workflows/db-backup.yml` for automated scheduled pg_dump to encrypted storage.
- [x] 5.3 Write verification test ensuring backup workflow and disaster recovery documentation integrity in `tests/devops/backup-workflow.test.ts`.

## Verification & Handover
- [x] 6.1 Execute full test suite `npx vitest run` ensuring 100% green tests.
- [x] 6.2 Update `CONTEXT.md` and `HANDOVER.md`.
- [x] 6.3 Commit all changes with clear atomic git messages.
