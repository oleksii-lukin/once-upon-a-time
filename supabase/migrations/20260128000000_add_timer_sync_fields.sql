-- Add timer synchronization fields to game_sessions table
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS timer_enabled boolean DEFAULT false NOT NULL;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS timer_duration integer DEFAULT 30 NOT NULL; -- seconds
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS timer_started_at timestamp with time zone; -- when current turn timer started
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS timer_expires_at timestamp with time zone; -- when current turn timer expires

-- Add comments for timer fields
COMMENT ON COLUMN game_sessions.timer_enabled IS 'Whether turn timer is enabled for this game';
COMMENT ON COLUMN game_sessions.timer_duration IS 'Duration of each turn in seconds when timer is enabled';
COMMENT ON COLUMN game_sessions.timer_started_at IS 'Timestamp when current turn timer started';
COMMENT ON COLUMN game_sessions.timer_expires_at IS 'Timestamp when current turn timer expires';
