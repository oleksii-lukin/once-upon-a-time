# User Story: Card Exchange

**Actors**: Player A (Storyteller), Player B (opponent)

**Preconditions**:
- Game has started; Player A is the storyteller.
- Player A has at least one card selected in their hand.

## Scenario 1: Exchange a story card

1. Player A selects a story card and clicks "Exchange Card".
2. **System Action**:
   - The top card of the draw pile is moved to Player A's hand (position appended).
   - The selected card is removed from Player A's hand.
   - The turn passes to Player B (the exchange ends Player A's turn).
3. **Outcome**: Player A's hand size is unchanged; the table is unchanged; Player B becomes the storyteller.

## Scenario 2: Exchange an ending card

1. Player A selects their Ending Card and clicks "Exchange Card".
2. **System Action**: same as Scenario 1, but the replacement is drawn from the ending pile (`endingOnly`).
3. **Outcome**: Player A keeps one ending card; the turn passes to Player B.

## Scenario 3: Empty draw pile (deck exhaustion)

1. Player A tries to exchange while the draw pile is empty.
2. **System Action**: the exchange fails with an error ("No cards in draw pile"); nothing is removed or added.
3. **Outcome**: **the turn is not consumed** — Player A stays the storyteller and may pass or play normally. The error is surfaced to Player A.

## Scenario 4: Card not in hand

1. Player A attempts to exchange a card that is no longer in their hand (stale UI).
2. **System Action**: the exchange fails ("Card is not in the player's hand"); the draw pile card is not consumed.
3. **Outcome**: Player A stays the storyteller; the error is surfaced.

## Scenario 5: Exchange on the opponent's client

1. Player B sees Player A exchange (hand counts update, turn flips).
2. **Expected result**: Player B's client converges through realtime/poll within the polling interval; no action is available to Player B (only the storyteller can exchange).
