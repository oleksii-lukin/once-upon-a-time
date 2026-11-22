import { expect, type Browser, type BrowserContext, type Page } from '@playwright/test'
import { execFileSync } from 'node:child_process'

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
  // gotoWithRetry guards against 500s on navigation, but a fresh render can
  // still come up blank (dev under parallel load). If the button is not there,
  // reload within a 30s budget instead of failing on the first wait.
  const deadline = Date.now() + 30_000
  while (true) {
    try {
      await expect(createButton).toBeVisible({ timeout: 10_000 })
      break
    }
    catch (error) {
      if (Date.now() >= deadline) throw error
      await host.page.reload({ waitUntil: 'load' }).catch(() => {})
    }
  }

  // The click can land before hydration attaches the handler (dev), or the
  // create action can fail transiently — retry until the navigation lands.
  // A failed attempt reloads the page: under parallel load the hydrated
  // handler can be dropped or the action response lost, and a fresh load
  // recovers both (the button-visibility loop above handles the render side).
  let lobbyUrl: string | null = null
  for (let attempt = 0; attempt < 4 && !lobbyUrl; attempt++) {
    await createButton.click()
    lobbyUrl = await host.page
      .waitForURL(/\/lobbies\/[0-9a-f-]{36}/i, { timeout: 15_000 })
      .then(() => host.page.url())
      .catch(() => null)
    if (!lobbyUrl && attempt < 3) {
      await host.page.reload({ waitUntil: 'load' }).catch(() => {})
      await expect(createButton).toBeVisible({ timeout: 15_000 }).catch(() => {})
      await host.page.waitForTimeout(1000)
    }
  }
  if (!lobbyUrl) {
    // State dump so a genuine failure (vs a load flake) is diagnosable.
    console.log(`[createLobby] failed: url=${host.page.url()} body=${(await host.page.locator('body').innerText().catch(() => '<unreadable>')).slice(0, 300).replace(/\n+/g, ' | ')}`)
    throw new Error('Create New Story did not navigate to a lobby')
  }

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
 * Navigates with retries on transient failures:
 * - network-layer failures (ERR_NETWORK_CHANGED etc. — machine-level
 *   interface/DNS churn can hit any navigation; all parallel tests failing
 *   their first goto at once is the classic signature), and
 * - HTTP 5xx responses (dev under parallel load intermittently 500s
 *   routes; page.goto resolves normally on a 500, so the status must be
 *   checked explicitly or the blank page fails the next assertion).
 */
export async function gotoWithRetry(page: Page, url: string, attempts = 3): Promise<void> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      const response = await page.goto(url, { waitUntil: 'load' })
      const status = response?.status() ?? 0
      if (status < 500) return
      lastError = new Error(`GET ${url} responded ${status}`)
    }
    catch (error) {
      lastError = error
      if (!/ERR_NETWORK_CHANGED|ERR_CONNECTION|ECONNRESET|EHOSTUNREACH|ETIMEDOUT|ERR_TIMED_OUT/.test(String(error))) {
        throw error
      }
    }
    if (i < attempts - 1) await page.waitForTimeout(2000)
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

/* ------------------------------------------------------------------ *
 * Multi-player (3+) support.
 * ------------------------------------------------------------------ */

/** Full lobby setup with n players: host creates, n-1 guests join by invite. */
export async function startLobby(
  browser: Browser,
  n: number,
  opts: { pacing?: boolean, pacingDuration?: number, mode?: string } = {},
): Promise<{ players: Player[], host: Player, lobbyId: string, close: () => Promise<void> }> {
  expect(n).toBeGreaterThanOrEqual(2)
  const players: Player[] = []
  for (let i = 0; i < n; i++) players.push(await newPlayer(browser))
  const close = async () => {
    await Promise.all(players.map(p => p.context.close()))
  }
  try {
    const [host, ...guests] = players
    const lobbyId = await createLobby(host)
    const inviteLink = await getInviteLink(host)
    for (const guest of guests) await joinViaInvite(guest, inviteLink, lobbyId)
    if (opts.pacing) {
      const pacingToggle = host.page.getByLabel(/Enable Pacing Delay/i)
      await pacingToggle.click()
      await expect(pacingToggle).toBeChecked()
      // Widen the objection window for tests that reload mid-window (the
      // UI slider would need a drag; the DB write propagates via the lobby
      // changefeed before Start, and the deck toggle below re-sends the
      // refetched settings so it does not clobber this value).
      if (opts.pacingDuration) setPacingDuration(lobbyId, opts.pacingDuration)
    }
    if (opts.mode) {
      // GameModeTabs — the label is the localized tab name ("Tutorial", …).
      await host.page.getByRole('button', { name: opts.mode, exact: true }).click()
    }
    await selectDeckAndStart(host)
    return { players, host, lobbyId, close }
  }
  catch (error) {
    await close()
    throw error
  }
}

/** Waits for the game board on every client. */
export async function waitForGameOnAll(players: Player[]): Promise<void> {
  await Promise.all(players.map(p => expect(gameBoard(p.page).first()).toBeVisible({ timeout: 30_000 })))
}

const passButtonOf = (p: Player) => p.page.getByRole('button', { name: 'Pass Turn' })

/**
 * Polls all clients until exactly one shows the turn control. Returns that
 * player, or null while the turn is unsettled (multiple or none).
 */
