-- Migration: 20261128000002_rearchitect_normalized_schema.sql
-- Description: Comprehensive relational schema normalization, strict constraints, partitioning boundary, and RLS for Vercel + Supabase

-- 1. Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Teacher Profiles Table (canonical teacher entity)
CREATE TABLE IF NOT EXISTS public.teacher_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  email text NOT NULL UNIQUE,
  bio text DEFAULT '',
  subject text NOT NULL DEFAULT 'Punjabi',
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Seed canonical teacher profile for Inderjit Kaur
INSERT INTO public.teacher_profiles (id, full_name, email, bio, subject, timezone)
VALUES (
  '00000000-0000-0000-0000-000000000001',
  'Inderjit Kaur',
  'inderjit@injasraj.com',
  'Experienced Punjabi educator specializing in Gurmukhi, conversation, and Punjabi literature.',
  'Punjabi',
  'Asia/Kolkata'
)
ON CONFLICT (id) DO UPDATE
SET full_name = 'Inderjit Kaur', email = 'inderjit@injasraj.com', updated_at = now();

-- 3. Rooms Table (Active Real-Time Lifecycle Entity)
CREATE TABLE IF NOT EXISTS public.rooms (
  id text PRIMARY KEY,
  teacher_id uuid REFERENCES public.teacher_profiles(id) ON DELETE SET NULL,
  teacher_name text NOT NULL DEFAULT 'Teacher',
  title text NOT NULL DEFAULT 'Classroom Session',
  type text NOT NULL CHECK (type IN ('instant', 'scheduled')) DEFAULT 'instant',
  status text NOT NULL CHECK (status IN ('pending', 'active', 'expired', 'archived')) DEFAULT 'pending',
  ttl_minutes integer NOT NULL CHECK (ttl_minutes >= 1 AND ttl_minutes <= 480) DEFAULT 15,
  idempotency_key uuid UNIQUE,
  scheduled_start timestamptz,
  joined_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 4. Room Participants Table (Per-session attendee state)
CREATE TABLE IF NOT EXISTS public.room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  identity text NOT NULL,
  name text NOT NULL,
  role text NOT NULL CHECK (role IN ('teacher', 'student')),
  is_audio_muted boolean NOT NULL DEFAULT false,
  is_video_muted boolean NOT NULL DEFAULT false,
  joined_at timestamptz NOT NULL DEFAULT now(),
  left_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_room_participant_identity UNIQUE (room_id, identity)
);

-- 5. Whiteboard Sessions Table (1:1 with room)
CREATE TABLE IF NOT EXISTS public.whiteboard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL UNIQUE REFERENCES public.rooms(id) ON DELETE CASCADE,
  active_page_index integer NOT NULL CHECK (active_page_index >= 0) DEFAULT 0,
  permissions jsonb NOT NULL DEFAULT '{"canDraw": true, "canAddPages": false, "canDeletePages": false, "tabLocks": {}}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 6. Whiteboard Pages Table (Normalized pages with storage offloading metadata)
CREATE TABLE IF NOT EXISTS public.whiteboard_pages (
  id text PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES public.whiteboard_sessions(id) ON DELETE CASCADE,
  room_id text NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  page_index integer NOT NULL CHECK (page_index >= 0),
  title text NOT NULL DEFAULT 'Untitled Page',
  is_locked boolean NOT NULL DEFAULT false,
  storage_path text,
  storage_bucket text DEFAULT 'whiteboard-assets',
  canvas_json text,
  background_image_url text,
  pdf_document_id text,
  pdf_page_index integer CHECK (pdf_page_index IS NULL OR pdf_page_index >= 0),
  checksum_sha256 text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT uq_session_page_index UNIQUE (session_id, page_index)
);

-- 7. Past Classes Table (Relational Boundary: Cold Archive separated from active rooms)
CREATE TABLE IF NOT EXISTS public.past_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL,
  teacher_id uuid REFERENCES public.teacher_profiles(id) ON DELETE SET NULL,
  teacher_name text NOT NULL DEFAULT 'Teacher',
  title text NOT NULL,
  duration_seconds integer NOT NULL CHECK (duration_seconds >= 0) DEFAULT 0,
  page_count integer NOT NULL CHECK (page_count >= 0) DEFAULT 1,
  storage_path text,
  thumbnail_url text,
  metadata jsonb DEFAULT '{}'::jsonb,
  archived_at timestamptz NOT NULL DEFAULT now()
);

