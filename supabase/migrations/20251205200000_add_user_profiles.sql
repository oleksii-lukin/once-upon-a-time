-- Create user_profiles table to store customizable user profile data and cached stats
CREATE TABLE IF NOT EXISTS "public"."user_profiles" (
    "user_id" TEXT NOT NULL,
    "display_name" TEXT,
    "bio" TEXT,
    "avatar_url" TEXT,
    "total_games_played" INTEGER DEFAULT 0,
    "total_games_won" INTEGER DEFAULT 0,
    "created_at" TIMESTAMP WITH TIME ZONE DEFAULT "now"() NOT NULL,
    "updated_at" TIMESTAMP WITH TIME ZONE DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "public"."user_profiles" OWNER TO "postgres";

-- RLS Policies
ALTER TABLE "public"."user_profiles" ENABLE ROW LEVEL SECURITY;

-- Anyone can view profiles
CREATE POLICY "Anyone can view user profiles" ON "public"."user_profiles" 
    FOR SELECT USING (true);

-- Users can insert their own profile
CREATE POLICY "Users can create their own profile" ON "public"."user_profiles" 
    FOR INSERT WITH CHECK (("auth"."jwt"() ->> 'sub'::text) = "user_id");

-- Users can update their own profile
CREATE POLICY "Users can update their own profile" ON "public"."user_profiles" 
    FOR UPDATE USING (("auth"."jwt"() ->> 'sub'::text) = "user_id");

-- Grant permissions
GRANT ALL ON TABLE "public"."user_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_profiles" TO "service_role";

-- Add to realtime
ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."user_profiles";

-- Create function to update user stats when a game finishes
-- This will be triggered when a lobby status changes to 'finished'
CREATE OR REPLACE FUNCTION "public"."update_user_game_stats"()
    RETURNS TRIGGER
    LANGUAGE "plpgsql"
    SECURITY DEFINER
AS $$
DECLARE
    player_record RECORD;
    winner_id TEXT;
BEGIN
    -- Only trigger when status changes to 'finished'
    IF NEW.status = 'finished' AND OLD.status != 'finished' THEN
        -- For now, we don't track winners (could be extended later)
        -- Just increment games_played for all players
        FOR player_record IN 
            SELECT user_id, guest_id FROM players WHERE lobby_id = NEW.id
        LOOP
            IF player_record.user_id IS NOT NULL THEN
                INSERT INTO user_profiles (user_id, total_games_played)
                VALUES (player_record.user_id, 1)
                ON CONFLICT (user_id) DO UPDATE
                SET total_games_played = user_profiles.total_games_played + 1,
                    updated_at = now();
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."update_user_game_stats"() OWNER TO "postgres";

-- Create trigger
CREATE OR REPLACE TRIGGER "update_user_stats_on_game_finish"
    AFTER UPDATE ON "public"."lobbies"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."update_user_game_stats"();
