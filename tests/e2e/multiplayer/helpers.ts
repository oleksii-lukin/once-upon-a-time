import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'

/**
 * Multiplayer e2e helpers.
 *
 * One Playwright browser context = one isolated player: separate cookie
 * jar (the app identifies guests via the `ouat_guest_id` cookie) and
 * separate localStorage. No Clerk accounts are needed — both players are
 * anonymous guests, which is the path most real players take.
 *
 * Prerequisites: local Supabase stack running (`supabase start`) and the
 * dev server (Playwright's webServer boots it automatically).
 */

export interface Player {
  context: BrowserContext
  page: Page
}

/** Creates an isolated guest player with its own browser context. */
export async function newPlayer(browser: Browser): Promise<Player> {
  const context = await browser.newContext()
  const page = await context.newPage()
  return { context, page }
}

/** Host creates a lobby from the lobbies list page. Returns the lobby id. */
export async function createLobby(host: Player): Promise<string> {
  await gotoWithRetry(host.page, '/en/lobbies')
  const createButton = host.page.getByRole('button', { name: 'Create New Story' })
  await expect(createButton).toBeVisible({ timeout: 30_000 })

  // The click can land before hydration attaches the handler (dev), or the
  // create action can fail transiently — retry until the navigation lands.
  let lobbyUrl: string | null = null
  for (let attempt = 0; attempt < 3 && !lobbyUrl; attempt++) {
    await createButton.click()
    lobbyUrl = await host.page
      .waitForURL(/\/lobbies\/[0-9a-f-]{36}/i, { timeout: 15_000 })
      .then(() => host.page.url())
      .catch(() => null)
    if (!lobbyUrl) await host.page.waitForTimeout(1000)
  }
  if (!lobbyUrl) throw new Error('Create New Story did not navigate to a lobby')

  const lobbyId = lobbyUrl.split('/').pop()!
  expect(lobbyId).toMatch(/^[0-9a-f-]{36}$/i)
  return lobbyId
}

/** Reads the invite link the host's lobby view renders. */
export async function getInviteLink(host: Player): Promise<string> {
  const inviteInput = host.page.locator('input[readonly]').first()
  await expect(inviteInput).toBeVisible({ timeout: 30_000 })
  const link = await inviteInput.inputValue()
  expect(link).toContain('/invite/')
  return link
}

/** Guest opens the invite link and is joined + redirected to the lobby. */
export async function joinViaInvite(guest: Player, inviteLink: string, lobbyId: string): Promise<void> {
  // joinLobby is idempotent (alreadyMember reports success), so a retry
  // after a transient action failure is safe.
  let joined = false
  for (let attempt = 0; attempt < 3 && !joined; attempt++) {
    await gotoWithRetry(guest.page, inviteLink)
    joined = await guest.page
      .waitForURL(new RegExp(`/lobbies/${lobbyId}`), { timeout: 20_000 })
      .then(() => true)
      .catch(() => false)
    if (!joined) await guest.page.waitForTimeout(1000)
  }
  if (!joined) throw new Error('invite link did not land on the lobby')
  // The member view renders a ready toggle only for actual members
  await expect(guest.page.getByRole('button', { name: 'Not Ready' })).toBeVisible({ timeout: 15_000 })
}

/**
 * Navigates with retries on transient network-layer failures
 * (ERR_NETWORK_CHANGED etc. — machine-level interface/DNS churn can hit
 * any navigation; all parallel tests failing their first goto at once is
 * the classic signature).
 */
export async function gotoWithRetry(page: Page, url: string, attempts = 3): Promise<void> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      await page.goto(url, { waitUntil: 'load' })
      return
    }
    catch (error) {
      lastError = error
      if (!/ERR_NETWORK_CHANGED|ERR_CONNECTION|ECONNRESET|EHOSTUNREACH|ETIMEDOUT|ERR_TIMED_OUT/.test(String(error))) {
        throw error
      }
      await page.waitForTimeout(2000)
    }
  }
  throw lastError
}

/** Selects the first deck (required before Start Game) and starts the game. */
export async function selectDeckAndStart(host: Player): Promise<void> {
  // Deck rows are the only <label> elements wrapping a switch; settings
  // toggles render label and switch as siblings. Prefer the seeded deck.
  const deckRow = host.page.locator('label:has([role="switch"])').filter({ hasText: /default/i }).first()
  const anyDeckRow = host.page.locator('label:has([role="switch"])').last()
  const row = (await deckRow.count()) > 0 ? deckRow : anyDeckRow
  await expect(row).toBeVisible({ timeout: 15_000 })
  await row.locator('[role="switch"]').click()
  await expect(row.locator('[role="switch"]')).toHaveAttribute('aria-checked', 'true')

  await host.page.getByRole('button', { name: 'Start Game' }).click()
}

/**
 * Waits until a page renders the game board (the hand tray has cards).
 * The game renders in place at /lobbies/{id} — there is no /game route.
 */
