import { test, expect } from '@playwright/test'
import { startLobby, waitForGameOnBoth, resolveStoryteller, removeStorytellerStoryCards, psql } from './helpers'

/**
 * Ending the game (specs/user-stories/ending-game.md): the storyteller with
 * an empty story hand plays the Ending Card → winner screen on BOTH clients,
 * session COMPLETED, lobby finished.
 *
 * The hand is shrunk via direct DB writes so the test plays 1 card instead
 * of a full game (win acceleration).
 */
test('playing the ending card finishes the game with a winner screen on both clients', async ({ browser }) => {
  const { players, lobbyId, close } = await startLobby(browser, 2)
  const [p1, p2] = players
  try {
    await waitForGameOnBoth(p1, p2)
    const { storyteller, opponent } = await resolveStoryteller(p1, p2)

    // Accelerate: remove every story card from the storyteller's hand —
    // only the Ending Card remains (win button requires story count 0).
    removeStorytellerStoryCards(lobbyId)

    const hand = storyteller.locator('.player-hand > div')
    // With no stories left there is no separator: exactly the ending card.
    await expect(hand).toHaveCount(1, { timeout: 20_000 })

    await hand.first().click()
    await storyteller.getByRole('button', { name: /Play Ending/ }).click()

    // Winner screen converges on both clients.
    await expect(storyteller.getByText('Congratulations!')).toBeVisible({ timeout: 30_000 })
    await expect(opponent.getByText('Congratulations!')).toBeVisible({ timeout: 30_000 })

    // Authoritative end state in the DB.
    expect(psql(`SELECT status FROM game_sessions WHERE lobby_id = '${lobbyId}'`)).toBe('COMPLETED')
    expect(psql(`SELECT status FROM lobbies WHERE id = '${lobbyId}'`)).toBe('finished')
  }
  finally {
    await close()
  }
})
