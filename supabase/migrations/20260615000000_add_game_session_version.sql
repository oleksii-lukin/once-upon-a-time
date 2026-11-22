-- Add version counter to game_sessions for optimistic concurrency control
-- Every UPDATE to game_sessions automatically increments version via a BEFORE trigger.
-- Changes to child tables (played_cards, player_hands, draw_pile) also propagate
-- to game_sessions to bump version, ensuring the client can detect any state change.

ALTER TABLE game_sessions ADD COLUMN IF NOT EXISTS version integer NOT NULL DEFAULT 1;

-- BEFORE UPDATE trigger on game_sessions: bump version on every change
CREATE OR REPLACE FUNCTION bump_game_session_version()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  NEW.version = OLD.version + 1;
  RETURN NEW;
END;
$$;

CREATE TRIGGER bump_game_session_version_trigger
  BEFORE UPDATE ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION bump_game_session_version();

-- AFTER trigger on child tables: touch game_sessions to fire the version bump
CREATE OR REPLACE FUNCTION notify_game_session_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE game_sessions SET updated_at = now()
  WHERE id = COALESCE(NEW.game_session_id, OLD.game_session_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- played_cards triggers
CREATE TRIGGER notify_game_session_on_played_cards_insert
  AFTER INSERT ON played_cards
  FOR EACH ROW EXECUTE FUNCTION notify_game_session_change();

CREATE TRIGGER notify_game_session_on_played_cards_update
  AFTER UPDATE ON played_cards
  FOR EACH ROW EXECUTE FUNCTION notify_game_session_change();

CREATE TRIGGER notify_game_session_on_played_cards_delete
  AFTER DELETE ON played_cards
  FOR EACH ROW EXECUTE FUNCTION notify_game_session_change();

-- player_hands triggers
CREATE TRIGGER notify_game_session_on_player_hands_insert
  AFTER INSERT ON player_hands
  FOR EACH ROW EXECUTE FUNCTION notify_game_session_change();

CREATE TRIGGER notify_game_session_on_player_hands_update
  AFTER UPDATE ON player_hands
  FOR EACH ROW EXECUTE FUNCTION notify_game_session_change();

CREATE TRIGGER notify_game_session_on_player_hands_delete
  AFTER DELETE ON player_hands
  FOR EACH ROW EXECUTE FUNCTION notify_game_session_change();

-- draw_pile triggers
CREATE TRIGGER notify_game_session_on_draw_pile_insert
  AFTER INSERT ON draw_pile
  FOR EACH ROW EXECUTE FUNCTION notify_game_session_change();

CREATE TRIGGER notify_game_session_on_draw_pile_update
  AFTER UPDATE ON draw_pile
  FOR EACH ROW EXECUTE FUNCTION notify_game_session_change();

CREATE TRIGGER notify_game_session_on_draw_pile_delete
  AFTER DELETE ON draw_pile
  FOR EACH ROW EXECUTE FUNCTION notify_game_session_change()