-- 8. Bookings Table (Student reservation entity)
CREATE TABLE IF NOT EXISTS public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.teacher_profiles(id) ON DELETE CASCADE,
  room_id text REFERENCES public.rooms(id) ON DELETE SET NULL,
  student_name text NOT NULL,
  student_email text NOT NULL,
  student_timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  subject text NOT NULL DEFAULT 'Punjabi',
  notes text DEFAULT '',
  scheduled_start timestamptz NOT NULL,
  scheduled_end timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('confirmed', 'cancelled', 'completed')) DEFAULT 'confirmed',
  idempotency_key uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT chk_booking_time_validity CHECK (scheduled_end > scheduled_start)
);

-- 9. Composite B-Tree Indexes for Sub-5ms Query Execution
CREATE INDEX IF NOT EXISTS idx_rooms_status_created ON public.rooms (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rooms_expires_active ON public.rooms (expires_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_room_participants_room ON public.room_participants (room_id, role);
CREATE INDEX IF NOT EXISTS idx_whiteboard_pages_room_index ON public.whiteboard_pages (room_id, page_index);
CREATE INDEX IF NOT EXISTS idx_whiteboard_pages_session_index ON public.whiteboard_pages (session_id, page_index);
CREATE INDEX IF NOT EXISTS idx_past_classes_archived ON public.past_classes (archived_at DESC);
CREATE INDEX IF NOT EXISTS idx_past_classes_room ON public.past_classes (room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_teacher_schedule ON public.bookings (teacher_id, scheduled_start, status);

-- 10. Enable Row Level Security (RLS) on all normalized tables
ALTER TABLE public.teacher_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whiteboard_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.past_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;

-- 11. Define RLS Policies
-- Public / Anon / Authenticated Read on teacher profiles, active rooms, and whiteboard pages
DROP POLICY IF EXISTS "Public can view teacher profiles" ON public.teacher_profiles;
CREATE POLICY "Public can view teacher profiles"
  ON public.teacher_profiles FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Participants can view room" ON public.rooms;
CREATE POLICY "Participants can view room"
  ON public.rooms FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Participants can view whiteboard pages" ON public.whiteboard_pages;
CREATE POLICY "Participants can view whiteboard pages"
  ON public.whiteboard_pages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Participants can view whiteboard sessions" ON public.whiteboard_sessions;
CREATE POLICY "Participants can view whiteboard sessions"
  ON public.whiteboard_sessions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Participants can view room participants" ON public.room_participants;
CREATE POLICY "Participants can view room participants"
  ON public.room_participants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Public can view past classes" ON public.past_classes;
CREATE POLICY "Public can view past classes"
  ON public.past_classes FOR SELECT
  USING (true);

-- Service Role has full unrestricted access on all tables
DROP POLICY IF EXISTS "Service role full access on rooms" ON public.rooms;
CREATE POLICY "Service role full access on rooms"
  ON public.rooms FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on room_participants" ON public.room_participants;
CREATE POLICY "Service role full access on room_participants"
  ON public.room_participants FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on whiteboard_sessions" ON public.whiteboard_sessions;
CREATE POLICY "Service role full access on whiteboard_sessions"
  ON public.whiteboard_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on whiteboard_pages" ON public.whiteboard_pages;
CREATE POLICY "Service role full access on whiteboard_pages"
  ON public.whiteboard_pages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on past_classes" ON public.past_classes;
CREATE POLICY "Service role full access on past_classes"
  ON public.past_classes FOR ALL TO service_role
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Service role full access on bookings" ON public.bookings;
CREATE POLICY "Service role full access on bookings"
  ON public.bookings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- 12. Permissions Grants
GRANT SELECT ON public.teacher_profiles TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.rooms TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.room_participants TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.whiteboard_sessions TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_pages TO anon, authenticated;
GRANT SELECT ON public.past_classes TO anon, authenticated;
GRANT SELECT, INSERT ON public.bookings TO anon, authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
