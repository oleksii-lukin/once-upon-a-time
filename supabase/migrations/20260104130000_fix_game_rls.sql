-- Ensure RLS allows playing cards and managing hands during the game
DO $$ 
BEGIN 
    -- played_cards policies
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can insert played cards') THEN
        CREATE POLICY "Anyone can insert played cards" ON played_cards FOR INSERT WITH CHECK (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update played cards') THEN
        CREATE POLICY "Anyone can update played cards" ON played_cards FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can delete played cards') THEN
        CREATE POLICY "Anyone can delete played cards" ON played_cards FOR DELETE USING (true);
    END IF;

    -- player_hands policies for management during game
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can update player hands') THEN
        CREATE POLICY "Anyone can update player hands" ON player_hands FOR UPDATE USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can delete player hands') THEN
        CREATE POLICY "Anyone can delete player hands" ON player_hands FOR DELETE USING (true);
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Anyone can insert player hands') THEN
        CREATE POLICY "Anyone can insert player hands" ON player_hands FOR INSERT WITH CHECK (true);
    END IF;

END $$;
