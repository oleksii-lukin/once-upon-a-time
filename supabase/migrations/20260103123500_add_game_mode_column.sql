-- Add game_mode column to lobbies and game_sessions
ALTER TABLE lobbies ADD COLUMN IF NOT EXISTS game_mode text DEFAULT 'main';
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS game_mode text;

-- Backfill game_mode from settings JSONB if possible
UPDATE lobbies 
SET game_mode = COALESCE(settings->>'gameMode', 'main')
WHERE game_mode IS NULL OR game_mode = 'main';
