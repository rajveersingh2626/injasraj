-- Migration: 20261126000002_whiteboard_persistence_and_status.sql
-- Description: Add session_status column to whiteboard_sessions and grant permissions

ALTER TABLE public.whiteboard_sessions 
  ADD COLUMN IF NOT EXISTS session_status text NOT NULL DEFAULT 'waiting' 
  CHECK (session_status IN ('waiting', 'in_progress', 'completed'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whiteboard_sessions TO anon, authenticated, service_role;
