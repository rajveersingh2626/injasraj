-- Migration Rollback: 20261128000002_rearchitect_normalized_schema.down.sql
-- Description: Reversible teardown of normalized tables and indexes in strict reverse dependency order

-- 1. Drop Indexes
DROP INDEX IF EXISTS public.idx_bookings_teacher_schedule;
DROP INDEX IF EXISTS public.idx_past_classes_room;
DROP INDEX IF EXISTS public.idx_past_classes_archived;
DROP INDEX IF EXISTS public.idx_whiteboard_pages_session_index;
DROP INDEX IF EXISTS public.idx_whiteboard_pages_room_index;
DROP INDEX IF EXISTS public.idx_room_participants_room;
DROP INDEX IF EXISTS public.idx_rooms_expires_active;
DROP INDEX IF EXISTS public.idx_rooms_status_created;

-- 2. Drop RLS Policies
DROP POLICY IF EXISTS "Public can view teacher profiles" ON public.teacher_profiles;
DROP POLICY IF EXISTS "Participants can view room" ON public.rooms;
DROP POLICY IF EXISTS "Participants can view whiteboard pages" ON public.whiteboard_pages;
DROP POLICY IF EXISTS "Participants can view whiteboard sessions" ON public.whiteboard_sessions;
DROP POLICY IF EXISTS "Participants can view room participants" ON public.room_participants;
DROP POLICY IF EXISTS "Public can view past classes" ON public.past_classes;

DROP POLICY IF EXISTS "Service role full access on rooms" ON public.rooms;
DROP POLICY IF EXISTS "Service role full access on room_participants" ON public.room_participants;
DROP POLICY IF EXISTS "Service role full access on whiteboard_sessions" ON public.whiteboard_sessions;
DROP POLICY IF EXISTS "Service role full access on whiteboard_pages" ON public.whiteboard_pages;
DROP POLICY IF EXISTS "Service role full access on past_classes" ON public.past_classes;
DROP POLICY IF EXISTS "Service role full access on bookings" ON public.bookings;

-- 3. Drop Tables in reverse foreign key order
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.past_classes CASCADE;
DROP TABLE IF EXISTS public.whiteboard_pages CASCADE;
DROP TABLE IF EXISTS public.whiteboard_sessions CASCADE;
DROP TABLE IF EXISTS public.room_participants CASCADE;
DROP TABLE IF EXISTS public.rooms CASCADE;
DROP TABLE IF EXISTS public.teacher_profiles CASCADE;
