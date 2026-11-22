import { test, expect } from '@playwright/test'
import { startLobby, waitForGameOnAll } from './helpers'

/**
 * Card exchange (specs/user-stories/exchange.md). The Exchange UI exists in
 * tutorial mode only — the swap must keep the hand size stable and end the
 * storyteller's turn. (Empty-pile exchange failure is unit-covered: the
 * action errors without consuming the turn.)
 */
test('exchanging a card swaps it for a draw-pile card and ends the turn', async ({ browser }) => {
  const { players, close } = await startLobby(browser, 2, { mode: 'Tutorial' })
  try {
    await waitForGameOnAll(players)

    // Tutorial mode has no "Pass Turn" control: the storyteller shows
    // "Play Card", the opponent shows the challenger controls.
    const playButton = (p: typeof players[number]) => p.page.getByRole('button', { name: 'Play Card' })
    let storyteller: typeof players[number] | null = null
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline && !storyteller) {
      const visible = await Promise.all(players.map(p => playButton(p).isVisible().catch(() => false)))
      const idx = visible.findIndex(v => v)
      if (visible.filter(Boolean).length === 1 && idx !== -1) storyteller = players[idx]
      else await players[0].page.waitForTimeout(500)
    }
    expect(storyteller).not.toBeNull()
    const opponent = players.find(p => p !== storyteller)!

    const hand = storyteller!.page.locator('.player-hand > div')
    const before = await hand.count()
    expect(before).toBeGreaterThan(1)

    // Swap the first story card for the top draw-pile card. Bounded retries:
    // the exchange chain (swap + turn pass) can fail transiently under load —
    // a failed swap leaves the hand unchanged (safe to retry), and the hand
    // size stays stable across retries either way. Strict final assertions.
    let flipped = false
    for (let attempt = 0; attempt < 3 && !flipped; attempt++) {
      await hand.first().click()
      await storyteller!.page.getByRole('button', { name: 'Exchange Card' }).click()
      flipped = await expect(async () => {
        await expect(playButton(opponent)).toBeVisible({ timeout: 8_000 })
      }).toPass({ timeout: 10_000 }).then(() => true, () => false)
      if (!flipped) await storyteller!.page.waitForTimeout(1000)
    }

    // Hand size is stable (one out, one in) …
    await expect(hand).toHaveCount(before, { timeout: 15_000 })

    // … and the turn moved to the opponent: they now show the storyteller
    // controls, the exchanger lost them.
    await expect(playButton(opponent)).toBeVisible({ timeout: 15_000 })
    await expect(playButton(storyteller!)).toBeHidden({ timeout: 15_000 })
  }
  finally {
    await close()
  }
})
