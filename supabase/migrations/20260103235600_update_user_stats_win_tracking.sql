-- Update the trigger function to handle winners and be case-insensitive for lobby status
CREATE OR REPLACE FUNCTION "public"."update_user_game_stats"()
    RETURNS TRIGGER
    LANGUAGE "plpgsql"
    SECURITY DEFINER
AS $$
DECLARE
    player_record RECORD;
    winner_user_id TEXT;
BEGIN
    -- Only trigger when status changes to 'finished' (case-insensitive)
    IF (LOWER(NEW.status) = 'finished' AND LOWER(COALESCE(OLD.status, '')) != 'finished') THEN
        -- Identify winner's user_id from the latest game session for this lobby
        SELECT p.user_id INTO winner_user_id
        FROM game_sessions gs
        JOIN players p ON gs.winner_id = p.id
        WHERE gs.lobby_id = NEW.id
        ORDER BY gs.created_at DESC
        LIMIT 1;

        FOR player_record IN 
            SELECT DISTINCT user_id FROM players WHERE lobby_id = NEW.id AND user_id IS NOT NULL
        LOOP
            INSERT INTO user_profiles (user_id, total_games_played, total_games_won)
            VALUES (
                player_record.user_id, 
                1, 
                CASE WHEN player_record.user_id = winner_user_id THEN 1 ELSE 0 END
            )
            ON CONFLICT (user_id) DO UPDATE
            SET total_games_played = user_profiles.total_games_played + 1,
                total_games_won = user_profiles.total_games_won + (CASE WHEN player_record.user_id = winner_user_id THEN 1 ELSE 0 END),
                updated_at = now();
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;
