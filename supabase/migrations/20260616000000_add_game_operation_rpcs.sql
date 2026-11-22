-- RPCs for atomic multi-table game operations with version-based OCC.
-- Each RPC locks the game_sessions row, checks expected version, performs
-- all writes in a single transaction, and lets the BEFORE UPDATE trigger
-- bump the version via child-table AFTER triggers.

-- 1. handle_play_card: INSERT played_cards + DELETE player_hands
CREATE OR REPLACE FUNCTION handle_play_card(
  _game_session_id uuid,
  _player_id uuid,
  _card_id uuid,
  _position integer,
  _expected_version integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _current_version integer;
  _played_card_id uuid;
  _result jsonb;
BEGIN
  SELECT version INTO _current_version
  FROM game_sessions
  WHERE id = _game_session_id
  FOR UPDATE;

  IF _current_version IS NULL THEN
    RAISE EXCEPTION 'GAME_SESSION_NOT_FOUND: %', _game_session_id;
  END IF;

  IF _current_version != _expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT: expected %, got %', _expected_version, _current_version;
  END IF;

  INSERT INTO played_cards (game_session_id, player_id, card_id, position, status)
  VALUES (_game_session_id, _player_id, _card_id, _position, 'PENDING')
  RETURNING id INTO _played_card_id;

  DELETE FROM player_hands
  WHERE game_session_id = _game_session_id
    AND player_id = _player_id
    AND card_id = _card_id;

  SELECT jsonb_build_object(
    'id', pc.id,
    'game_session_id', pc.game_session_id,
    'player_id', pc.player_id,
    'card_id', pc.card_id,
    'position', pc.position,
    'status', pc.status,
    'played_at', pc.played_at,
    'created_at', pc.played_at,
    'cards', to_jsonb(c.*)
  ) INTO _result
  FROM played_cards pc
  JOIN cards c ON c.id = pc.card_id
  WHERE pc.id = _played_card_id;

  RETURN _result;
END;
$$;

-- 2. handle_draw_cards: SELECT draw_pile + INSERT player_hands + DELETE draw_pile
CREATE OR REPLACE FUNCTION handle_draw_cards(
  _game_session_id uuid,
  _player_id uuid,
  _count integer,
  _expected_version integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _current_version integer;
  _draw_cards bigint[];
  _i integer;
BEGIN
  SELECT version INTO _current_version
  FROM game_sessions
  WHERE id = _game_session_id
  FOR UPDATE;

  IF _current_version IS NULL THEN
    RAISE EXCEPTION 'GAME_SESSION_NOT_FOUND: %', _game_session_id;
  END IF;

  IF _current_version != _expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT: expected %, got %', _expected_version, _current_version;
  END IF;

  -- Collect draw_pile ids to process
  SELECT array_agg(dp.id ORDER BY dp.position)
  INTO _draw_cards
  FROM draw_pile dp
  WHERE dp.game_session_id = _game_session_id;

  IF _draw_cards IS NULL OR array_length(_draw_cards, 1) IS NULL THEN
    RAISE EXCEPTION 'No cards in draw pile';
  END IF;

  IF array_length(_draw_cards, 1) < _count THEN
    RAISE EXCEPTION 'Not enough cards in draw pile: need %, have %', _count, array_length(_draw_cards, 1);
  END IF;

  -- Insert top N cards into player's hand
  FOR _i IN 1 .. _count LOOP
    INSERT INTO player_hands (game_session_id, player_id, card_id, position)
    SELECT _game_session_id, _player_id, dp.card_id, 999 + _i - 1
    FROM draw_pile dp
    WHERE dp.id = _draw_cards[_i];
  END LOOP;

  -- Remove drawn cards from draw pile
  DELETE FROM draw_pile dp
  WHERE dp.id = ANY(_draw_cards[1:_count]);

  RETURN true;
END;
$$;

-- 3. handle_exchange_card: DELETE player_hands + SELECT draw_pile + INSERT player_hands + DELETE draw_pile
CREATE OR REPLACE FUNCTION handle_exchange_card(
  _game_session_id uuid,
  _player_id uuid,
  _card_id uuid,
  _is_ending boolean,
  _expected_version integer
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _current_version integer;
  _draw_id uuid;
  _new_card_id uuid;
BEGIN
  SELECT version INTO _current_version
  FROM game_sessions
  WHERE id = _game_session_id
  FOR UPDATE;

  IF _current_version IS NULL THEN
    RAISE EXCEPTION 'GAME_SESSION_NOT_FOUND: %', _game_session_id;
  END IF;

  IF _current_version != _expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT: expected %, got %', _expected_version, _current_version;
  END IF;

  -- Find matching card from draw pile
  SELECT dp.id, dp.card_id INTO _draw_id, _new_card_id
  FROM draw_pile dp
  JOIN cards c ON c.id = dp.card_id
  WHERE dp.game_session_id = _game_session_id
    AND CASE WHEN _is_ending THEN c.category = 'ending' ELSE c.category IS DISTINCT FROM 'ending' END
  ORDER BY dp.position
  LIMIT 1
  FOR UPDATE OF dp;

  IF _draw_id IS NULL THEN
    RAISE EXCEPTION 'No matching cards in draw pile';
  END IF;

  -- Remove old card from hand
  DELETE FROM player_hands
  WHERE game_session_id = _game_session_id
    AND player_id = _player_id
    AND card_id = _card_id;

  -- Add new card to hand
  INSERT INTO player_hands (game_session_id, player_id, card_id, position)
  VALUES (_game_session_id, _player_id, _new_card_id, 999);

  -- Remove drawn card from pile
  DELETE FROM draw_pile WHERE id = _draw_id;

  RETURN true;
END;
$$;

-- 4. handle_object_card: SELECT played_cards + INSERT player_hands + DELETE played_cards
CREATE OR REPLACE FUNCTION handle_object_card(
  _game_session_id uuid,
  _played_card_id uuid,
  _storyteller_id uuid,
  _next_player_id uuid,
  _expected_version integer
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  _current_version integer;
  _card_id uuid;
BEGIN
  SELECT version INTO _current_version
  FROM game_sessions
  WHERE id = _game_session_id
  FOR UPDATE;

  IF _current_version IS NULL THEN
    RAISE EXCEPTION 'GAME_SESSION_NOT_FOUND: %', _game_session_id;
  END IF;

  IF _current_version != _expected_version THEN
    RAISE EXCEPTION 'VERSION_CONFLICT: expected %, got %', _expected_version, _current_version;
  END IF;

  -- Get the card_id from played_cards
  SELECT card_id INTO _card_id
  FROM played_cards
  WHERE id = _played_card_id;

  IF _card_id IS NULL THEN
    RAISE EXCEPTION 'Played card not found';
  END IF;

  -- Return card to storyteller's hand
  INSERT INTO player_hands (game_session_id, player_id, card_id, position)
  VALUES (_game_session_id, _storyteller_id, _card_id, 0);

  -- Remove from played cards
  DELETE FROM played_cards WHERE id = _played_card_id;

  RETURN jsonb_build_object(
    'gameSessionId', _game_session_id,
    'playedCardId', _played_card_id,
    'storytellerId', _storyteller_id,
    'nextPlayerId', _next_player_id
  );
END;
$$
