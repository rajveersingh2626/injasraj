import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

describe('Relational Schema Modeling & Migration Verification Suite', () => {
  const migrationsDir = path.resolve(__dirname, '../../supabase/migrations');
  const upMigrationPath = path.join(migrationsDir, '20261128000002_rearchitect_normalized_schema.sql');
  const downMigrationPath = path.join(migrationsDir, '20261128000002_rearchitect_normalized_schema.down.sql');

  it('ensures migration files exist and are non-empty', () => {
    expect(fs.existsSync(upMigrationPath)).toBe(true);
    expect(fs.existsSync(downMigrationPath)).toBe(true);

    const upSql = fs.readFileSync(upMigrationPath, 'utf8');
    const downSql = fs.readFileSync(downMigrationPath, 'utf8');

    expect(upSql.length).toBeGreaterThan(500);
    expect(downSql.length).toBeGreaterThan(200);
  });

  describe('Relational Schema Normalization & Constraints', () => {
    const upSql = fs.readFileSync(upMigrationPath, 'utf8');

    it('defines teacher_profiles with email uniqueness and canonical seed', () => {
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS public.teacher_profiles');
      expect(upSql).toContain('email text NOT NULL UNIQUE');
      expect(upSql).toContain("'Inderjit Kaur'");
    });

    it('defines rooms with strict check constraints on type, status, and TTL minutes (1-480)', () => {
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS public.rooms');
      expect(upSql).toContain("CHECK (type IN ('instant', 'scheduled'))");
      expect(upSql).toContain("CHECK (status IN ('pending', 'active', 'expired', 'archived'))");
      expect(upSql).toContain('CHECK (ttl_minutes >= 1 AND ttl_minutes <= 480)');
      expect(upSql).toContain('idempotency_key uuid UNIQUE');
    });

    it('defines room_participants with ON DELETE CASCADE and role check constraint', () => {
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS public.room_participants');
      expect(upSql).toContain('REFERENCES public.rooms(id) ON DELETE CASCADE');
      expect(upSql).toContain("CHECK (role IN ('teacher', 'student'))");
      expect(upSql).toContain('CONSTRAINT uq_room_participant_identity UNIQUE (room_id, identity)');
    });

    it('defines whiteboard_sessions and whiteboard_pages with cascade rules and storage offload paths', () => {
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS public.whiteboard_sessions');
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS public.whiteboard_pages');
      expect(upSql).toContain('REFERENCES public.whiteboard_sessions(id) ON DELETE CASCADE');
      expect(upSql).toContain('storage_path text');
      expect(upSql).toContain('storage_bucket text DEFAULT \'whiteboard-assets\'');
      expect(upSql).toContain('CONSTRAINT uq_session_page_index UNIQUE (session_id, page_index)');
    });

    it('enforces cold past classes partition boundary separated from active rooms', () => {
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS public.past_classes');
      expect(upSql).toContain('duration_seconds integer NOT NULL CHECK (duration_seconds >= 0)');
      expect(upSql).toContain('page_count integer NOT NULL CHECK (page_count >= 0)');
    });

    it('defines bookings table with schedule integrity check constraint', () => {
      expect(upSql).toContain('CREATE TABLE IF NOT EXISTS public.bookings');
      expect(upSql).toContain('CONSTRAINT chk_booking_time_validity CHECK (scheduled_end > scheduled_start)');
    });
  });

  describe('PostgreSQL Composite Indexes & Performance Design', () => {
    const upSql = fs.readFileSync(upMigrationPath, 'utf8');

    it('includes composite B-Tree indexes for active room queries and room sweeper', () => {
      expect(upSql).toContain('CREATE INDEX IF NOT EXISTS idx_rooms_status_created ON public.rooms (status, created_at DESC)');
      expect(upSql).toContain('CREATE INDEX IF NOT EXISTS idx_rooms_expires_active ON public.rooms (expires_at) WHERE status = \'active\'');
    });

    it('includes composite indexes for whiteboard page lookups by room and session', () => {
      expect(upSql).toContain('CREATE INDEX IF NOT EXISTS idx_whiteboard_pages_room_index ON public.whiteboard_pages (room_id, page_index)');
      expect(upSql).toContain('CREATE INDEX IF NOT EXISTS idx_whiteboard_pages_session_index ON public.whiteboard_pages (session_id, page_index)');
    });

    it('includes composite index for teacher booking schedule availability queries', () => {
      expect(upSql).toContain('CREATE INDEX IF NOT EXISTS idx_bookings_teacher_schedule ON public.bookings (teacher_id, scheduled_start, status)');
    });
  });

  describe('Reversibility & Rollback Safety', () => {
    const downSql = fs.readFileSync(downMigrationPath, 'utf8');

    it('drops tables in reverse dependency order with CASCADE protection', () => {
      expect(downSql).toContain('DROP TABLE IF EXISTS public.bookings CASCADE');
      expect(downSql).toContain('DROP TABLE IF EXISTS public.past_classes CASCADE');
      expect(downSql).toContain('DROP TABLE IF EXISTS public.whiteboard_pages CASCADE');
      expect(downSql).toContain('DROP TABLE IF EXISTS public.whiteboard_sessions CASCADE');
      expect(downSql).toContain('DROP TABLE IF EXISTS public.room_participants CASCADE');
      expect(downSql).toContain('DROP TABLE IF EXISTS public.rooms CASCADE');
      expect(downSql).toContain('DROP TABLE IF EXISTS public.teacher_profiles CASCADE');
    });
  });
});