async function findTurnHolder(players: Player[]): Promise<Player | null> {
  const visible = await Promise.all(players.map(p => passButtonOf(p).isVisible().catch(() => false)))
  const idx = visible.findIndex(v => v)
  return visible.filter(Boolean).length === 1 && idx !== -1 ? players[idx] : null
}

/**
 * Determines which of the given clients holds the turn (exactly one must
 * show the turn control). The first storyteller is shuffled by
 * initializeGame, so it cannot be assumed to be the host.
 */
export async function resolveStorytellerAmong(
  players: Player[],
): Promise<{ storyteller: Player, others: Player[] }> {
  const deadline = Date.now() + 30_000
  while (Date.now() < deadline) {
    const holder = await findTurnHolder(players)
    if (holder) return { storyteller: holder, others: players.filter(p => p !== holder) }
    await players[0].page.waitForTimeout(500)
  }
  throw new Error('no unique storyteller settled')
}

/**
 * Passes from the given storyteller and returns the player who received the
 * turn. Same bounded-retry semantics as passAndWaitForFlip: a transient
 * action failure re-clicks, the final state must be a unique new holder.
 */
export async function passAndWaitForFlipMulti(storyteller: Player, all: Player[]): Promise<Player> {
  const tryResolve = async (budgetMs: number): Promise<Player | null> => {
    const deadline = Date.now() + budgetMs
    while (Date.now() < deadline) {
      const holder = await findTurnHolder(all)
      if (holder && holder !== storyteller) return holder
      await storyteller.page.waitForTimeout(500)
    }
    return null
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await passButtonOf(storyteller).click()
    const holder = await tryResolve(10_000)
    if (holder) return holder
    // If the storyteller no longer holds the button the flip happened late
    // after the budget — the final wait below covers it; otherwise re-click.
    if (!await passButtonOf(storyteller).isVisible().catch(() => false)) break
    await storyteller.page.waitForTimeout(1000)
  }

  const holder = await tryResolve(15_000)
  if (!holder) throw new Error('turn did not flip to another player')
  return holder
}

/**
 * The objector clicks Object and receives the turn. Bounded retries: a
 * transient action failure leaves the PENDING card and the button in place;
 * the final assertion stays strict (unique new holder = the objector).
 */
export async function objectAndWaitForFlipMulti(objector: Player, all: Player[]): Promise<void> {
  const objectButton = objector.page.getByRole('button', { name: 'Object / Disapprove' })
  const tryResolve = async (budgetMs: number): Promise<boolean> => {
    const deadline = Date.now() + budgetMs
    while (Date.now() < deadline) {
      const holder = await findTurnHolder(all)
      if (holder === objector) return true
      await objector.page.waitForTimeout(500)
    }
    return false
  }

  for (let attempt = 0; attempt < 3; attempt++) {
    await expect(objectButton).toBeVisible({ timeout: 8_000 })
    // The button bounces (animate-bounce) — it never satisfies Playwright's
    // stability check, so force the click.
    await objectButton.click({ force: true })
    if (await tryResolve(10_000)) return
    // The button vanished without a flip: the objection landed late or
    // partially failed — the final wait reports it.
    if (!await objectButton.isVisible().catch(() => false)) break
    await objector.page.waitForTimeout(1000)
  }

  if (!await tryResolve(15_000)) throw new Error('objection did not pass the turn to the objector')
}

/* ------------------------------------------------------------------ *
 * Direct DB seeding (deck exhaustion / win acceleration). Test
 * environment only — runs psql inside the local Supabase container.
 * ------------------------------------------------------------------ */

/** Runs SQL against the local Supabase Postgres and returns trimmed output. */
export function psql(sql: string): string {
  return execFileSync(
    'docker',
    ['exec', 'supabase_db_once-upon-a-time', 'psql', '-U', 'postgres', '-d', 'postgres', '-t', '-A', '-v', 'ON_ERROR_STOP=1', '-c', sql],
    { encoding: 'utf8' },
  ).trim()
}

/** Empties the draw pile of the lobby's active game (deck exhaustion). */
export function emptyDrawPile(lobbyId: string): void {
  psql(`DELETE FROM draw_pile WHERE game_session_id IN (SELECT id FROM game_sessions WHERE lobby_id = '${lobbyId}' AND status <> 'COMPLETED')`)
}

/** Sets the pacing (objection) window in seconds — must run BEFORE start. */
export function setPacingDuration(lobbyId: string, seconds: number): void {
  psql(`UPDATE lobbies SET settings = jsonb_set(settings, '{pacingDelayDuration}', '${seconds}'::jsonb) WHERE id = '${lobbyId}'`)
}

/** Removes EVERY story card from the current storyteller's hand (win acceleration). */
export function removeStorytellerStoryCards(lobbyId: string): void {
  psql(`
    WITH story AS (
      SELECT ph.id
      FROM player_hands ph
      JOIN cards c ON c.id = ph.card_id
      WHERE ph.game_session_id IN (SELECT id FROM game_sessions WHERE lobby_id = '${lobbyId}' AND status <> 'COMPLETED')
        AND ph.player_id = (SELECT current_turn_player_id FROM game_sessions WHERE lobby_id = '${lobbyId}' AND status <> 'COMPLETED' LIMIT 1)
        AND c.type <> 'ending'
    )
    DELETE FROM player_hands WHERE id IN (SELECT id FROM story)`)
}
