-- Migration: 20261121000000_init_schema.sql
-- Description: Core schema for International Classroom platform (profiles, teacher_availability, lessons)
-- Includes full DDL, constraints, indexes, and Row Level Security (RLS) policies.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. PROFILES TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL CHECK (role IN ('teacher', 'student')),
  full_name text NOT NULL,
  timezone text NOT NULL DEFAULT 'Asia/Kolkata',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. TEACHER AVAILABILITY TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.teacher_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  slot_duration_minutes int NOT NULL DEFAULT 60
);

-- ============================================================================
-- 3. LESSONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL UNIQUE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  student_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  teacher_availability_id uuid REFERENCES public.teacher_availability(id) ON DELETE SET NULL,
  student_name text NOT NULL,
  student_email text NOT NULL,
  start_time_utc timestamptz NOT NULL,
  end_time_utc timestamptz NOT NULL,
  status text NOT NULL CHECK (status IN ('scheduled', 'live', 'completed', 'cancelled')) DEFAULT 'scheduled',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 4. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_lessons_room_id 
  ON public.lessons (room_id);

CREATE INDEX IF NOT EXISTS idx_lessons_teacher_start 
  ON public.lessons (teacher_id, start_time_utc);

CREATE INDEX IF NOT EXISTS idx_teacher_availability_teacher_day 
  ON public.teacher_availability (teacher_id, day_of_week);

-- Unique index to prevent concurrent double-booking of non-cancelled lessons for a teacher
CREATE UNIQUE INDEX IF NOT EXISTS idx_lessons_prevent_double_booking 
  ON public.lessons (teacher_id, start_time_utc) 
  WHERE status != 'cancelled';

-- ============================================================================
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teacher_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lessons ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- PROFILES POLICIES
-- Users can read any profile, update own profile
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can read profiles"
  ON public.profiles
  FOR SELECT
  USING (true);

CREATE POLICY "Users can insert own profile"
  ON public.profiles
  FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ----------------------------------------------------------------------------
-- TEACHER AVAILABILITY POLICIES
-- Anyone can read teacher availability; only the teacher can insert/update/delete their own availability
-- ----------------------------------------------------------------------------
CREATE POLICY "Anyone can read teacher availability"
  ON public.teacher_availability
  FOR SELECT
  USING (true);

CREATE POLICY "Teachers can insert own availability"
  ON public.teacher_availability
  FOR INSERT
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can update own availability"
  ON public.teacher_availability
  FOR UPDATE
  USING (auth.uid() = teacher_id)
  WITH CHECK (auth.uid() = teacher_id);

CREATE POLICY "Teachers can delete own availability"
  ON public.teacher_availability
  FOR DELETE
  USING (auth.uid() = teacher_id);

-- ----------------------------------------------------------------------------
-- LESSONS POLICIES
-- Teacher can read and manage their lessons; anyone can insert a lesson (booking);
-- student can read their booked lesson by room_id
-- ----------------------------------------------------------------------------
CREATE POLICY "Teachers can read their lessons"
  ON public.lessons
  FOR SELECT
  USING (auth.uid() = teacher_id);

CREATE POLICY "Teachers can manage their lessons"
  ON public.lessons
  FOR ALL
  USING (auth.uid() = teacher_id);

CREATE POLICY "Anyone can insert lessons"
  ON public.lessons
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Students can read booked lesson by room_id"
  ON public.lessons
  FOR SELECT
  USING (
    auth.uid() = student_id
    OR EXISTS (
      SELECT 1 FROM public.teacher_availability ta
      WHERE ta.id = teacher_availability_id AND ta.teacher_id = auth.uid()
    )
    OR (auth.uid() IS NULL AND room_id = current_setting('request.headers', true)::json->>'x-room-id')
  );
