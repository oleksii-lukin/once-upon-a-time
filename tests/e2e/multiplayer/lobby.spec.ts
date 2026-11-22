import { test, expect } from '@playwright/test'
import {
  newPlayer,
  startTwoPlayerLobby,
  waitForGameOnBoth,
  gotoWithRetry,
  gameBoard,
} from './helpers'

/**
 * Multiplayer lobby flow with two isolated guest contexts:
 * create → invite join → start → both clients enter the game.
 */
test.describe('multiplayer lobby flow', () => {
  test('guest host creates a lobby, guest joins by invite, both enter the game', async ({ browser }) => {
    const { host, guest, close } = await startTwoPlayerLobby(browser)
    try {
      await waitForGameOnBoth(host, guest)

      // Both are members, not spectators: each was dealt a hand
      await expect(gameBoard(host.page)).not.toHaveCount(0)
      await expect(gameBoard(guest.page)).not.toHaveCount(0)

      // Exactly one client holds the turn (polling: .or() cannot span pages)
      await expect(async () => {
        const hostHas = await host.page.getByRole('button', { name: 'Pass Turn' }).isVisible()
        const guestHas = await guest.page.getByRole('button', { name: 'Pass Turn' }).isVisible()
        if (hostHas === guestHas) throw new Error(`turn not settled: host=${hostHas} guest=${guestHas}`)
      }).toPass({ timeout: 30_000 })
    }
    finally {
      await close()
    }
  })

  test('a visitor opening the started game sees the board as a spectator', async ({ browser }) => {
    const { host, guest, lobbyId, close } = await startTwoPlayerLobby(browser)
    const spectator = await newPlayer(browser)
    try {
      await waitForGameOnBoth(host, guest)

      await gotoWithRetry(spectator.page, `/en/lobbies/${lobbyId}`)

      // The game view mounts for a non-member (the hand tray renders)...
      await expect(spectator.page.locator('.player-hand')).toBeVisible({ timeout: 30_000 })
      // ...but they get no hand and no turn controls
      await expect(gameBoard(spectator.page)).toHaveCount(0)
      await expect(spectator.page.getByRole('button', { name: 'Pass Turn' })).toBeHidden()
    }
    finally {
      await spectator.context.close()
      await close()
    }
  })

  test('reloading the started game lands both clients back on the board', async ({ browser }) => {
    // The game renders in place of the lobby view once status flips, and
    // initializeGame is idempotent — a reload must re-enter the same game
    // instead of dropping back to the lobby or starting a second session.
    const { host, guest, lobbyId, close } = await startTwoPlayerLobby(browser)
    try {
      await waitForGameOnBoth(host, guest)

      await host.page.reload()
      await expect(gameBoard(host.page).first()).toBeVisible({ timeout: 30_000 })

      await guest.page.reload()
      await expect(gameBoard(guest.page).first()).toBeVisible({ timeout: 30_000 })

      // The lobby URL is stable — the game renders in place
      expect(host.page.url()).toContain(lobbyId)
      expect(guest.page.url()).toContain(lobbyId)
    }
    finally {
      await close()
    }
  })
})
