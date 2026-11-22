import { test, expect } from '@playwright/test'
import { startLobby, waitForGameOnBoth, resolveStoryteller } from './helpers'

/**
 * Interrupt (specs/user-stories/interruptions.md): auto-validated — clicking
 * Interrupt! must pass the turn to the interrupter and draw a penalty card
 * for the victim. Before the fix the rules machine waited for a VALID that
 * no UI ever sent, wedging the storyteller forever.
 */
test('an interrupt passes the turn to the interrupter and penalizes the storyteller', async ({ browser }) => {
  const { players, close } = await startLobby(browser, 2)
  const [p1, p2] = players
  try {
    await waitForGameOnBoth(p1, p2)
    const { storyteller, opponent } = await resolveStoryteller(p1, p2)

    const before = await storyteller.locator('.player-hand > div').count()
    expect(before).toBeGreaterThan(1)

    const interruptButton = opponent.getByRole('button', { name: 'Interrupt!' })

    // Bounded retries: the click can land before hydration, and a single
    // failed server action in the chain aborts it — the button stays if
    // nothing happened. Strict final assertion below.
    let landed = false
    for (let attempt = 0; attempt < 3 && !landed; attempt++) {
      await expect(interruptButton).toBeVisible({ timeout: 10_000 })
      await interruptButton.click()
      landed = await expect(async () => {
        await expect(opponent.getByRole('button', { name: 'Pass Turn' })).toBeVisible({ timeout: 8_000 })
      }).toPass({ timeout: 10_000 }).then(() => true, () => false)
      if (!landed) await opponent.waitForTimeout(1000)
    }

    // The interrupter holds the turn, the victim lost it.
    await expect(opponent.getByRole('button', { name: 'Pass Turn' })).toBeVisible({ timeout: 15_000 })
    await expect(storyteller.getByRole('button', { name: 'Pass Turn' })).toBeHidden({ timeout: 15_000 })

    // The victim drew exactly one penalty card (realtime/poll convergence).
    await expect
      .poll(() => storyteller.locator('.player-hand > div').count(), { timeout: 15_000 })
      .toBe(before + 1)
  }
  finally {
    await close()
  }
})
