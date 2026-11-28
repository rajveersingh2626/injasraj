-- Migration: 20261128000003_pg_cron_room_sweeper.sql
-- Description: Enable pg_cron inside Supabase Postgres for native 5-minute room sweeps (bypassing Vercel Hobby limits)

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Dedicated server-side function to archive expired rooms
CREATE OR REPLACE FUNCTION public.sweep_expired_rooms()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_archived_count integer;
BEGIN
  UPDATE public.rooms
  SET status = 'archived', updated_at = now()
  WHERE status = 'active'
    AND expires_at IS NOT NULL
    AND expires_at <= now();

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;
  RETURN v_archived_count;
END;
$$;

-- Grant execution to postgres and service_role
GRANT EXECUTE ON FUNCTION public.sweep_expired_rooms() TO postgres, service_role;

-- Schedule 5-minute sweep job in pg_cron
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('sweep-expired-rooms');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    PERFORM cron.schedule(
      'sweep-expired-rooms',
      '*/5 * * * *',
      'SELECT public.sweep_expired_rooms();'
    );
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
