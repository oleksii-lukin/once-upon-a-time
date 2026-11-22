# User Story: Objections

**Actors**: Player A (Storyteller), Player B (Objector), Player C (optional third player)

**Preconditions**:
- Game has started in a mode with objections enabled (`full`/`main`).
- `enablePacingDelay` may be on (default window 10s, allowed 3–30s) or off (no objection window).

## Scenario 1: Objection inside the pacing window

1. Player A plays a card. The card stays `PENDING` on the table for the pacing window.
2. Player B clicks "Object / Disapprove" before the window closes.
3. **System Action**:
   - The card returns to Player A's hand.
   - Player A draws 1 penalty card.
   - The turn passes to Player B (the objector takes the turn — the actor rule).
4. **Outcome**: both clients converge on Player B as the storyteller.

## Scenario 2: Window closes with no objection

1. Player A plays a card; nobody objects within the window.
2. **System Action**: the card is confirmed (`CONFIRMED`); Player A continues their turn.
3. **Outcome**: the card can no longer be objected to.

## Scenario 3: Objection rejected (future arbitration)

1. Player B objects; the group (or a future vote) rejects the objection.
2. **System Action**: the card is confirmed; Player A continues as storyteller.
3. **Outcome**: no penalty, no turn change.

## Scenario 4: Objection to the ending card (winning sequence)

1. Player A plays their Ending Card with 0 story cards left; the card is `PENDING`.
2. Player B objects inside the window.
3. **System Action**: the ending returns to hand, Player A draws a penalty, the game returns to normal play (the win attempt is abandoned), and the turn passes to Player B.
4. **Outcome**: the win is not finalized; the game continues.

## Scenario 5: Objection at the last moment (race)

1. The pacing window is about to expire while Player B clicks "Object".
2. **Expected result**: exactly one outcome wins the race — either the objection persists and the turn moves, or the card is confirmed and the objection is a no-op. There must be no wedged state: the machine either lands in `objecting` (persistence → turn pass) or `confirming` (confirm → continue).
3. **Outcome**: both clients always agree on the resulting state.

## Scenario 6: Two players object simultaneously

1. Players B and C both click "Object" during the window.
2. **System Action**: the first objection persists (card return + penalty + turn pass); the second is rejected or ignored (the card is already gone from the table).
3. **Outcome**: one penalty draw, the turn goes to exactly one objector — the one whose objection persisted.
