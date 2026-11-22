# User Story: Spectating and Joining

**Actors**: Spectator S, joining player J, host H (lobby owner), players already in the game.

**Preconditions**:
- A game is running in lobby L (status `playing`).

## Scenario 1: Spectator views a started game

1. S opens the lobby link while the game is running.
2. **System Action**: S sees the game board (played cards, player list, current storyteller) **without** a hand and without turn controls.
3. **Outcome**: S cannot play, pass, object, or interrupt.

## Scenario 2: Reload re-entry

1. Any player reloads the page while the game is running.
2. **Expected result**: they land back on the game board with their hand and current turn state (server-side identity: guest cookie / Clerk session).

## Scenario 3: Hot join while the game is running

1. J opens the invite link (or lobby URL) after the game has started.
2. **Current behavior**: J gets a player row with **no hand** (hands are dealt only at game start) and an empty hand renders like the spectator view. The lobby's `allowHotJoin` setting exists in the UI but is **not enforced** by game logic.
3. **Known hazard (backlog)**: J has `turn_order = NULL` and still participates in turn rotation (sorted by `joined_at`), so the turn can reach a player with no hand. `allowHotJoin` should gate this — until then, joining a `playing` lobby is undefined behavior for the joiner.

## Scenario 4: Guest identity across contexts

1. A guest plays in two browser contexts (two "players" in tests).
2. **Expected result**: each context carries its own guest identity (`ouat_guest_id` cookie); identity is per-context, not per-browser-profile.

## Flag enforcement table (actual behavior)

| Setting | Enforced by game logic? | Where it matters |
|---|---|---|
| `allowSpectators` | Partially — lobby list only | Lobby list filters playing lobbies; the game board itself always allows spectator view |
| `allowHotJoin` | **No** (dead flag) | UI toggle exists; game always treats mid-game joiners as spectators |
| `publicGame` | **No** (dead flag) | Lobby visibility is not filtered by it |
| `happyEnding` | **No** (dead flag) | Toggle exists in settings; no game rule reads it |
| `allowInterrupts` | **No** (dead flag) | Interrupt gating comes from the game mode config (`MODE_CONFIG`), not this flag |

Dead flags are backlog items: either wire them up or remove the toggles.