export function gameBoard(page: Page) {
  return page.locator('.player-hand > div')
}

/** Waits for the game board on both clients (guest flips via realtime). */
export async function waitForGameOnBoth(host: Player, guest: Player): Promise<void> {
  await expect(gameBoard(host.page).first()).toBeVisible({ timeout: 30_000 })
  await expect(gameBoard(guest.page).first()).toBeVisible({ timeout: 30_000 })
}

/**
 * Determines which client holds the turn (the first storyteller is
 * shuffled by initializeGame, so it cannot be assumed to be the host).
 * Returns the storyteller's page and the opponent's page.
 */
export async function resolveStoryteller(
  host: Player,
  guest: Player,
): Promise<{ storyteller: Page, opponent: Page }> {
  const passButton = (p: Player) => p.page.getByRole('button', { name: 'Pass Turn' })

  // Locator.or() cannot span two pages — poll both until exactly one
  // client shows the turn control.
  await expect(async () => {
    const hostHas = await passButton(host).isVisible()
    const guestHas = await passButton(guest).isVisible()
    if (hostHas === guestHas) {
      throw new Error(`turn not settled: host=${hostHas} guest=${guestHas}`)
    }
  }).toPass({ timeout: 30_000 })

  const hostIsStoryteller = await passButton(host).isVisible()
  return hostIsStoryteller
    ? { storyteller: host.page, opponent: guest.page }
    : { storyteller: guest.page, opponent: host.page }
}

/** Selects the first (story) card in the hand and clicks Play Card. */
export async function playFirstCard(page: Page): Promise<void> {
  await page.locator('.player-hand > div').first().click()
  await page.getByRole('button', { name: 'Play Card' }).click()
}

/**
 * Clicks Pass on the storyteller's page and waits until the opponent holds
 * the turn. The pass chain is several sequential server actions; a single
 * transient failure aborts it (by design — the machine surfaces the error),
 * so if the DB never flipped and the storyteller still holds the turn, the
 * click is retried. The final assertion stays strict.
 */
export async function passAndWaitForFlip(storyteller: Page, opponent: Page): Promise<void> {
  const passButton = (p: Page) => p.getByRole('button', { name: 'Pass Turn' })
  for (let attempt = 0; attempt < 3; attempt++) {
    await passButton(storyteller).click()
    const flipped = await expect(async () => {
      await expect(passButton(opponent)).toBeVisible({ timeout: 8_000 })
    }).toPass({ timeout: 10_000 }).then(() => true, () => false)
    if (flipped) return
    // If the storyteller no longer has the button the flip happened late —
    // the final assertion below covers it; otherwise retry the pass.
    if (!await passButton(storyteller).isVisible().catch(() => false)) break
    await storyteller.waitForTimeout(1000)
  }
  await expect(passButton(opponent)).toBeVisible({ timeout: 15_000 })
  await expect(passButton(storyteller)).toBeHidden({ timeout: 15_000 })
}

/**
 * Clicks Object on the opponent's page and waits until they hold the turn.
 * If the objection action failed transiently the card is still PENDING and
 * the button is still there — safe to retry. A vanished button without a
 * flip means a partial failure; the final assertion reports it.
 */
export async function objectAndWaitForFlip(storyteller: Page, opponent: Page): Promise<void> {
  const objectButton = opponent.getByRole('button', { name: 'Object / Disapprove' })
  const passButton = (p: Page) => p.getByRole('button', { name: 'Pass Turn' })
  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(objectButton).toBeVisible({ timeout: 8_000 })
    // The button bounces (animate-bounce) so it never satisfies
    // Playwright's stability check — force the click.
    await objectButton.click({ force: true })
    const flipped = await expect(async () => {
      await expect(passButton(opponent)).toBeVisible({ timeout: 8_000 })
    }).toPass({ timeout: 10_000 }).then(() => true, () => false)
    if (flipped) return
    await objectButton.waitFor({ state: 'detached', timeout: 2_000 }).catch(() => {})
    if (!await objectButton.isVisible().catch(() => false)) break
    await opponent.waitForTimeout(1000)
  }
  await expect(passButton(opponent)).toBeVisible({ timeout: 15_000 })
  await expect(passButton(storyteller)).toBeHidden({ timeout: 15_000 })
}

/** Full lobby setup: host creates, guest joins by invite, host starts. */
export async function startTwoPlayerLobby(
  browser: Browser,
): Promise<{ host: Player, guest: Player, lobbyId: string, close: () => Promise<void> }> {
  const host = await newPlayer(browser)
  const guest = await newPlayer(browser)
  const close = async () => {
    await host.context.close()
    await guest.context.close()
  }
  try {
    const lobbyId = await createLobby(host)
    const inviteLink = await getInviteLink(host)
    await joinViaInvite(guest, inviteLink, lobbyId)
    await selectDeckAndStart(host)
    return { host, guest, lobbyId, close }
  }
  catch (error) {
    await close()
    throw error
  }
}
