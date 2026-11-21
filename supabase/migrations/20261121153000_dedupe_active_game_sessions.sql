-- One active game session per lobby.
--
-- Repeated "Start game" clicks used to create a new game_sessions row every
-- time (initializeGame had no dedup), which poisoned later single-row reads.
-- Keep only the newest non-COMPLETED session per lobby, then enforce it.

DELETE FROM public.game_sessions gs
USING public.game_sessions keep
WHERE gs.lobby_id = keep.lobby_id
  AND gs.status <> 'COMPLETED'
  AND keep.status <> 'COMPLETED'
  AND gs.created_at < keep.created_at;

CREATE UNIQUE INDEX IF NOT EXISTS game_sessions_active_lobby_uidx
  ON public.game_sessions (lobby_id)
  WHERE status <> 'COMPLETED';

COMMENT ON INDEX public.game_sessions_active_lobby_uidx IS
'At most one active (non-COMPLETED) game session per lobby; makes initializeGame idempotent.';
