-- Trigger to sync user_profiles -> players
-- 1. When a player joins (INSERT into players), if they have a profile, use it.
--    If they don't have a profile yet but provided display_name/avatar (from Clerk), create the profile.
CREATE OR REPLACE FUNCTION "public"."handle_new_player_profile_sync"()
    RETURNS TRIGGER
    LANGUAGE "plpgsql"
    SECURITY DEFINER
AS $$
DECLARE
    existing_profile "public"."user_profiles"%ROWTYPE;
BEGIN
    -- Only relevant for authenticated users
    IF NEW.user_id IS NOT NULL THEN
        -- Check if profile exists
        SELECT * INTO existing_profile FROM "public"."user_profiles" WHERE "user_id" = NEW.user_id;

        IF FOUND THEN
            -- Profile exists: Use it to override the player data (Authoritative source)
            -- We keep the roles/status but ensure name/avatar match the profile
            NEW.display_name := existing_profile.display_name;
            NEW.avatar_url := existing_profile.avatar_url;
        ELSE
            -- No profile exists: Auto-create one using the provided data (likely from Clerk)
            -- This ensures future joins use this data and the user has a profile to edit
            INSERT INTO "public"."user_profiles" ("user_id", "display_name", "avatar_url")
            VALUES (NEW.user_id, NEW.display_name, NEW.avatar_url)
            ON CONFLICT ("user_id") DO NOTHING;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."handle_new_player_profile_sync"() OWNER TO "postgres";

CREATE TRIGGER "sync_profile_on_player_join"
    BEFORE INSERT ON "public"."players"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."handle_new_player_profile_sync"();


-- 2. When a user updates their profile (UPDATE user_profiles), update all their active player identities
CREATE OR REPLACE FUNCTION "public"."handle_user_profile_update"()
    RETURNS TRIGGER
    LANGUAGE "plpgsql"
    SECURITY DEFINER
AS $$
BEGIN
    -- Update all player records for this user to match the new profile
    -- This ensures real-time updates in lobbies
    UPDATE "public"."players"
    SET "display_name" = NEW.display_name,
        "avatar_url" = NEW.avatar_url,
        "last_seen_at" = now() -- Optional: touch the record
    WHERE "user_id" = NEW.user_id;
    
    RETURN NEW;
END;
$$;

ALTER FUNCTION "public"."handle_user_profile_update"() OWNER TO "postgres";

CREATE TRIGGER "sync_players_on_profile_update"
    AFTER UPDATE ON "public"."user_profiles"
    FOR EACH ROW
    EXECUTE FUNCTION "public"."handle_user_profile_update"();
