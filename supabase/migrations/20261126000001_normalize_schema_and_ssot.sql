-- Migration: 20261126000001_normalize_schema_and_ssot.sql
-- Description: Normalize profiles, lessons, and availability to act as Single Source of Truth on Supabase

-- 1. Decouple profiles from auth.users to support both platform passcode & auth users
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_id_fkey;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- 2. Seed canonical teacher profile for Inderjit Kaur
INSERT INTO public.profiles (id, role, full_name, timezone)
VALUES ('00000000-0000-0000-0000-000000000001', 'teacher', 'Inderjit Kaur', 'Asia/Kolkata')
ON CONFLICT (id) DO UPDATE 
SET full_name = 'Inderjit Kaur', role = 'teacher';

-- 3. Enhance public.lessons to be the single SSOT for active rooms, scheduled classes, and history
ALTER TABLE public.lessons 
  ADD COLUMN IF NOT EXISTS room_type text NOT NULL CHECK (room_type IN ('instant', 'scheduled')) DEFAULT 'instant',
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '1:1 Classroom Session',
  ADD COLUMN IF NOT EXISTS joined_at timestamptz,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz;

ALTER TABLE public.lessons 
  ALTER COLUMN student_name SET DEFAULT 'Student',
  ALTER COLUMN student_email SET DEFAULT '',
  ALTER COLUMN start_time_utc SET DEFAULT now(),
  ALTER COLUMN end_time_utc SET DEFAULT (now() + interval '1 hour');

-- 4. Ensure teacher_availability has a clean unique constraint for atomic upserts
ALTER TABLE public.teacher_availability 
  DROP CONSTRAINT IF EXISTS teacher_availability_teacher_day_key;
ALTER TABLE public.teacher_availability 
  ADD CONSTRAINT teacher_availability_teacher_day_key UNIQUE (teacher_id, day_of_week);

-- 5. RLS policies and grants allowing authenticated & anon classroom operations
ALTER TABLE public.teacher_availability DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons DISABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teacher_availability TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.lessons TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_sessions TO anon, authenticated, service_role;
