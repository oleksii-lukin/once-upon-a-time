-- Add status and winner_id to game_sessions for game completion tracking
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS status text DEFAULT 'IN_PROGRESS' NOT NULL;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS winner_id uuid REFERENCES players(id);

-- Add comment for status values
COMMENT ON COLUMN game_sessions.status IS 'Status of the game session: IN_PROGRESS, COMPLETED';
