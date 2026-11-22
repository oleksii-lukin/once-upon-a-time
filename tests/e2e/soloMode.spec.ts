import { test, expect } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'
import { createLobby, selectDeckAndStart, gameBoard } from './multiplayer/helpers'

// Solo workflow against the CURRENT app (rewritten from a Phase-2b relic):
// - lobby settings live at /lobbies/{id} (admin view), not on /en/lobbies
// - game mode is a GameModeTabs tab ("Solo Mode"), not a labeled select
// - the game renders in place at /lobbies/{id} — there is no /game/ route
// - defaults already have pacing delay and turn timer off, no toggling needed
//
// Requires a Clerk test account: E2E_USER_EMAIL / E2E_USER_PASSWORD are read
// from the test process env — `pnpm test:e2e` loads .env.local for them.

/** Children of .player-hand: stories + ending (+ a separator while stories remain). */
const handChildren = (storiesLeft: number) => (storiesLeft > 0 ? storiesLeft + 2 : 1)

test.describe('Solo Game Mode', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'E2E_USER_EMAIL / E2E_USER_PASSWORD not set (run via pnpm test:e2e or export them)',
  )

  test('should complete a full solo game workflow', async ({ page }) => {
    // 1. Sign in using the Clerk testing helper
    await page.goto('/en')
    await clerk.signIn({
      page,
      signInParams: {
        strategy: 'password',
        identifier: process.env.E2E_USER_EMAIL!,
        password: process.env.E2E_USER_PASSWORD!,
      },
    })

    // 2. Create a lobby (reuses the multiplayer helper incl. its 500-retry)
    const lobbyId = await createLobby({ context: page.context(), page })
    expect(page.url()).toContain(lobbyId)

    // 3. Pick the Solo game mode. The mode is persisted by a fire-and-forget
    //    update; reload so the assertion reads DB state (the description only
    //    renders when lobby.settings.gameMode === 'solo').
    await page.getByRole('button', { name: 'Solo Mode' }).click()
    await page.reload({ waitUntil: 'load' })
    await expect(page.getByText(/Tell your story alone/)).toBeVisible({ timeout: 15_000 })

    // 4. Select a deck and start (helper also clicks Start Game)
    await selectDeckAndStart({ context: page.context(), page })

    // 5. Game renders in place at /lobbies/{id}
    await expect(page).toHaveURL(new RegExp(`/lobbies/${lobbyId}`))
    await expect(gameBoard(page).first()).toBeVisible({ timeout: 30_000 })

    // 6. Play the 5 story cards: first hand child is always a story card.
    //    The hand count dropping is the settle signal for the server action.
    const hand = page.locator('.player-hand > div')
    for (let storiesLeft = 5; storiesLeft > 0; storiesLeft--) {
      await hand.first().click()
      await page.getByRole('button', { name: 'Play Card' }).click()
      await expect(hand).toHaveCount(handChildren(storiesLeft - 1), { timeout: 15_000 })
    }

    // 7. Only the ending remains — play it and win
    await expect(hand).toHaveCount(1)
    await hand.first().click()
    await page.getByRole('button', { name: /Play Ending/ }).click()

    // 8. Completion overlay, then back to the lobby list
    await expect(page.getByText('Congratulations!')).toBeVisible({ timeout: 15_000 })
    await page.getByRole('button', { name: 'Return to Lobbies' }).click()
    await expect(page).toHaveURL(/\/lobbies$/, { timeout: 15_000 })
  })
})
