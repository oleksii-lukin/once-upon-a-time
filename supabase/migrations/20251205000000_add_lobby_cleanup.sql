-- Migration: Add lobby cleanup system with pg_cron
-- This migration adds:
-- 1. last_seen_at column to players for tracking player activity
-- 2. deleted_at column to lobbies for soft deletion (to preserve played games for replay)
-- 3. Function to mark inactive lobbies as finished (separate from cleanup)
-- 4. Function to soft-delete finished lobbies (preserves game data for replay feature)
-- 5. Function to hard-delete abandoned waiting lobbies (never started games)
-- 6. pg_cron scheduled jobs to run cleanup functions periodically

-- Step 1: Add last_seen_at column to players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Step 2: Add deleted_at column to lobbies for soft deletion
-- Lobbies with deleted_at set will not appear in active lobby lists
-- but will be available for game replay/review features
ALTER TABLE public.lobbies
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_players_last_seen_at ON public.players(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_players_lobby_id_last_seen ON public.players(lobby_id, last_seen_at);
CREATE INDEX IF NOT EXISTS idx_lobbies_deleted_at ON public.lobbies(deleted_at);
CREATE INDEX IF NOT EXISTS idx_lobbies_status_deleted ON public.lobbies(status, deleted_at);

-- Step 3: Function to mark lobbies as finished based on player inactivity
-- This is SEPARATE from the cleanup/deletion logic as requested
-- A lobby is marked finished if ALL players have been inactive for more than 5 minutes
CREATE OR REPLACE FUNCTION public.mark_inactive_lobbies_finished()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Only mark 'playing' lobbies as finished
  -- A lobby is considered inactive if it has no players with recent activity
  UPDATE public.lobbies l
  SET status = 'finished'
  WHERE l.status = 'playing'
  AND l.deleted_at IS NULL  -- Only process non-deleted lobbies
  AND NOT EXISTS (
    SELECT 1 FROM public.players p 
    WHERE p.lobby_id = l.id 
    AND p.last_seen_at > NOW() - INTERVAL '5 minutes'
  );
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  IF affected_count > 0 THEN
    RAISE NOTICE 'Marked % lobbies as finished due to inactivity', affected_count;
  END IF;
END;
$$;

-- Step 4: Function to SOFT-DELETE finished lobbies
-- Uses soft delete (sets deleted_at) to preserve game data for future replay feature
-- These lobbies won't appear in active lobby list but can be shown in "finished games" list
CREATE OR REPLACE FUNCTION public.archive_finished_lobbies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Soft-delete lobbies that have been marked as finished
  -- This preserves the lobby and all associated game data (sessions, cards, etc.)
  UPDATE public.lobbies
  SET deleted_at = NOW()
  WHERE status = 'finished'
  AND deleted_at IS NULL;
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  IF affected_count > 0 THEN
    RAISE NOTICE 'Archived % finished lobbies (soft delete)', affected_count;
  END IF;
END;
$$;

-- Step 5: Function to HARD-DELETE abandoned 'waiting' lobbies
-- These are lobbies where the host abandoned before starting the game
-- Since no game was played, there's no data worth preserving
CREATE OR REPLACE FUNCTION public.cleanup_abandoned_waiting_lobbies()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  affected_count INTEGER;
BEGIN
  -- Hard-delete 'waiting' lobbies older than 2 hours with no recent player activity
  -- These never had a game start, so no need to preserve them
  DELETE FROM public.lobbies l
  WHERE l.status = 'waiting'
  AND l.deleted_at IS NULL
  AND l.created_at < NOW() - INTERVAL '2 hours'
  AND NOT EXISTS (
    SELECT 1 FROM public.players p 
    WHERE p.lobby_id = l.id 
    AND p.last_seen_at > NOW() - INTERVAL '30 minutes'
  );
  
  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  IF affected_count > 0 THEN
    RAISE NOTICE 'Permanently deleted % abandoned waiting lobbies', affected_count;
  END IF;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.mark_inactive_lobbies_finished() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.archive_finished_lobbies() TO postgres, service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_abandoned_waiting_lobbies() TO postgres, service_role;

-- Step 6: Schedule pg_cron jobs
-- Note: pg_cron extension must be enabled in Supabase dashboard under Database > Extensions

-- Schedule job to mark inactive lobbies as finished (every 2 minutes)
SELECT cron.schedule(
  'mark-inactive-lobbies-finished',
  '*/2 * * * *',
  $$SELECT public.mark_inactive_lobbies_finished()$$
);

-- Schedule job to archive (soft-delete) finished lobbies (every 10 minutes)
SELECT cron.schedule(
  'archive-finished-lobbies',
  '*/10 * * * *',
  $$SELECT public.archive_finished_lobbies()$$
);

-- Schedule job to cleanup abandoned waiting lobbies (every hour)
-- These are hard-deleted since no game was ever played
SELECT cron.schedule(
  'cleanup-abandoned-waiting-lobbies',
  '0 * * * *',
  $$SELECT public.cleanup_abandoned_waiting_lobbies()$$
);

-- Add comments for documentation
COMMENT ON COLUMN public.lobbies.deleted_at IS 
'Soft delete timestamp. NULL means active, non-NULL means archived/deleted. Used to preserve game data for replay feature.';

COMMENT ON FUNCTION public.mark_inactive_lobbies_finished() IS 
'Marks lobbies as finished when all players have been inactive for 5+ minutes. Runs every 2 minutes via pg_cron.';

COMMENT ON FUNCTION public.archive_finished_lobbies() IS 
'Soft-deletes finished lobbies (sets deleted_at) to preserve game data for replay. Runs every 10 minutes via pg_cron.';

COMMENT ON FUNCTION public.cleanup_abandoned_waiting_lobbies() IS 
'Hard-deletes waiting lobbies older than 2 hours with no recent player activity. These never had games, so no data to preserve. Runs hourly via pg_cron.';
