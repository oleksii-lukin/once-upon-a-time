import { test, expect } from '@playwright/test'
import { clerk } from '@clerk/testing/playwright'

// Profile editor flow: sign-in state gate, save, and persistence across a
// reload. Guards the user_profiles write path (RLS ownership fix in
// tests/rls/rls-policies.test.ts covers the authorization side).
//
// Requires a Clerk test account: E2E_USER_EMAIL / E2E_USER_PASSWORD are read
// from the test process env — `pnpm test:e2e` loads .env.local for them.

test.describe('Profile editor', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'E2E_USER_EMAIL / E2E_USER_PASSWORD not set (run via pnpm test:e2e or export them)',
  )

  test('signed-out visitor is asked to sign in', async ({ page }) => {
    await page.goto('/en/profile')
    await expect(page.getByText('Sign in to edit your profile')).toBeVisible({ timeout: 15_000 })
  })

  test('signed-in user can save their bio and it persists', async ({ page }) => {
    await page.goto('/en')
    await clerk.signIn({
      page,
      signInParams: {
        strategy: 'password',
        identifier: process.env.E2E_USER_EMAIL!,
        password: process.env.E2E_USER_PASSWORD!,
      },
    })

    await page.goto('/en/profile')

    // Labels are not associated with their inputs (no htmlFor/id), so the
    // editor fields are addressed by element type. The display-name input is
    // the only visible text input on the page.
    const nameInput = page.locator('input[type="text"]:visible').first()
    const bioInput = page.locator('textarea:visible').first()
    await expect(nameInput).toBeVisible({ timeout: 15_000 })

    const marker = `e2e-bio-${Date.now()}`
    const originalBio = await bioInput.inputValue().catch(() => '')

    try {
      await bioInput.fill(marker)
      await page.getByRole('button', { name: 'Save Profile' }).click()
      // The button flips Saving -> Saved (auto-reverts after 2s)
      await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 15_000 })

      // Persistence: a fresh load must read the value back from the DB
      await page.reload({ waitUntil: 'load' })
      await expect(bioInput).toHaveValue(marker, { timeout: 15_000 })
    }
    finally {
      // Restore the previous bio: wait out the 2s Saved -> Save Profile flip,
      // refill and save again (best-effort — a failure here leaves the
      // harmless e2e marker in the local dev profile, nothing more)
      await expect(page.getByRole('button', { name: 'Save Profile' })).toBeVisible({ timeout: 5_000 }).catch(() => {})
      await bioInput.fill(originalBio).catch(() => {})
      await page.getByRole('button', { name: 'Save Profile' }).click().catch(() => {})
      await expect(page.getByRole('button', { name: 'Saved' })).toBeVisible({ timeout: 15_000 }).catch(() => {})
    }
  })
})
