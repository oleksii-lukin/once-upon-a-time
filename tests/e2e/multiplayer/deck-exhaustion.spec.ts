import { test, expect } from '@playwright/test'
import {
  startLobby,
  waitForGameOnBoth,
  resolveStoryteller,
  passAndWaitForFlip,
  objectAndWaitForFlip,
  playFirstCard,
  emptyDrawPile,
} from './helpers'

/**
 * Deck exhaustion (specs/user-stories/deck-exhaustion.md): an empty draw
 * pile is a legitimate state — a pass must still pass the turn (draw 0) and
 * an objection penalty draw must be skipped, never wedging the game.
 * (Exchange on an empty pile is unit-covered: no Exchange UI outside
 * tutorial mode.)
 */
test('with an empty draw pile: passes and objections still move the turn', async ({ browser }) => {
  const { players, lobbyId, close } = await startLobby(browser, 2, { pacing: true })
  const [p1, p2] = players
  try {
    await waitForGameOnBoth(p1, p2)
    const first = await resolveStoryteller(p1, p2)

    // The pile runs dry before any card is drawn.
    emptyDrawPile(lobbyId)

    // 1. A pass with an empty pile still passes the turn (draw 0 — before
    //    the fix the failed draw aborted the chain and wedged the pass).
    await passAndWaitForFlip(first.storyteller, first.opponent)

    // 2. An objection penalty draw with an empty pile still passes the turn
    //    to the objector (the penalty draw is skipped, not fatal).
    const second = { storyteller: first.opponent, opponent: first.storyteller }
    await playFirstCard(second.storyteller)
    await objectAndWaitForFlip(second.storyteller, second.opponent)

    await expect(second.opponent.getByRole('button', { name: 'Pass Turn' })).toBeVisible({ timeout: 15_000 })
    await expect(second.storyteller.getByRole('button', { name: 'Pass Turn' })).toBeHidden({ timeout: 15_000 })
  }
  finally {
    await close()
  }
})
