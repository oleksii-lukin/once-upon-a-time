import { defineConfig, devices } from '@playwright/test'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Warm dev compilation serially before parallel projects stampede it. */
  globalSetup: './tests/e2e/global.warmup.ts',
  /* Run tests in files in parallel */
  fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI; locally cap at 3: the default
     (cores/2 = 6 on this box) saturates the CPU with dev-server compiles +
     Chromium contexts, starving 15s action waits (observed: load avg 16,
     "element not found" timeouts across unrelated tests incl. login/solo). */
  workers: process.env.CI ? 1 : 3,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
      // The multiplayer suite runs standalone (guest identities, no Clerk)
      testIgnore: '**/multiplayer/**',
    },
    {
      // Two-browser-context multiplayer tests against the local Supabase
      // stack: guest identities only, so no Clerk global setup dependency.
      name: 'multiplayer',
      testMatch: '**/multiplayer/**/*.spec.ts',
      timeout: 180_000, // cold Next dev compiles + realtime + pacing windows + 3-player setups
      use: {
        ...devices['Desktop Chrome'],
        navigationTimeout: 60_000,
        actionTimeout: 15_000,
      },
    },
  ],

  /* Run your local dev server before starting the tests */
  webServer: {
    command: 'pnpm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
