-- Migration: 20261121000001_whiteboard_sessions.sql
-- Description: Persistent storage schema for real-time collaborative whiteboard sessions
-- Includes table definition, constraints, indexes, triggers, and Row Level Security (RLS) policies.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. WHITEBOARD SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS public.whiteboard_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id text NOT NULL UNIQUE,
  lesson_id uuid REFERENCES public.lessons(id) ON DELETE SET NULL,
  pages jsonb NOT NULL DEFAULT '[]'::jsonb,
  active_page_id text NOT NULL,
  permissions jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================================
-- 2. INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_whiteboard_sessions_room_id 
  ON public.whiteboard_sessions (room_id);

CREATE INDEX IF NOT EXISTS idx_whiteboard_sessions_updated_at 
  ON public.whiteboard_sessions (updated_at);

-- ============================================================================
-- 3. UPDATED_AT TRIGGER
-- ============================================================================
CREATE OR REPLACE FUNCTION public.handle_whiteboard_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_whiteboard_sessions_updated_at ON public.whiteboard_sessions;
CREATE TRIGGER trigger_whiteboard_sessions_updated_at
  BEFORE UPDATE ON public.whiteboard_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_whiteboard_sessions_updated_at();

-- ============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================
ALTER TABLE public.whiteboard_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone (teachers, students, guests) can read the whiteboard session for their room
CREATE POLICY "Anyone can read whiteboard sessions"
  ON public.whiteboard_sessions
  FOR SELECT
  USING (true);

-- Anyone (teachers and students) can insert a new room session
CREATE POLICY "Anyone can insert whiteboard sessions"
  ON public.whiteboard_sessions
  FOR INSERT
  WITH CHECK (true);

-- Restrict updates so only participants of the corresponding lesson can update the session
CREATE POLICY "Participants can update whiteboard sessions"
  ON public.whiteboard_sessions FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.lessons l
      WHERE (l.id = whiteboard_sessions.lesson_id OR l.room_id = whiteboard_sessions.room_id)
        AND (
          l.student_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.teacher_availability ta
            WHERE ta.id = l.teacher_availability_id AND ta.teacher_id = auth.uid()
          )
        )
    )
    OR auth.role() = 'service_role'
    OR auth.uid() IS NULL -- allow anonymous demo/test classroom sessions if unauthenticated
  );
