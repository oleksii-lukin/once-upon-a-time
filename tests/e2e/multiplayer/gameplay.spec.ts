import { test, expect } from '@playwright/test'
import {
  newPlayer,
  createLobby,
  getInviteLink,
  joinViaInvite,
  selectDeckAndStart,
  startTwoPlayerLobby,
  waitForGameOnBoth,
  resolveStoryteller,
  playFirstCard,
  passAndWaitForFlip,
  objectAndWaitForFlip,
} from './helpers'

/**
 * Cross-client gameplay: state written by one player must converge on the
 * other client through Supabase realtime, and the turn must flip on BOTH
 * clients after a pass (the DB-authoritative reconcile rule).
 */
test.describe('multiplayer gameplay', () => {
  test('turn loop: play converges across clients, pass flips the turn on both', async ({ browser }) => {
    const { host, guest, close } = await startTwoPlayerLobby(browser)
    try {
      await waitForGameOnBoth(host, guest)
      const { storyteller, opponent } = await resolveStoryteller(host, guest)

      const initialHand = await storyteller.locator('.player-hand > div').count()
      expect(initialHand).toBeGreaterThan(1)

      // 1. Storyteller plays a card → both clients show it on the table
      await playFirstCard(storyteller)
      await expect(storyteller.locator('div.w-80')).toHaveCount(1, { timeout: 30_000 })
      await expect(opponent.locator('div.w-80')).toHaveCount(1, { timeout: 30_000 })

      // The played card left the storyteller's hand
      await expect(storyteller.locator('.player-hand > div')).toHaveCount(initialHand - 1)

      // 2. Pass → the turn flips on both clients (neither lags behind)
      await passAndWaitForFlip(storyteller, opponent)

      // 3. The new storyteller plays too — the loop works in both directions
      const secondHand = await opponent.locator('.player-hand > div').count()
      await playFirstCard(opponent)
      await expect(opponent.locator('div.w-80')).toHaveCount(2, { timeout: 30_000 })
      await expect(storyteller.locator('div.w-80')).toHaveCount(2, { timeout: 30_000 })
      await expect(opponent.locator('.player-hand > div')).toHaveCount(secondHand - 1)
    }
    finally {
      await close()
    }
  })

  test('objection inside the pacing window passes the turn to the objector', async ({ browser }) => {
    // Pacing delay must be ON: it is the objection window (card stays
    // PENDING for pacingDelayDuration seconds, default 10).
    const host = await newPlayer(browser)
    const guest = await newPlayer(browser)
    const close = async () => {
      await host.context.close()
      await guest.context.close()
    }
    try {
      const lobbyId = await createLobby(host)

      const pacingToggle = host.page.getByLabel(/Enable Pacing Delay/i)
      await pacingToggle.click()
      await expect(pacingToggle).toBeChecked()

      const inviteLink = await getInviteLink(host)
      await joinViaInvite(guest, inviteLink, lobbyId)
      await selectDeckAndStart(host)
      await waitForGameOnBoth(host, guest)

      const { storyteller, opponent } = await resolveStoryteller(host, guest)

      // Narrator plays; the card stays PENDING for the pacing window
      await playFirstCard(storyteller)

      // Opponent objects within the window (10s) and both clients converge
      // on the new turn owner. Retries the click if a transient action
      // failure left the card (and the button) in place.
      await objectAndWaitForFlip(storyteller, opponent)
    }
    finally {
      await close()
    }
  })
})
