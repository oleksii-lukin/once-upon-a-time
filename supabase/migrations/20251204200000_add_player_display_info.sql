-- Add display_name and avatar_url to players table
-- These columns store the player's display info at join time
-- So other players can see their name/avatar without needing their Clerk session

ALTER TABLE players ADD COLUMN IF NOT EXISTS display_name text;
ALTER TABLE players ADD COLUMN IF NOT EXISTS avatar_url text;
