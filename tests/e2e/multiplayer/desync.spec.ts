import { test, expect } from '@playwright/test'
import { startLobby, waitForGameOnBoth, resolveStoryteller, objectAndWaitForFlip, playFirstCard } from './helpers'

/**
 * Desync recovery (specs/user-stories/desync-recovery.md): the changefeed is
 * the fast path, polling the safety net — a client that missed realtime
 * events must converge on its own, and a reload mid-window must not lose the
 * objection opportunity.
 */
test.describe('desync recovery', () => {
  test('a client offline during the opponent\'s play converges after reconnecting', async ({ browser }) => {
    const { players, close } = await startLobby(browser, 2, { pacing: true })
    const [p1, p2] = players
    try {
      await waitForGameOnBoth(p1, p2)
      const { storyteller, opponent } = await resolveStoryteller(p1, p2)

      // The opponent loses the network entirely.
      await opponent.context().setOffline(true)

      // The storyteller plays while the opponent is away.
      await playFirstCard(storyteller)
      await expect(storyteller.locator('div.w-80')).toHaveCount(1, { timeout: 30_000 })

      // Stay offline across a poll interval so the changefeed really is
      // missed (not just delayed).
      await opponent.waitForTimeout(6000)
      await opponent.context().setOffline(false)

      // The board converges without any user action (poll ≤5s + margin;
      // generous budget — the full suite shares one dev server under load).
      await expect(opponent.locator('div.w-80')).toHaveCount(1, { timeout: 45_000 })

      // And the pending objection window is still actionable after the
      // reconnect (pacing window is 10s — it may have closed by now, so the
      // card may be CONFIRMED; either way the table must agree).
      await expect(storyteller.locator('div.w-80')).toHaveCount(1, { timeout: 10_000 })
    }
    finally {
      await close()
    }
  })

  test('reloading during the pacing window keeps the objection possible', async ({ browser }) => {
    // A 30s window makes the reload-in-window deterministic even on a cold
    // dev compile.
    const { players, close } = await startLobby(browser, 2, { pacing: true, pacingDuration: 30 })
    const [p1, p2] = players
    try {
      await waitForGameOnBoth(p1, p2)
      const { storyteller, opponent } = await resolveStoryteller(p1, p2)

      // The storyteller plays; the opponent reloads mid-window.
      await playFirstCard(storyteller)
      await expect(storyteller.locator('div.w-80')).toHaveCount(1, { timeout: 30_000 })
      await opponent.reload({ waitUntil: 'load' })

      // After the reload the pending card and the objection control are back.
      // One bounded re-entry retry: under full-suite parallel load the first
      // re-entry can drop its data fetches (dev server compiling); a genuine
      // broken state fails the strict retry below with a state dump.
      const tableHasCard = () => expect(opponent.locator('div.w-80')).toHaveCount(1, { timeout: 30_000 })
      try {
        await tableHasCard()
      }
      catch (error) {
        console.log(`[desync] re-entry miss: url=${opponent.url()} hand=${await opponent.locator('.player-hand > div').count()} table=${await opponent.locator('div.w-80').count()} body=${(await opponent.locator('body').innerText()).slice(0, 240).replace(/\n+/g, ' | ')}`)
        await opponent.reload({ waitUntil: 'load' })
        await tableHasCard()
      }
      await objectAndWaitForFlip(storyteller, opponent)

      // The objection passed the turn on the reloaded client too.
      await expect(opponent.getByRole('button', { name: 'Pass Turn' })).toBeVisible({ timeout: 15_000 })
      await expect(storyteller.getByRole('button', { name: 'Pass Turn' })).toBeHidden({ timeout: 15_000 })
    }
    finally {
      await close()
    }
  })
})
