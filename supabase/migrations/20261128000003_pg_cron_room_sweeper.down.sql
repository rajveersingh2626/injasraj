-- Migration Rollback: 20261128000003_pg_cron_room_sweeper.down.sql
-- Description: Teardown pg_cron job and function

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    BEGIN
      PERFORM cron.unschedule('sweep-expired-rooms');
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END IF;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

DROP FUNCTION IF EXISTS public.sweep_expired_rooms();
