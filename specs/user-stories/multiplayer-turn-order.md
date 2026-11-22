# User Story: Multiplayer Turn Order (3–4 Players)

**Actors**: Players A, B, C (and D in a 4-player lobby) — sorted by `turn_order`, then `joined_at`.

**Preconditions**:
- Game has started with 3 or 4 players (mode `full`/`main` unless stated).

## Scenario 1: Turn rotation on passes

1. A is the storyteller and clicks "Pass"; A draws 1 card; the turn moves to B.
2. B passes → C; C passes → D (4 players) or back to A (3 players).
3. **Expected result**: rotation follows `turn_order` and wraps around; every client agrees on the current storyteller within the polling interval.

## Scenario 2: Several consecutive passes (skip chain)

1. A, B, C pass back-to-back without playing a card (e.g. all hands are unplayable).
2. **Expected result**: the turn keeps rotating through the whole table — no player is skipped twice, no pass is dropped; after N passes the storyteller is `(start + N) mod N` on every client.

## Scenario 3: Objection by a non-adjacent player

1. A (storyteller) plays a card; C objects inside the pacing window.
2. **Expected result**: the turn passes to **C** (the actor rule: the objector takes the turn), not to A's successor and not to the player next to A. B is skipped — that is correct.

## Scenario 4: Interruption by a non-adjacent player (auto-validated)

1. A is the storyteller; D interrupts (keyword matching is not enforced — auto-valid).
2. **Expected result**: the turn passes to **D** (the interrupter); A draws 1 penalty card; D's card stays in hand (backlog: the classic rule plays it to the story line).

## Scenario 5: Challenge stutter by a third player

1. A is the storyteller; B challenges a stutter.
2. **Expected result**: A draws 1 penalty card; the turn passes to B (the challenger).

## Scenario 6: Hand and pile bookkeeping across the table

1. After each pass/objection/interruption, every client recomputes: the active player's hand decreases by the drawn card, the penalty recipient's hand increases, the draw pile shrinks by the number of draws.
2. **Expected result**: hand counts converge on all clients within 2 polling intervals (5s board poll).

## Scenario 7: Two players act at the same time (race)

1. While A is the storyteller, B and C click actions simultaneously (e.g. B passes for A via objection, C interrupts).
2. **Expected result**: one action wins the persistence layer; the loser gets an error or is ignored; the DB-authoritative turn is a single player — clients converge to it via realtime/poll. No wedged state.
