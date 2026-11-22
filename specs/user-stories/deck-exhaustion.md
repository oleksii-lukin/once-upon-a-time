# User Story: Deck Exhaustion

**Actors**: Any players in a game whose draw pile runs empty.

**Preconditions**:
- The draw pile has 0 cards (all story cards are in hands or on the table).
- Note: there is **no reshuffle** — played cards are not recycled (backlog item).

## Scenario 1: Pass with an empty pile

1. The storyteller clicks "Pass" while the draw pile is empty.
2. **System Action**: the pass persists (turn moves to the next player); the draw is attempted and finds no cards.
3. **Outcome**: the turn still passes; the player simply draws nothing. No error is shown for the draw itself (a failed draw must not block the turn).

## Scenario 2: Objection penalty with an empty pile

1. A player objects; the card returns to the storyteller's hand; the penalty draw finds no cards.
2. **Expected result**: the objection still counts (card returned, turn passes to the objector); the penalty draw is skipped silently.

## Scenario 3: Challenge stutter penalty with an empty pile

1. A challenge succeeds; the penalty draw finds no cards.
2. **Expected result**: same as Scenario 2 — the turn passes to the challenger; no penalty card is drawn.

## Scenario 4: Exchange with an empty pile

1. The storyteller tries to exchange a card with an empty draw pile.
2. **System Action**: the exchange fails with "No cards in draw pile"; nothing changes.
3. **Outcome**: **the turn is not consumed** — the storyteller stays the storyteller, may pass or play. The error is surfaced.

## Scenario 5: Endgame behavior with an empty pile

1. The pile is empty; every player holds only cards they cannot play.
2. **Expected result**: players can still pass (Scenario 1) and win by playing all story cards + ending; the game does not deadlock.

## Scenario 6: Reshuffle (not implemented)

1. A reshuffle of played cards when the pile empties is **not implemented** and not required for these scenarios.
2. **Outcome**: documented as backlog; tests assert only the no-reshuffle behavior above.
