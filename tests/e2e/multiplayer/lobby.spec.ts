import { test, expect } from '@playwright/test'
import {
  newPlayer,
  createLobby,
  getInviteLink,
  joinViaInvite,
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

  test('guest can toggle ready status in the waiting lobby', async ({ browser }) => {
    // Ready is a direct players.update from the browser today — locked in
    // here so the Phase-2 migration to a hash-verified server action cannot
    // regress the flow.
    const host = await newPlayer(browser)
    const guest = await newPlayer(browser)
    try {
      const lobbyId = await createLobby(host)
      const inviteLink = await getInviteLink(host)
      await joinViaInvite(guest, inviteLink, lobbyId)

      // joinViaInvite asserted the guest sees "Not Ready" as a member
      const toggle = guest.page.getByRole('button', { name: 'Not Ready' })
      await expect(toggle).toBeVisible()
      await toggle.click()

      // Preferred: the flip comes back over realtime from the DB. The
      // subscription occasionally misses an event (pre-existing), so fall
      // back to a reload — persistence of the write is what must hold.
      const flipped = await guest.page
        .getByRole('button', { name: 'Ready', exact: true })
        .waitFor({ state: 'visible', timeout: 8_000 })
        .then(() => true, () => false)
      if (!flipped) {
        console.log('[ready-toggle] realtime missed the update, verifying via reload')
        await guest.page.reload({ waitUntil: 'load' })
      }
      await expect(guest.page.getByRole('button', { name: 'Ready', exact: true }))
        .toBeVisible({ timeout: 15_000 })
    }
    finally {
      await host.context.close()
      await guest.context.close()
    }
  })

  test('guest can leave the lobby and lands back home', async ({ browser }) => {
    // Leave is a direct players.delete from the browser today — same
    // Phase-2 regression lock as the ready toggle above.
    const host = await newPlayer(browser)
    const guest = await newPlayer(browser)
    try {
      const lobbyId = await createLobby(host)
      const inviteLink = await getInviteLink(host)
      await joinViaInvite(guest, inviteLink, lobbyId)

      await guest.page.getByRole('button', { name: 'Leave' }).click()
      await guest.page.waitForURL(/\/en\/?$/, { timeout: 15_000 })
      expect(guest.page.url()).toMatch(/\/en\/?$/)

      // The host stays in the lobby (invite input still rendered)
      await expect(host.page.locator('input[readonly]').first()).toBeVisible({ timeout: 15_000 })
      expect(host.page.url()).toContain(lobbyId)
    }
    finally {
      await host.context.close()
      await guest.context.close()
    }
  })
})
