-- Add status to played_cards
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'played_card_status') THEN
        CREATE TYPE played_card_status AS ENUM ('PENDING', 'CONFIRMED', 'REVERTED');
    END IF;
END $$;

ALTER TABLE played_cards ADD COLUMN IF NOT EXISTS status played_card_status DEFAULT 'PENDING';

-- Update existing cards to CONFIRMED
UPDATE played_cards SET status = 'CONFIRMED' WHERE status IS NULL;

-- Add pending_turn_confirmation to game_sessions to handle turn finalization
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS is_turn_pending_confirmation boolean DEFAULT false;
ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS last_card_played_at timestamp with time zone;
