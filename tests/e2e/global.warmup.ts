import { request } from '@playwright/test'

/**
 * Serially warms the dev server's on-demand compilation before the
 * parallel projects start (runs after playwright.config's webServer is
 * reachable). The cold-compile stampede — several workers hitting the
 * same routes at once — is what used to make pages intermittently 500;
 * see app/i18n/server.ts and gotoWithRetry in multiplayer/helpers.ts.
 */

const PATHS = ['/en', '/en/lobbies', '/ru', '/ua']
const ATTEMPTS = 3

export default async function warmup() {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3000'
  const ctx = await request.newContext({ baseURL })
  try {
    for (const path of PATHS) {
      let lastStatus = 0
      for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
        const res = await ctx.get(path, { timeout: 60_000 }).catch(() => null)
        lastStatus = res?.status() ?? 0
        if (res && lastStatus < 500) break
        await new Promise(r => setTimeout(r, 2000))
      }
      if (lastStatus >= 500 || lastStatus === 0) {
        throw new Error(`warmup: GET ${path} failed (status ${lastStatus}) — dev server is not healthy, aborting before parallel tests`)
      }
    }
  }
  finally {
    await ctx.dispose()
  }
}
