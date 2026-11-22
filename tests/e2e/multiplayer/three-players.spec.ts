import { test, expect } from '@playwright/test'
import {
  startLobby,
  waitForGameOnAll,
  resolveStorytellerAmong,
  passAndWaitForFlipMulti,
  objectAndWaitForFlipMulti,
  playFirstCard,
} from './helpers'

/**
 * 3-player turn order (specs/user-stories/multiplayer-turn-order.md):
 * consecutive passes must rotate through the whole table, and an objection
 * must hand the turn to its ACTOR — not to the storyteller's successor.
 */
test.describe('three players', () => {
  test('consecutive passes rotate through all three players and wrap around', async ({ browser }) => {
    const { players, close } = await startLobby(browser, 3)
    try {
      await waitForGameOnAll(players)
      const first = await resolveStorytellerAmong(players)

      // Three passes: each pass must land on a DIFFERENT client, and the
      // third pass must wrap back to the first storyteller.
      const second = await passAndWaitForFlipMulti(first.storyteller, players)
      expect(second).not.toBe(first.storyteller)

      const third = await passAndWaitForFlipMulti(second, players)
      expect(third).not.toBe(second)
      expect(third).not.toBe(first.storyteller)

      const wrapped = await passAndWaitForFlipMulti(third, players)
      expect(wrapped).toBe(first.storyteller)
    }
    finally {
      await close()
    }
  })

  test('an objection by a non-adjacent player hands them the turn', async ({ browser }) => {
    // Pacing delay is the objection window — must be ON (set before start).
    const { players, close } = await startLobby(browser, 3, { pacing: true })
    try {
      await waitForGameOnAll(players)
      const { storyteller, others } = await resolveStorytellerAmong(players)
      const [objector] = others

      // The storyteller plays; the card stays PENDING for the window.
      await playFirstCard(storyteller.page)

      // The objector objects — they must take the turn (the actor rule),
      // even though the storyteller's turn-order successor is the OTHER
      // opponent, who must never show the turn control.
      await objectAndWaitForFlipMulti(objector, players)

      const holder = await resolveStorytellerAmong(players)
      expect(holder.storyteller).toBe(objector)
      expect(holder.others).toHaveLength(2)
    }
    finally {
      await close()
    }
  })
})
