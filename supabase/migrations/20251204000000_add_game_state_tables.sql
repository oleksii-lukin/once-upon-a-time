-- Add deck_id to lobbies for deck selection
ALTER TABLE lobbies ADD COLUMN deck_id uuid REFERENCES decks(id);

-- Create game_sessions table to track active games
CREATE TABLE IF NOT EXISTS game_sessions (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    lobby_id uuid NOT NULL REFERENCES lobbies(id) ON DELETE CASCADE,
    deck_id uuid NOT NULL REFERENCES decks(id),
    current_turn_player_id uuid REFERENCES players(id),
    storyteller_id uuid REFERENCES players(id),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Create player_hands table to track cards in each player's hand
CREATE TABLE IF NOT EXISTS player_hands (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    game_session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES cards(id),
    position integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE(game_session_id, player_id, card_id)
);

-- Create played_cards table to track cards played on the table
CREATE TABLE IF NOT EXISTS played_cards (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    game_session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    player_id uuid NOT NULL REFERENCES players(id),
    card_id uuid NOT NULL REFERENCES cards(id),
    played_at timestamp with time zone DEFAULT now() NOT NULL,
    position integer NOT NULL DEFAULT 0
);

-- Create draw_pile table to track remaining cards in the deck
CREATE TABLE IF NOT EXISTS draw_pile (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    game_session_id uuid NOT NULL REFERENCES game_sessions(id) ON DELETE CASCADE,
    card_id uuid NOT NULL REFERENCES cards(id),
    position integer NOT NULL DEFAULT 0,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

-- Enable RLS
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_hands ENABLE ROW LEVEL SECURITY;
ALTER TABLE played_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_pile ENABLE ROW LEVEL SECURITY;

-- RLS Policies for game_sessions
CREATE POLICY "Anyone can view game sessions" ON game_sessions FOR SELECT USING (true);
CREATE POLICY "System can manage game sessions" ON game_sessions FOR ALL USING (true);

-- RLS Policies for player_hands
CREATE POLICY "Players can view their own hand" ON player_hands 
    FOR SELECT 
    USING (
        player_id IN (
            SELECT id FROM players 
            WHERE (user_id = (auth.jwt() ->> 'sub')) 
               OR (guest_id IS NOT NULL AND guest_id::text = (auth.jwt() ->> 'sub'))
        )
    );
CREATE POLICY "System can manage player hands" ON player_hands FOR ALL USING (true);

-- RLS Policies for played_cards
CREATE POLICY "Anyone can view played cards" ON played_cards FOR SELECT USING (true);
CREATE POLICY "System can manage played cards" ON played_cards FOR ALL USING (true);

-- RLS Policies for draw_pile
CREATE POLICY "Anyone can view draw pile count" ON draw_pile FOR SELECT USING (true);
CREATE POLICY "System can manage draw pile" ON draw_pile FOR ALL USING (true);

-- Add to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE player_hands;
ALTER PUBLICATION supabase_realtime ADD TABLE played_cards;
ALTER PUBLICATION supabase_realtime ADD TABLE draw_pile;

-- Grant permissions
GRANT ALL ON TABLE game_sessions TO anon;
GRANT ALL ON TABLE game_sessions TO authenticated;
GRANT ALL ON TABLE game_sessions TO service_role;

GRANT ALL ON TABLE player_hands TO anon;
GRANT ALL ON TABLE player_hands TO authenticated;
GRANT ALL ON TABLE player_hands TO service_role;

GRANT ALL ON TABLE played_cards TO anon;
GRANT ALL ON TABLE played_cards TO authenticated;
GRANT ALL ON TABLE played_cards TO service_role;

GRANT ALL ON TABLE draw_pile TO anon;
GRANT ALL ON TABLE draw_pile TO authenticated;
GRANT ALL ON TABLE draw_pile TO service_role;
