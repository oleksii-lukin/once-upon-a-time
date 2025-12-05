-- Backfill existing players with profile data
-- This is needed for players who joined lobbies before the sync triggers were active

UPDATE "public"."players" p
SET
    "display_name" = up."display_name",
    "avatar_url" = up."avatar_url"
FROM "public"."user_profiles" up
WHERE p."user_id" = up."user_id"
  AND (p."display_name" != up."display_name" OR p."avatar_url" IS DISTINCT FROM up."avatar_url");
