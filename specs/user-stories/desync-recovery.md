# User Story: Desync and Recovery

**Actors**: Players A (storyteller) and B (opponent) — any count.

**Preconditions**:
- The game relies on Supabase realtime (`postgres_changes`) as the fast path and polling as the safety net (board poll every 5s, lobby status poll every 3s while waiting).

## Scenario 1: Missed realtime event (dropped websocket)

1. B's websocket drops while A plays a card / passes / objects.
2. **Expected result**: B's board converges within ≤2 polling intervals (≤10s) without any user action; no duplicate cards, no stale turn.

## Scenario 2: Offline window during an opponent's move

1. B goes offline (network cut) while A plays a card.
2. B comes back online after the move completed.
3. **Expected result**: B's client reconnects and converges to the same board as A — played cards, hand sizes, current storyteller.

## Scenario 3: Reload during the pacing window

1. A plays a card (pacing on); B reloads their page while the card is still `PENDING`.
2. **Expected result**: B sees the pending card and the "Object / Disapprove" button; objecting after the reload works and passes the turn to B.

## Scenario 4: Reload after confirmation

1. A plays a card; the window closes; B reloads.
2. **Expected result**: B sees the card as `CONFIRMED`; no objection is possible anymore.

## Scenario 5: Two clients act simultaneously

1. While A is the storyteller, A clicks Pass and B clicks Object in the same moment (or two players object together).
2. **Expected result**: the persistence layer accepts exactly one winning action; the loser surfaces an error or is ignored; the DB-authoritative turn is a single player; all clients converge to it.

## Scenario 6: Stale local players list

1. B's players list is stale (missed INSERT of a player).
2. **Expected result**: the client refetches players on subscription (SUBSCRIBED) and on board refresh; turn computation uses the refetched list — no action is computed against a stale successor (the actor-takes-turn rule makes this moot for objections/interrupts).

## Scenario 7: Server action failure mid-chain

1. A client action chain (e.g. objection → penalty draw → turn pass) fails at one step (network blip).
2. **Expected result**: the machine surfaces the error and returns to a playable state; the DB remains authoritative; a retry (user action or poll) converges. No wedge: every invoke has an error path back to play.
