-- Phase 2: close the guest write path.
--
-- Guests have no JWT, so their identity used to be whatever the client
-- claimed (guestId from a cookie) and every game/lobby table was writable
-- by anyone (USING/WITH CHECK true). Server actions are now the only write
-- path: they run with the service role and verify the caller against
-- players.guest_secret_hash (a server-issued secret cookie only the
-- holder's browser has) or, for Clerk users, the session's user id.
--
-- All public SELECT policies are kept: lobby lists, board state, hand
-- counts and the lobby/game realtime changefeeds depend on them.

ALTER TABLE "public"."players" ADD COLUMN "guest_secret_hash" "text";

-- Public hand-count display (replaces the previously-world-readable
-- player_hands rows: counts without card contents). Ending cards are
-- excluded, matching the UI's previous count query.
CREATE VIEW "public"."v_player_hand_counts" AS
    SELECT ph.game_session_id,
           ph.player_id,
           count(*)::integer AS card_count
      FROM "public"."player_hands" ph
      JOIN "public"."cards" c ON c.id = ph.card_id
     WHERE c.type IS DISTINCT FROM 'ending'
     GROUP BY ph.game_session_id, ph.player_id;

GRANT SELECT ON "public"."v_player_hand_counts" TO anon, authenticated, service_role;

-- players: joins and status/role changes go through server actions now.
DROP POLICY IF EXISTS "Anyone can join lobbies" ON "public"."players";
DROP POLICY IF EXISTS "Users can join lobbies" ON "public"."players";
DROP POLICY IF EXISTS "Anyone can update player status" ON "public"."players";

-- lobbies: creation and lifecycle go through server actions now.
DROP POLICY IF EXISTS "Anyone can create lobbies" ON "public"."lobbies";
DROP POLICY IF EXISTS "Users can create lobbies" ON "public"."lobbies";
DROP POLICY IF EXISTS "Anyone can update lobbies" ON "public"."lobbies";
DROP POLICY IF EXISTS "Lobby creators can update their lobbies" ON "public"."lobbies";

-- game state: all writes are performed by server actions (service role).
DROP POLICY IF EXISTS "System can manage game sessions" ON "public"."game_sessions";

-- player_hands: the "System can manage" ALL policy also granted public
-- SELECT — dropping it makes "Players can view their own hand" (kept
-- below) actually effective; guests read their hand via the getMyHand
-- action and everyone reads counts via v_player_hand_counts.
DROP POLICY IF EXISTS "System can manage player hands" ON "public"."player_hands";
DROP POLICY IF EXISTS "Anyone can insert player hands" ON "public"."player_hands";
DROP POLICY IF EXISTS "Anyone can update player hands" ON "public"."player_hands";
DROP POLICY IF EXISTS "Anyone can delete player hands" ON "public"."player_hands";

DROP POLICY IF EXISTS "System can manage played cards" ON "public"."played_cards";
DROP POLICY IF EXISTS "Anyone can insert played cards" ON "public"."played_cards";
DROP POLICY IF EXISTS "Anyone can update played cards" ON "public"."played_cards";
DROP POLICY IF EXISTS "Anyone can delete played cards" ON "public"."played_cards";

DROP POLICY IF EXISTS "System can manage draw pile" ON "public"."draw_pile";

-- NOTE: existing guest player rows keep guest_secret_hash = NULL and can
-- no longer act (their secret was never known to the server). Guests must
-- rejoin from a fresh browser session; Clerk users are unaffected.
